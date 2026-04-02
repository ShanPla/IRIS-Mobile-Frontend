import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { piPostForm } from "../../lib/pi";
import type { FaceProfile } from "../../types/iris";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OVAL_W = SCREEN_WIDTH * 0.55;
const OVAL_H = SCREEN_WIDTH * 0.75;

const PHONE_ANGLES = [
  { key: "front", label: "Look Straight", instruction: "Face the camera directly" },
  { key: "left", label: "Turn Left", instruction: "Slowly turn your head to the left" },
  { key: "right", label: "Turn Right", instruction: "Slowly turn your head to the right" },
  { key: "up", label: "Look Up", instruction: "Tilt your head slightly upward" },
  { key: "down", label: "Look Down", instruction: "Tilt your head slightly downward" },
] as const;

type Mode = "phone" | "upload";

export default function FacialRegistrationScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("phone");

  // Phone camera state
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phoneStep, setPhoneStep] = useState(0);
  const [phoneCaptured, setPhoneCaptured] = useState<Array<{ angle: string; uri: string }>>([]);
  const [phoneCameraActive, setPhoneCameraActive] = useState(false);
  const [phoneUploading, setPhoneUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);

  // Refs to avoid stale closures in the auto-capture effect
  const phoneStepRef = useRef(0);
  const capturedRef = useRef<Array<{ angle: string; uri: string }>>([]);
  const capturingRef = useRef(false);
  const cancelledRef = useRef(false);

  // Upload mode state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Keep refs in sync with state
  useEffect(() => { phoneStepRef.current = phoneStep; }, [phoneStep]);

  // ── Auto-capture sequence ─────────────────────────────────────────

  const startPhoneEnroll = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setError("");
    setSuccess("");
    setPhoneStep(0);
    setPhoneCaptured([]);
    phoneStepRef.current = 0;
    capturedRef.current = [];
    capturingRef.current = false;
    cancelledRef.current = false;
    setCameraReady(false);
    setPhoneCameraActive(true);
  };

  // Auto-capture: runs automatically when camera is ready and step changes
  useEffect(() => {
    if (!phoneCameraActive || !cameraReady) return;

    cancelledRef.current = false;
    let active = true;

    const runCapture = async () => {
      // Wait 1.5s for user to read the instruction and position
      await sleep(1500);
      if (!active || cancelledRef.current) return;

      // 3-second countdown
      for (let i = 3; i > 0; i--) {
        if (!active || cancelledRef.current) return;
        setCountdown(i);
        await sleep(1000);
      }
      if (!active || cancelledRef.current) return;
      setCountdown(null);

      // Take the photo
      if (!cameraRef.current || capturingRef.current) return;
      capturingRef.current = true;

      try {
        // Flash effect
        setCaptureFlash(true);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });
        await sleep(300);
        setCaptureFlash(false);

        if (!active || cancelledRef.current || !photo) {
          capturingRef.current = false;
          return;
        }

        const step = phoneStepRef.current;
        const angle = PHONE_ANGLES[step].key;
        const newCapture = { angle, uri: photo.uri };
        const updated = [...capturedRef.current, newCapture];
        capturedRef.current = updated;
        setPhoneCaptured(updated);

        if (step < PHONE_ANGLES.length - 1) {
          // Advance to next angle
          const next = step + 1;
          phoneStepRef.current = next;
          setPhoneStep(next);
          // The effect re-runs due to phoneStep changing
        } else {
          // All done — upload
          setPhoneCameraActive(false);
          void uploadPhonePhotos(updated);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Capture failed");
        setCaptureFlash(false);
      } finally {
        capturingRef.current = false;
      }
    };

    void runCapture();

    return () => {
      active = false;
    };
  }, [phoneCameraActive, cameraReady, phoneStep]);

  const uploadPhonePhotos = async (photos: Array<{ angle: string; uri: string }>) => {
    setPhoneUploading(true);
    setError("");
    let uploaded = 0;

    try {
      for (const photo of photos) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("file", {
          uri: photo.uri,
          type: "image/jpeg",
          name: `${photo.angle}.jpg`,
        } as unknown as Blob);

        await piPostForm<FaceProfile>("/api/faces/", formData);
        uploaded++;
      }
      setSuccess(`Face registered! ${uploaded}/${photos.length} angles uploaded.`);
    } catch (e) {
      if (uploaded > 0) {
        setSuccess(`Partial upload: ${uploaded}/${photos.length} angles.`);
      }
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhoneUploading(false);
    }
  };

  const cancelPhoneEnroll = () => {
    cancelledRef.current = true;
    setPhoneCameraActive(false);
    setPhoneStep(0);
    setPhoneCaptured([]);
    setCountdown(null);
    setCaptureFlash(false);
    setCameraReady(false);
  };

  const resetEnrollment = () => {
    setPhoneCaptured([]);
    setSuccess("");
    setError("");
    capturedRef.current = [];
  };

  // ── Upload mode methods ───────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!imageUri) { setError("Select an image first"); return; }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", {
        uri: imageUri,
        type: "image/jpeg",
        name: "face.jpg",
      } as unknown as Blob);

      await piPostForm<FaceProfile>("/api/faces/", formData);
      setSuccess("Face registered successfully!");
      setImageUri(null);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Phone camera fullscreen UI ────────────────────────────────────

  if (phoneCameraActive) {
    if (!permission?.granted) {
      return (
        <View style={styles.centered}>
          <Text style={styles.permissionText}>Camera permission is required for face enrollment.</Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={cancelPhoneEnroll}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const currentPrompt = PHONE_ANGLES[phoneStep];
    const progress = `${phoneStep + 1} of ${PHONE_ANGLES.length}`;

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Oval face guide overlay */}
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.ovalCutout}>
              <View style={[
                styles.ovalBorder,
                countdown !== null && countdown <= 1 && styles.ovalBorderReady,
              ]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>

        {/* Flash overlay on capture */}
        {captureFlash && <View style={styles.flashOverlay} />}

        {/* Top status bar */}
        <View style={styles.cameraTopBar}>
          <TouchableOpacity onPress={cancelPhoneEnroll}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.cameraStepText}>{progress}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Progress dots */}
        <View style={styles.cameraProgressRow}>
          {PHONE_ANGLES.map((a, i) => (
            <View
              key={a.key}
              style={[
                styles.cameraDot,
                i < phoneStep && styles.cameraDotDone,
                i === phoneStep && styles.cameraDotActive,
              ]}
            />
          ))}
        </View>

        {/* Countdown overlay */}
        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* "Get ready" before countdown starts */}
        {!cameraReady && (
          <View style={styles.countdownOverlay}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.getReadyText}>Starting camera...</Text>
          </View>
        )}

        {/* Bottom instruction */}
        <View style={styles.cameraBottomBar}>
          <Text style={styles.cameraAngleLabel}>{currentPrompt.label}</Text>
          <Text style={styles.cameraInstruction}>{currentPrompt.instruction}</Text>
          <Text style={styles.autoHint}>
            {countdown !== null ? "Hold still..." : "Position your face in the oval"}
          </Text>
        </View>
      </View>
    );
  }

  // ── Uploading overlay ─────────────────────────────────────────────

  if (phoneUploading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22d3ee" />
        <Text style={styles.uploadingText}>Uploading {capturedRef.current.length} photos to Pi...</Text>
        <Text style={styles.uploadingSubText}>Registering face profile for {name}</Text>
      </View>
    );
  }

  // ── Main form UI ──────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Register Face</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Show completion screen with thumbnails after successful phone enrollment */}
      {success && phoneCaptured.length > 0 ? (
        <View style={styles.completionContainer}>
          <Text style={styles.completionTitle}>Enrollment Complete</Text>
          <Text style={styles.success}>{success}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.completionSubtitle}>Captured Photos</Text>
          <View style={styles.completionGrid}>
            {phoneCaptured.map((p) => (
              <View key={p.angle} style={styles.completionItem}>
                <Image source={{ uri: p.uri }} style={styles.completionThumbnail} />
                <Text style={styles.completionAngle}>{p.angle}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.completionHint}>
            These photos have been sent to the Pi for face recognition training.
            {"\n"}You can view registered profiles in the Profile tab.
          </Text>

          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={resetEnrollment}>
            <Text style={styles.secondaryButtonText}>Register Another</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Person's Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Steephen"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
          />

          <View style={styles.modeRow}>
            {([
              { key: "phone" as Mode, label: "Phone Camera" },
              { key: "upload" as Mode, label: "Upload Photo" },
            ]).map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeTab, mode === m.key && styles.modeTabActive]}
                onPress={() => { setMode(m.key); setError(""); setSuccess(""); }}
              >
                <Text style={[styles.modeText, mode === m.key && styles.modeTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          {mode === "phone" ? (
            <>
              <View style={styles.captureArea}>
                <Text style={styles.captureTitle}>Automatic Face Enrollment</Text>
                <Text style={styles.captureInstruction}>
                  {"The camera will automatically capture 5 angles of your face.\nJust follow the on-screen prompts — no button presses needed."}
                </Text>
              </View>
              <TouchableOpacity style={styles.button} onPress={startPhoneEnroll}>
                <Text style={styles.buttonText}>Start Face Enrollment</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              ) : null}
              <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
                <Text style={styles.secondaryButtonText}>{imageUri ? "Change Image" : "Select Image"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, uploading && styles.buttonDisabled]}
                onPress={handleUpload}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#030712" /> : <Text style={styles.buttonText}>Upload & Register</Text>}
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center", padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backText: { color: "#22d3ee", fontSize: 15 },
  title: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  label: { color: "#9ca3af", fontSize: 13, marginBottom: 6, paddingHorizontal: 20, marginTop: 16 },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 14,
    color: "#e5e7eb",
    fontSize: 15,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "#374151",
  },
  modeRow: { flexDirection: "row", paddingHorizontal: 20, gap: 6, marginTop: 20, marginBottom: 16 },
  modeTab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: "#22d3ee" },
  modeText: { color: "#9ca3af", fontSize: 11, fontWeight: "600" },
  modeTextActive: { color: "#030712" },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginVertical: 8, paddingHorizontal: 20 },
  success: { color: "#4ade80", fontSize: 13, textAlign: "center", marginVertical: 8, paddingHorizontal: 20 },
  permissionText: { color: "#e5e7eb", fontSize: 15, textAlign: "center", marginBottom: 20, lineHeight: 22 },
  previewImage: {
    width: "100%",
    height: 250,
    marginVertical: 12,
    borderRadius: 8,
  },
  secondaryButton: {
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryButtonText: { color: "#22d3ee", fontWeight: "600" },
  button: {
    backgroundColor: "#22d3ee",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#030712", fontWeight: "700", fontSize: 16 },
  captureArea: {
    minHeight: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
    marginHorizontal: 20,
    borderRadius: 12,
    marginVertical: 12,
    padding: 20,
  },
  captureTitle: { color: "#22d3ee", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  captureInstruction: { color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 22 },

  // ── Completion screen ──────────────────────────────────────────────
  completionContainer: { paddingHorizontal: 20, paddingTop: 8 },
  completionTitle: { color: "#4ade80", fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  completionSubtitle: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 12 },
  completionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 16,
  },
  completionItem: { alignItems: "center" },
  completionThumbnail: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#4ade80",
  },
  completionAngle: { color: "#9ca3af", fontSize: 11, marginTop: 4, textTransform: "capitalize" },
  completionHint: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },

  // ── Phone camera styles ────────────────────────────────────────────
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 10,
  },

  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayTop: { flex: 1, width: "100%", backgroundColor: "rgba(0,0,0,0.55)" },
  overlayMiddle: { flexDirection: "row", height: OVAL_H },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  ovalCutout: {
    width: OVAL_W,
    height: OVAL_H,
    justifyContent: "center",
    alignItems: "center",
  },
  ovalBorder: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 3,
    borderColor: "#22d3ee",
    borderStyle: "dashed",
  },
  ovalBorderReady: {
    borderColor: "#4ade80",
    borderStyle: "solid",
  },
  overlayBottom: { flex: 1, width: "100%", backgroundColor: "rgba(0,0,0,0.55)" },

  cameraTopBar: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cancelText: { color: "#f87171", fontSize: 16, fontWeight: "600" },
  cameraStepText: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },

  cameraProgressRow: {
    position: "absolute",
    top: 100,
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
    backgroundColor: "#374151",
  },
  cameraDotDone: { backgroundColor: "#4ade80" },
  cameraDotActive: { backgroundColor: "#22d3ee" },

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
    color: "rgba(255,255,255,0.8)",
  },
  getReadyText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 12,
  },

  cameraBottomBar: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cameraAngleLabel: { color: "#22d3ee", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  cameraInstruction: { color: "#d1d5db", fontSize: 15, textAlign: "center", marginBottom: 8 },
  autoHint: { color: "#6b7280", fontSize: 12, textAlign: "center" },

  uploadingText: { color: "#e5e7eb", fontSize: 16, marginTop: 20, fontWeight: "600" },
  uploadingSubText: { color: "#6b7280", fontSize: 13, marginTop: 4 },
});
