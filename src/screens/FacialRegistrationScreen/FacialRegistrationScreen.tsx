import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Camera, CheckCircle, ScanFace, Trash2, Upload, User } from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { piDelete, piGet, piPostForm, validateFaceImage } from "../../lib/pi";
import type { FaceProfile } from "../../types/iris";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

const PHONE_ANGLES = [
  { key: "front",        label: "Look Straight",  instruction: "Face the camera directly" },
  { key: "slight_left",  label: "Tilt Left",      instruction: "Turn your head slightly to the left" },
  { key: "slight_right", label: "Tilt Right",     instruction: "Turn your head slightly to the right" },
  { key: "up",           label: "Look Up",        instruction: "Tilt your head slightly upward" },
  { key: "down",         label: "Look Down",      instruction: "Tilt your head slightly downward" },
] as const;

type FeedbackType = "info" | "ok" | "warn" | "error";
type Mode = "phone" | "upload";

export default function FacialRegistrationScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "tab" });
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("phone");

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

  // Upload mode state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
              setFaces((prev) => prev.filter((f) => f.id !== face.id));
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
              setFeedbackMsg("Hold still...");
              setFeedbackType("ok");
              setQualityOk(true);
            } else {
              const issue = result.issues[0] ?? "Adjust your position.";
              setFeedbackMsg(issue);
              setFeedbackType("warn");
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

  // ── Countdown ─────────────────────────────────────────────────────────────
  // Starts a 3-s countdown as soon as qualityOk becomes true.
  // If qualityOk drops back to false (probe fails), cleanup cancels all timers.
  useEffect(() => {
    if (!phoneCameraActive || !cameraReady || !qualityOk) {
      setCountdown(null);
      return;
    }

    setCountdown(3);

    const t1 = setTimeout(() => {
      if (qualityOkRef.current) setCountdown(2);
    }, 1000);

    const t2 = setTimeout(() => {
      if (qualityOkRef.current) setCountdown(1);
    }, 2000);

    const t3 = setTimeout(() => {
      if (qualityOkRef.current) void doCapture();
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setCountdown(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityOk, phoneCameraActive, cameraReady]);

  // ── Capture + upload for one angle ────────────────────────────────────────
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
        skipProcessing: false,
      });
      await sleep(250);
      setCaptureFlash(false);

      if (!photo || cancelledRef.current) return;

      setCaptureError("");
      setFeedbackMsg("Uploading...");
      setFeedbackType("info");
      setQualityOk(false); // pause countdown while uploading

      const step = phoneStepRef.current;
      const angle = PHONE_ANGLES[step].key;
      const formData = new FormData();
      formData.append("name", nameRef.current.trim());
      formData.append("file", {
        uri: photo.uri,
        type: "image/jpeg",
        name: `${angle}.jpg`,
      } as unknown as Blob);

      await piPostForm<FaceProfile>("/api/faces/", formData, sessionRef.current?.username);

      // Success for this angle
      const newCapture = { angle, uri: photo.uri };
      const updated = [...capturedRef.current, newCapture];
      capturedRef.current = updated;
      setPhoneCaptured(updated);
      setAngleAccepted(true);
      setFeedbackMsg("Angle accepted!");
      setFeedbackType("ok");

      await sleep(900);

      if (step < PHONE_ANGLES.length - 1) {
        const next = step + 1;
        phoneStepRef.current = next;
        setPhoneStep(next);
        // qualityOk reset + feedbackMsg reset happen in the phoneStep useEffect
      } else {
        // All angles complete
        setPhoneCameraActive(false);
        setSuccess(`Registration complete! ${PHONE_ANGLES.length} angles captured.`);
        void loadFaces();
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Upload failed";
      const displayMsg = raw.length < 120 ? raw : "Upload failed. Check your connection.";
      setCaptureError(displayMsg);
      setFeedbackMsg("Try again.");
      setFeedbackType("error");
      setQualityOk(false);
      setCaptureFlash(false);
    } finally {
      capturingRef.current = false;
    }
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
    setFeedbackMsg("Looking for your face...");
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

  // ── Upload mode ───────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleUpload = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!imageUri) { setError("Select an image first"); return; }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", { uri: imageUri, type: "image/jpeg", name: "face.jpg" } as unknown as Blob);
      await piPostForm<FaceProfile>("/api/faces/", formData, session?.username);
      setSuccess("Face registered successfully!");
      setImageUri(null);
      setName("");
      void loadFaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
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
    const progress = `${phoneStep + 1} / ${PHONE_ANGLES.length}`;

    const ovalBorderColor =
      feedbackType === "ok" ? "#4ade80"
      : feedbackType === "warn" ? "#fb923c"
      : feedbackType === "error" ? "#f87171"
      : referenceColors.primary;

    const ovalBorderStyle = feedbackType === "ok" ? "solid" : "dashed";

    const feedbackColor =
      feedbackType === "ok" ? "#4ade80"
      : feedbackType === "warn" ? "#fb923c"
      : feedbackType === "error" ? "#f87171"
      : "#cbd5e1";

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Dark overlay with oval cutout */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <View style={[styles.overlayMiddle, { height: ovalHeight }]}>
            <View style={styles.overlaySide} />
            <View style={[styles.ovalCutout, { width: ovalWidth, height: ovalHeight }]}>
              <View
                style={[
                  styles.ovalBorder,
                  {
                    width: ovalWidth,
                    height: ovalHeight,
                    borderRadius: ovalWidth / 2,
                    borderColor: ovalBorderColor,
                    borderStyle: ovalBorderStyle,
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

        {/* Green success flash when angle is accepted */}
        {angleAccepted && !captureFlash ? (
          <View style={[styles.flashOverlay, { backgroundColor: "rgba(74,222,128,0.25)" }]}>
            <CheckCircle size={72} color="#4ade80" strokeWidth={2} />
          </View>
        ) : null}

        {/* Top bar: back button + step counter */}
        <View style={[styles.cameraTopBar, { top: layout.insets.top + 12 }]}>
          <TouchableOpacity style={styles.cameraBackButton} onPress={cancelPhoneEnroll} hitSlop={12}>
            <ArrowLeft size={18} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.cameraBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.cameraStepText}>{progress}</Text>
          <View style={{ width: 72 }} />
        </View>

        {/* Progress dots */}
        <View style={[styles.cameraProgressRow, { top: layout.insets.top + 52 }]}>
          {PHONE_ANGLES.map((angle, index) => (
            <View
              key={angle.key}
              style={[
                styles.cameraDot,
                index < phoneStep && styles.cameraDotDone,
                index === phoneStep && styles.cameraDotActive,
              ]}
            />
          ))}
        </View>

        {/* Countdown overlay */}
        {countdown !== null ? (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        ) : null}

        {/* Camera init spinner */}
        {!cameraReady ? (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={referenceColors.primary} />
            <Text style={styles.getReadyText}>Starting camera...</Text>
          </View>
        ) : null}

        {/* Bottom instructions */}
        <View style={[styles.cameraBottomBar, { bottom: Math.max(layout.insets.bottom, 20) + 24 }]}>
          <Text style={styles.cameraAngleLabel}>{currentAngle.label}</Text>
          <Text style={styles.cameraInstruction}>{currentAngle.instruction}</Text>

          {/* Dynamic quality feedback */}
          <View style={styles.feedbackRow}>
            <View style={[styles.feedbackDot, { backgroundColor: feedbackColor }]} />
            <Text style={[styles.feedbackText, { color: feedbackColor }]}>{feedbackMsg}</Text>
          </View>

          {captureError ? (
            <Text style={styles.captureErrorText}>{captureError}</Text>
          ) : null}
        </View>
      </View>
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

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
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.completionSubtitle}>Captured Angles</Text>
              <View style={styles.completionGrid}>
                {phoneCaptured.map((photo) => (
                  <View key={photo.angle} style={styles.completionItem}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={[styles.completionThumbnail, { width: completionThumbnailSize, height: completionThumbnailSize }]}
                    />
                    <Text style={styles.completionAngle}>{photo.angle.replace("_", " ")}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.completionHint}>
                These images have been sent to the Pi. The system will use all angles for more accurate recognition.
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
                    Capture 5 guided angles or upload a portrait image. Only high-quality samples are stored.
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

                <View style={styles.modeRow}>
                  {([
                    { key: "phone" as Mode, label: "Phone Camera", icon: Camera },
                    { key: "upload" as Mode, label: "Upload Photo", icon: Upload },
                  ]).map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.modeTab, active && styles.modeTabActive]}
                        onPress={() => { setMode(item.key); setError(""); setSuccess(""); }}
                      >
                        <Icon size={16} color={active ? "#ffffff" : referenceColors.textSoft} strokeWidth={2.2} />
                        <Text style={[styles.modeText, active && styles.modeTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {success ? <Text style={styles.success}>{success}</Text> : null}

                {mode === "phone" ? (
                  <>
                    {/* Step preview cards */}
                    <View style={styles.stepPreviewRow}>
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
                      <Text style={styles.captureTitle}>Quality-Guided Enrollment</Text>
                      <Text style={styles.captureInstruction}>
                        The camera will validate your face position, lighting, and sharpness before capturing each angle.
                        Bad samples are automatically rejected.
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.primaryButtonWrap} onPress={startPhoneEnroll}>
                      <View style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>Start Face Enrollment</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={[styles.previewImage, { height: previewHeight }]} resizeMode="cover" />
                    ) : null}
                    <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
                      <Text style={styles.secondaryButtonText}>{imageUri ? "Change Image" : "Select Image"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButtonWrap, uploading && styles.buttonDisabled]}
                      onPress={() => void handleUpload()}
                      disabled={uploading}
                    >
                      <View style={styles.primaryButton}>
                        {uploading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Upload & Register</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </>
                )}
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
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  backText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
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
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  modeTabActive: {
    backgroundColor: referenceColors.primary,
    borderColor: referenceColors.primary,
  },
  modeText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#ffffff",
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
  previewImage: {
    width: "100%",
    borderRadius: 20,
    marginBottom: 12,
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
  cameraTopBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cameraBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cameraBackText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cameraStepText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cameraProgressRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  cameraDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#cbd5e1",
  },
  cameraDotDone: {
    backgroundColor: referenceColors.success,
  },
  cameraDotActive: {
    backgroundColor: referenceColors.primary,
  },
  countdownOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownText: {
    fontSize: 80,
    fontWeight: "900",
    color: "rgba(255,255,255,0.85)",
  },
  getReadyText: {
    color: "#ffffff",
    fontSize: 14,
    marginTop: 12,
  },
  cameraBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 6,
  },
  cameraAngleLabel: {
    color: "#60a5fa",
    fontSize: 22,
    fontWeight: "800",
  },
  cameraInstruction: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  feedbackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  captureErrorText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
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
