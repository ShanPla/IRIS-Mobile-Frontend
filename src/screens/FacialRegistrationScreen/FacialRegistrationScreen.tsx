import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Camera, CheckCircle, ScanFace, Trash2, User } from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { piDelete, piGet, piPostForm, validateFaceImage } from "../../lib/pi";
import type { FaceProfile } from "../../types/iris";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

// Expected head-pose ranges per enrollment angle.
// yaw  < 0: subject turned LEFT  (their left); yaw  > 0: turned RIGHT
// pitch< 0: tilted UP;                          pitch> 0: tilted DOWN
const ANGLE_POSE: Record<string, { yaw: [number, number]; pitch: [number, number] }> = {
  front:        { yaw: [-0.15,  0.15], pitch: [-0.20,  0.20] },
  slight_left:  { yaw: [-0.60, -0.15], pitch: [-0.28,  0.28] },
  slight_right: { yaw: [ 0.15,  0.60], pitch: [-0.28,  0.28] },
  up:           { yaw: [-0.20,  0.20], pitch: [-0.35, -0.08] },
  down:         { yaw: [-0.20,  0.20], pitch: [ 0.08,  0.35] },
};

function getPoseGuidance(angleKey: string, yaw: number, pitch: number): string | null {
  const expected = ANGLE_POSE[angleKey];
  if (!expected) return null;
  const yawOk   = yaw   >= expected.yaw[0]   && yaw   <= expected.yaw[1];
  const pitchOk = pitch >= expected.pitch[0] && pitch <= expected.pitch[1];
  if (yawOk && pitchOk) return null;
  if (!yawOk) {
    return yaw < expected.yaw[0]
      ? "Turn your head more to the right."
      : "Turn your head more to the left.";
  }
  return pitch < expected.pitch[0]
    ? "Tilt your head down slightly."
    : "Tilt your head up slightly.";
}

const PHONE_ANGLES = [
  { key: "front",        label: "Look Straight",  instruction: "Face the camera directly" },
  { key: "slight_left",  label: "Tilt Left",      instruction: "Turn your head slightly to the left" },
  { key: "slight_right", label: "Tilt Right",     instruction: "Turn your head slightly to the right" },
  { key: "up",           label: "Look Up",        instruction: "Tilt your head slightly upward" },
  { key: "down",         label: "Look Down",      instruction: "Tilt your head slightly downward" },
] as const;

type FeedbackType = "info" | "ok" | "warn" | "error";

export default function FacialRegistrationScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "tab" });
  const [name, setName] = useState("");

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phoneStep, setPhoneStep] = useState(0);
  const [phoneCaptured, setPhoneCaptured] = useState<Array<{ angle: string; uri: string }>>([]);
  const [phoneCameraActive, setPhoneCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);

  // Quality-gated enrollment state
  const [qualityOk, setQualityOk] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("Looking for your face...");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [angleAccepted, setAngleAccepted] = useState(false);

  // Confirmation step state (after all angles captured, before saving)
  const [confirmPending, setConfirmPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Registered faces list
  const [faces, setFaces] = useState<FaceProfile[]>([]);
  const [facesLoading, setFacesLoading] = useState(true);
  const [facesError, setFacesError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Refs for async coordination
  const phoneStepRef = useRef(0);
  const capturedRef = useRef<Array<{ angle: string; uri: string }>>([]);
  const capturingRef = useRef(false);
  const probeInProgressRef = useRef(false);
  const qualityOkRef = useRef(false);
  const cancelledRef = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Animation — pulses the ring when face is ready to capture
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const loadFaces = useCallback(async () => {
    setFacesError("");
    try {
      const data = await piGet<FaceProfile[]>("/api/faces/", session?.username);
      setFaces(data);
    } catch (e) {
      setFacesError(e instanceof Error ? e.message : "Could not load faces");
    } finally {
      setFacesLoading(false);
    }
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      setFacesLoading(true);
      void loadFaces();
    }, [loadFaces])
  );

  const handleDeleteFace = (face: FaceProfile) => {
    Alert.alert(
      "Delete Face",
      `Remove "${face.name}"? This will delete all their enrolled photos and the Pi will no longer recognize them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(face.id);
            try {
              await piDelete(`/api/faces/${face.id}`, session?.username);
              // Backend deletes the entire face directory so wipe all local
              // records sharing this name, not just the one ID.
              setFaces((prev) => prev.filter((f) => f.name !== face.name));
            } catch (e) {
              Alert.alert("Delete Failed", e instanceof Error ? e.message : "Could not delete face profile");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const groupedFaces = faces.reduce<Record<string, { profiles: FaceProfile[]; latestId: number }>>((acc, face) => {
    if (!acc[face.name]) acc[face.name] = { profiles: [], latestId: face.id };
    acc[face.name].profiles.push(face);
    if (face.id > acc[face.name].latestId) acc[face.name].latestId = face.id;
    return acc;
  }, {});

  const ovalWidth = Math.round(Math.min(260, Math.max(170, layout.width * 0.55)));
  const ovalHeight = Math.round(Math.min(360, Math.max(230, layout.width * 0.75)));
  const previewHeight = getResponsiveMediaHeight(layout.width, { min: 220, max: 300, ratio: 0.68 });
  const completionThumbnailSize = Math.floor(Math.max(72, Math.min(150, (layout.contentWidth - 20) / 3)));

  // Keep phoneStepRef in sync
  useEffect(() => { phoneStepRef.current = phoneStep; }, [phoneStep]);

  // Keep qualityOkRef in sync so countdown timeouts can read it without stale closure
  useEffect(() => { qualityOkRef.current = qualityOk; }, [qualityOk]);

  // Reset quality state on every new angle step
  useEffect(() => {
    if (!phoneCameraActive) return;
    setQualityOk(false);
    setFeedbackMsg("Position your face in the guide");
    setFeedbackType("info");
    setCaptureError("");
    setAngleAccepted(false);
  }, [phoneStep, phoneCameraActive]);

  // Pulse the ring border when the face is good and capture is imminent
  useEffect(() => {
    if (qualityOk && countdown !== null) {
      pulseLoopRef.current?.stop();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current = loop;
      loop.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseLoopRef.current = null;
      pulseAnim.setValue(1);
    }
  }, [qualityOk, countdown, pulseAnim]);

  // Hide the floating tab bar while the camera or confirmation screen is active
  useEffect(() => {
    const hidden = phoneCameraActive || confirmPending;
    navigation.setOptions({ tabBarStyle: hidden ? { display: "none" } : undefined });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [phoneCameraActive, confirmPending, navigation]);

  // ── Probe loop ────────────────────────────────────────────────────────────
  // Runs while camera is active and ready. Takes a low-quality probe photo every
  // ~1.8 s, sends to /api/faces/validate, updates quality feedback.
  useEffect(() => {
    if (!phoneCameraActive || !cameraReady) return;

    let active = true;
    probeInProgressRef.current = false;

    const run = async () => {
      await sleep(1000); // let camera warm up before first probe

      while (active) {
        if (capturingRef.current) {
          await sleep(400);
          continue;
        }

        if (!probeInProgressRef.current && cameraRef.current) {
          probeInProgressRef.current = true;
          try {
            const probe = await cameraRef.current.takePictureAsync({
              quality: 0.3,
              skipProcessing: true,
            });
            if (!active || !probe) {
              probeInProgressRef.current = false;
              continue;
            }

            const result = await validateFaceImage(probe.uri, sessionRef.current?.username);

            if (!active) {
              probeInProgressRef.current = false;
              break;
            }

            if (result.ok) {
              const angleKey = PHONE_ANGLES[phoneStepRef.current].key;
              const poseMsg =
                result.yaw !== undefined && result.pitch !== undefined
                  ? getPoseGuidance(angleKey, result.yaw, result.pitch)
                  : null;
              if (poseMsg) {
                setFeedbackMsg(poseMsg);
                setFeedbackType("warn");
                setQualityOk(false);
              } else {
                setFeedbackMsg("Face detected — hold still...");
                setFeedbackType("ok");
                setQualityOk(true);
              }
            } else {
              const issue = result.issues[0] ?? "Adjust your position.";
              setFeedbackMsg(issue);
              setFeedbackType(result.face_detected ? "warn" : "error");
              setQualityOk(false);
            }
          } catch {
            if (active) {
              setFeedbackMsg("Checking...");
              setFeedbackType("info");
            }
          } finally {
            probeInProgressRef.current = false;
          }
        }

        await sleep(1800);
      }
    };

    void run();
    return () => { active = false; };
  }, [phoneCameraActive, cameraReady, phoneStep]);

  // ── Capture trigger ───────────────────────────────────────────────────────
  // Waits 1.8 s of continuous quality-ok before auto-capturing (Face ID style —
  // no visible countdown, just the ring pulsing until the shot fires).
  useEffect(() => {
    if (!phoneCameraActive || !cameraReady || !qualityOk) {
      setCountdown(null);
      return;
    }

    setCountdown(1); // used only as a "capturing soon" signal for the pulse animation

    const t = setTimeout(() => {
      if (qualityOkRef.current) void doCapture();
    }, 1800);

    return () => {
      clearTimeout(t);
      setCountdown(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityOk, phoneCameraActive, cameraReady]);

  // ── Capture one angle locally (no backend call yet) ───────────────────────
  const doCapture = async () => {
    if (capturingRef.current || !qualityOkRef.current || cancelledRef.current) return;
    capturingRef.current = true;

    // Wait for any in-flight probe to finish first
    let waited = 0;
    while (probeInProgressRef.current && waited < 600) {
      await sleep(100);
      waited += 100;
    }

    try {
      setCaptureFlash(true);
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.92,
        skipProcessing: true,
      });
      await sleep(250);
      setCaptureFlash(false);

      if (!photo || cancelledRef.current) return;

      setCaptureError("");
      setQualityOk(false);

      const step = phoneStepRef.current;
      const angle = PHONE_ANGLES[step].key;

      const newCapture = { angle, uri: photo.uri };
      const updated = [...capturedRef.current, newCapture];
      capturedRef.current = updated;
      setPhoneCaptured(updated);
      setAngleAccepted(true);
      setFeedbackMsg("Angle captured!");
      setFeedbackType("ok");

      await sleep(900);

      if (step < PHONE_ANGLES.length - 1) {
        const next = step + 1;
        phoneStepRef.current = next;
        setPhoneStep(next);
      } else {
        // All angles captured — show confirmation before saving
        setPhoneCameraActive(false);
        setConfirmPending(true);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Capture failed";
      const displayMsg = raw.length < 120 ? raw : "Capture failed. Try again.";
      setCaptureError(displayMsg);
      setFeedbackMsg("Try again.");
      setFeedbackType("error");
      setQualityOk(false);
      setCaptureFlash(false);
    } finally {
      capturingRef.current = false;
    }
  };

  // ── Confirm and upload all captured angles ────────────────────────────────
  const handleConfirmSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      for (const capture of capturedRef.current) {
        const formData = new FormData();
        formData.append("name", nameRef.current.trim());
        formData.append("file", {
          uri: capture.uri,
          type: "image/jpeg",
          name: `${capture.angle}.jpg`,
        } as unknown as Blob);
        await piPostForm<FaceProfile>("/api/faces/", formData, sessionRef.current?.username);
      }
      setConfirmPending(false);
      setSuccess(`Registration complete! ${PHONE_ANGLES.length} angles saved.`);
      void loadFaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Retake all angles from scratch ────────────────────────────────────────
  const handleRetakeAll = () => {
    setConfirmPending(false);
    startPhoneEnroll();
  };

  // ── Enrollment start / cancel ─────────────────────────────────────────────
  const startPhoneEnroll = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    setSuccess("");
    setPhoneStep(0);
    setPhoneCaptured([]);
    phoneStepRef.current = 0;
    capturedRef.current = [];
    capturingRef.current = false;
    probeInProgressRef.current = false;
    cancelledRef.current = false;
    setQualityOk(false);
    setFeedbackMsg("Center your face in the guide");
    setFeedbackType("info");
    setCaptureError("");
    setAngleAccepted(false);
    setCameraReady(false);
    setPhoneCameraActive(true);
  };

  const cancelPhoneEnroll = () => {
    cancelledRef.current = true;
    setPhoneCameraActive(false);
    setPhoneStep(0);
    setPhoneCaptured([]);
    setCountdown(null);
    setCaptureFlash(false);
    setCameraReady(false);
    setQualityOk(false);
    setCaptureError("");
    setAngleAccepted(false);
  };

  const resetEnrollment = () => {
    setPhoneCaptured([]);
    setSuccess("");
    setError("");
    capturedRef.current = [];
  };

  // ── Camera enrollment view ────────────────────────────────────────────────
  if (phoneCameraActive) {
    if (!permission?.granted) {
      return (
        <View style={styles.centered}>
          <ReferenceBackdrop />
          <View style={styles.centerCard}>
            <Text style={styles.permissionText}>Camera permission is required for face enrollment.</Text>
            <TouchableOpacity style={styles.primaryButtonWrap} onPress={() => void requestPermission()}>
              <View style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Grant Camera Permission</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={cancelPhoneEnroll}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const currentAngle = PHONE_ANGLES[phoneStep];
    const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

    const fidOvalW = Math.round(SCREEN_W * 0.70);
    const fidOvalH = Math.round(SCREEN_H * 0.56);

    const ovalBorderColor =
      feedbackType === "ok"    ? "#4ade80"
      : feedbackType === "warn"  ? "#fb923c"
      : feedbackType === "error" ? "#f87171"
      : referenceColors.primary;

    const instructionText = angleAccepted
      ? "Angle captured!"
      : feedbackType === "ok"
      ? "Hold still..."
      : feedbackMsg;

    const instructionColor =
      feedbackType === "ok"    ? "#4ade80"
      : feedbackType === "warn"  ? "#fb923c"
      : feedbackType === "error" ? "#f87171"
      : "rgba(255,255,255,0.75)";

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="picture"
          mute
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Dark vignette with oval cutout */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <View style={[styles.overlayMiddle, { height: fidOvalH }]}>
            <View style={styles.overlaySide} />
            <View style={[styles.ovalCutout, { width: fidOvalW, height: fidOvalH }]}>
              <Animated.View
                style={[
                  styles.ovalBorder,
                  {
                    width: fidOvalW,
                    height: fidOvalH,
                    borderRadius: fidOvalW / 2,
                    borderColor: ovalBorderColor,
                    borderStyle: "solid",
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>

        {/* White capture flash */}
        {captureFlash ? <View style={styles.flashOverlay} /> : null}

        {/* Green success overlay */}
        {angleAccepted && !captureFlash ? (
          <View style={[styles.flashOverlay, { backgroundColor: "rgba(74,222,128,0.22)" }]}>
            <CheckCircle size={72} color="#4ade80" strokeWidth={2} />
          </View>
        ) : null}

        {/* Camera init spinner */}
        {!cameraReady ? (
          <View style={styles.initOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.getReadyText}>Starting camera...</Text>
          </View>
        ) : null}

        {/* Top bar: cancel + step counter */}
        <View style={[styles.fidTopBar, { top: layout.insets.top + 12 }]}>
          <TouchableOpacity style={styles.fidCancelBtn} onPress={cancelPhoneEnroll} hitSlop={12}>
            <ArrowLeft size={18} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.fidCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.fidStepCount}>{phoneStep + 1} / {PHONE_ANGLES.length}</Text>
        </View>

        {/* Bottom bar: step dots + angle label + live instruction */}
        <View style={[styles.fidBottomBar, { bottom: Math.max(layout.insets.bottom, 20) + 16 }]}>
          <View style={styles.fidDots}>
            {PHONE_ANGLES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.fidDot,
                  i < phoneCaptured.length ? styles.fidDotDone
                  : i === phoneStep ? styles.fidDotActive
                  : styles.fidDotPending,
                ]}
              />
            ))}
          </View>
          <Text style={styles.fidAngleLabel}>{currentAngle.label}</Text>
          <Text style={[styles.fidInstruction, { color: instructionColor }]}>{instructionText}</Text>
          {captureError ? (
            <Text style={styles.captureErrorText}>{captureError}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Confirmation screen (review captures before saving) ───────────────────
  if (confirmPending) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
      >
        <View style={styles.container}>
          <ReferenceBackdrop />
          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, layout.contentStyle]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Confirm Registration</Text>
              <Text style={styles.subtitle}>Review all captured angles before saving to the Pi</Text>
            </View>

            <View style={styles.completionCard}>
              <Text style={styles.confirmHint}>
                These {PHONE_ANGLES.length} photos will be saved for facial recognition. If any angle looks wrong, tap <Text style={{ fontWeight: "800" }}>Retake All</Text> to start over.
              </Text>

              <Text style={styles.completionSubtitle}>Captured Angles</Text>
              <View style={styles.completionGrid}>
                {phoneCaptured.map((photo, i) => (
                  <View key={photo.angle} style={styles.completionItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={[styles.completionThumbnail, { width: completionThumbnailSize, height: completionThumbnailSize }]}
                    />
                    <Text style={styles.completionAngle}>{PHONE_ANGLES[i]?.label ?? photo.angle.replace("_", " ")}</Text>
                  </View>
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButtonWrap, submitting && styles.buttonDisabled]}
                onPress={() => void handleConfirmSave()}
                disabled={submitting}
              >
                <View style={styles.primaryButton}>
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Confirm &amp; Save</Text>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleRetakeAll} disabled={submitting}>
                <Text style={styles.secondaryButtonText}>Retake All</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Main form view ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <View style={styles.container}>
        <ReferenceBackdrop />
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, layout.contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Facial Recognition</Text>
            <Text style={styles.subtitle}>Register trusted faces for secure access</Text>
          </View>

          {/* Completion screen */}
          {success && phoneCaptured.length > 0 ? (
            <View style={styles.completionCard}>
              <View style={styles.completionIconWrap}>
                <CheckCircle size={48} color={referenceColors.success} strokeWidth={2} />
              </View>
              <Text style={styles.completionTitle}>Enrollment Complete</Text>
              <Text style={styles.success}>{success}</Text>

              <Text style={styles.completionSubtitle}>Saved Angles</Text>
              <View style={styles.completionGrid}>
                {phoneCaptured.map((photo, i) => (
                  <View key={photo.angle} style={styles.completionItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={[styles.completionThumbnail, { width: completionThumbnailSize, height: completionThumbnailSize }]}
                    />
                    <Text style={styles.completionAngle}>{PHONE_ANGLES[i]?.label ?? photo.angle.replace("_", " ")}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.completionHint}>
                All angles have been saved to the Pi. The system will now use them for accurate recognition.
              </Text>

              <TouchableOpacity style={styles.primaryButtonWrap} onPress={() => navigation.goBack()}>
                <View style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Done</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetEnrollment}>
                <Text style={styles.secondaryButtonText}>Register Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <ScanFace size={22} color={referenceColors.primary} strokeWidth={2.2} />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryTitle}>Add New Face</Text>
                  <Text style={styles.summaryText}>
                    Capture 5 guided angles via the live camera. The system checks position, lighting, and sharpness in real time before each shot.
                  </Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.label}>Person&apos;s Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Steephen"
                  placeholderTextColor="#94a3b8"
                  value={name}
                  onChangeText={setName}
                />

                {error ? <Text style={[styles.error, { marginTop: 14 }]}>{error}</Text> : null}
                {success ? <Text style={[styles.success, { marginTop: 14 }]}>{success}</Text> : null}

                {/* Step preview */}
                <View style={[styles.stepPreviewRow, { marginTop: 18 }]}>
                  {PHONE_ANGLES.map((a, i) => (
                    <View key={a.key} style={styles.stepPreviewItem}>
                      <View style={styles.stepPreviewDot}>
                        <Text style={styles.stepPreviewNum}>{i + 1}</Text>
                      </View>
                      <Text style={styles.stepPreviewLabel}>{a.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.captureCard}>
                  <Camera size={20} color={referenceColors.primary} strokeWidth={2.2} style={{ marginBottom: 8 }} />
                  <Text style={styles.captureTitle}>Live Camera Only</Text>
                  <Text style={styles.captureInstruction}>
                    The camera will guide you in real time — follow the on-screen instructions for each angle. Nothing is saved until you confirm at the end.
                  </Text>
                </View>

                <TouchableOpacity style={styles.primaryButtonWrap} onPress={startPhoneEnroll}>
                  <View style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Start Face Enrollment</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Registered faces list */}
          <View style={styles.registeredSection}>
            <Text style={styles.registeredTitle}>Registered Faces</Text>
            <Text style={styles.registeredSubtitle}>
              {faces.length} photo{faces.length !== 1 ? "s" : ""} across {Object.keys(groupedFaces).length} person{Object.keys(groupedFaces).length !== 1 ? "s" : ""}
            </Text>

            {facesLoading ? (
              <ActivityIndicator color={referenceColors.primary} style={{ marginTop: 16 }} />
            ) : facesError ? (
              <View style={styles.emptyFacesCard}>
                <Text style={styles.error}>{facesError}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => { setFacesLoading(true); void loadFaces(); }}>
                  <Text style={styles.secondaryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : Object.keys(groupedFaces).length === 0 ? (
              <View style={styles.emptyFacesCard}>
                <Text style={styles.emptyFacesText}>No faces registered yet. Enroll someone above.</Text>
              </View>
            ) : (
              Object.entries(groupedFaces).map(([personName, { profiles }]) => (
                <View key={personName} style={styles.faceCard}>
                  <View style={styles.faceCardRow}>
                    <View style={styles.faceAvatar}>
                      <User size={20} color={referenceColors.primary} strokeWidth={2.2} />
                    </View>
                    <View style={styles.faceCardCopy}>
                      <Text style={styles.faceCardName}>{personName}</Text>
                      <Text style={styles.faceCardMeta}>
                        {profiles.length} photo{profiles.length !== 1 ? "s" : ""} registered
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.faceDeleteButton}
                      onPress={() => handleDeleteFace(profiles[0])}
                      disabled={deletingId != null}
                    >
                      {deletingId === profiles[0].id ? (
                        <ActivityIndicator size="small" color={referenceColors.danger} />
                      ) : (
                        <Trash2 size={16} color={referenceColors.danger} strokeWidth={2.2} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  centerCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 24,
    alignItems: "center",
    ...cardShadow,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: "rgba(238,246,255,0.84)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 20,
    marginBottom: 18,
    ...cardShadow,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 18,
    ...cardShadow,
  },
  label: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: referenceColors.text,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 10,
  },
  success: {
    color: referenceColors.success,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 10,
  },
  permissionText: {
    color: referenceColors.text,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: referenceColors.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: referenceColors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButtonWrap: {
    borderRadius: 18,
    marginTop: 12,
    ...buttonShadow,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  stepPreviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 4,
  },
  stepPreviewItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  stepPreviewDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPreviewNum: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  stepPreviewLabel: {
    color: referenceColors.textMuted,
    fontSize: 10,
    textAlign: "center",
  },
  captureCard: {
    minHeight: 120,
    borderRadius: 22,
    backgroundColor: "rgba(239,246,255,0.82)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  captureTitle: {
    color: referenceColors.primary,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  captureInstruction: {
    color: referenceColors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  completionCard: {
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 18,
    alignItems: "center",
    ...cardShadow,
  },
  completionIconWrap: {
    marginBottom: 10,
    marginTop: 4,
  },
  completionTitle: {
    color: referenceColors.success,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  completionSubtitle: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  completionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 16,
  },
  completionItem: {
    alignItems: "center",
  },
  completionThumbnail: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: referenceColors.success,
  },
  completionAngle: {
    color: referenceColors.textSoft,
    fontSize: 11,
    marginTop: 4,
    textTransform: "capitalize",
  },
  completionHint: {
    color: referenceColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmHint: {
    color: referenceColors.textSoft,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  // ── Camera overlay styles ─────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayTop: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayMiddle: {
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ovalCutout: {
    justifyContent: "center",
    alignItems: "center",
  },
  ovalBorder: {
    borderWidth: 3,
  },
  overlayBottom: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  initOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  getReadyText: {
    color: "#ffffff",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "600",
  },
  captureErrorText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  fidTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  fidCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fidCancelText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  fidStepCount: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fidBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  fidDots: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  fidDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fidDotDone: {
    backgroundColor: "#4ade80",
  },
  fidDotActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ffffff",
  },
  fidDotPending: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  fidAngleLabel: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fidInstruction: {
    fontSize: 15,
    textAlign: "center",
    fontWeight: "500",
  },
  // ── Registered faces ──────────────────────────────────────────────────────
  registeredSection: {
    marginTop: 28,
  },
  registeredTitle: {
    color: referenceColors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  registeredSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
    marginBottom: 14,
  },
  emptyFacesCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 28,
    alignItems: "center" as const,
    ...cardShadow,
  },
  emptyFacesText: {
    color: referenceColors.textMuted,
    fontSize: 14,
    textAlign: "center" as const,
  },
  faceCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 16,
    marginBottom: 10,
    ...cardShadow,
  },
  faceCardRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
  },
  faceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  faceCardCopy: {
    flex: 1,
  },
  faceCardName: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  faceCardMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  faceDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(254,226,226,0.7)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});
