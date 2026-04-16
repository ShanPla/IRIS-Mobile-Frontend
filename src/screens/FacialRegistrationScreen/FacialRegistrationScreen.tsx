import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { ArrowLeft, Camera, ScanFace, Trash2, Upload, User } from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { piDelete, piGet, piPostForm } from "../../lib/pi";
import type { FaceProfile } from "../../types/iris";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

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
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("phone");

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [phoneStep, setPhoneStep] = useState(0);
  const [phoneCaptured, setPhoneCaptured] = useState<Array<{ angle: string; uri: string }>>([]);
  const [phoneCameraActive, setPhoneCameraActive] = useState(false);
  const [phoneUploading, setPhoneUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);

  const phoneStepRef = useRef(0);
  const capturedRef = useRef<Array<{ angle: string; uri: string }>>([]);
  const capturingRef = useRef(false);
  const cancelledRef = useRef(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Registered faces list
  const [faces, setFaces] = useState<FaceProfile[]>([]);
  const [facesLoading, setFacesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadFaces = useCallback(async () => {
    try {
      const data = await piGet<FaceProfile[]>("/api/faces/", session?.username);
      setFaces(data);
    } catch {
      // silently fail — list is supplementary
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

  // Group faces by name to show unique people with photo counts
  const groupedFaces = faces.reduce<Record<string, { profiles: FaceProfile[]; latestId: number }>>((acc, face) => {
    if (!acc[face.name]) {
      acc[face.name] = { profiles: [], latestId: face.id };
    }
    acc[face.name].profiles.push(face);
    if (face.id > acc[face.name].latestId) acc[face.name].latestId = face.id;
    return acc;
  }, {});

  useEffect(() => {
    phoneStepRef.current = phoneStep;
  }, [phoneStep]);

  const startPhoneEnroll = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
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

  useEffect(() => {
    if (!phoneCameraActive || !cameraReady) return;

    cancelledRef.current = false;
    let active = true;

    const runCapture = async () => {
      await sleep(1500);
      if (!active || cancelledRef.current) return;

      for (let i = 3; i > 0; i -= 1) {
        if (!active || cancelledRef.current) return;
        setCountdown(i);
        await sleep(1000);
      }
      if (!active || cancelledRef.current) return;
      setCountdown(null);

      if (!cameraRef.current || capturingRef.current) return;
      capturingRef.current = true;

      try {
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
          const next = step + 1;
          phoneStepRef.current = next;
          setPhoneStep(next);
        } else {
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
  }, [cameraReady, phoneCameraActive, phoneStep]);

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

        await piPostForm<FaceProfile>("/api/faces/", formData, session?.username);
        uploaded += 1;
      }
      setSuccess(`Face registered! ${uploaded}/${photos.length} angles uploaded.`);
      void loadFaces();
    } catch (e) {
      if (uploaded > 0) {
        setSuccess(`Partial upload: ${uploaded}/${photos.length} angles.`);
        void loadFaces();
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
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!imageUri) {
      setError("Select an image first");
      return;
    }
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

    const currentPrompt = PHONE_ANGLES[phoneStep];
    const progress = `${phoneStep + 1} of ${PHONE_ANGLES.length}`;

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" mode="picture" onCameraReady={() => setCameraReady(true)} />

        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.ovalCutout}>
              <View style={[styles.ovalBorder, countdown !== null && countdown <= 1 && styles.ovalBorderReady]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom} />
        </View>

        {captureFlash ? <View style={styles.flashOverlay} /> : null}

        <View style={styles.cameraTopBar}>
          <TouchableOpacity onPress={cancelPhoneEnroll}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.cameraStepText}>{progress}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.cameraProgressRow}>
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

        {countdown !== null ? (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        ) : null}

        {!cameraReady ? (
          <View style={styles.countdownOverlay}>
            <ActivityIndicator size="large" color={referenceColors.primary} />
            <Text style={styles.getReadyText}>Starting camera...</Text>
          </View>
        ) : null}

        <View style={styles.cameraBottomBar}>
          <Text style={styles.cameraAngleLabel}>{currentPrompt.label}</Text>
          <Text style={styles.cameraInstruction}>{currentPrompt.instruction}</Text>
          <Text style={styles.autoHint}>{countdown !== null ? "Hold still..." : "Position your face in the oval"}</Text>
        </View>
      </View>
    );
  }

  if (phoneUploading) {
    return (
      <View style={styles.centered}>
        <ReferenceBackdrop />
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color={referenceColors.primary} />
          <Text style={styles.uploadingText}>Uploading {capturedRef.current.length} photos to Pi...</Text>
          <Text style={styles.uploadingSubText}>Registering face profile for {name}</Text>
        </View>
      </View>
    );
  }

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
            contentContainerStyle={styles.content}
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

            {success && phoneCaptured.length > 0 ? (
              <View style={styles.completionCard}>
                <Text style={styles.completionTitle}>Enrollment Complete</Text>
                <Text style={styles.success}>{success}</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Text style={styles.completionSubtitle}>Captured Photos</Text>
                <View style={styles.completionGrid}>
                  {phoneCaptured.map((photo) => (
                    <View key={photo.angle} style={styles.completionItem}>
                      <Image source={{ uri: photo.uri }} style={styles.completionThumbnail} />
                      <Text style={styles.completionAngle}>{photo.angle}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.completionHint}>
                  These photos have been sent to the Pi for face recognition training.
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
                    <Text style={styles.summaryText}>Capture 5 guided angles or upload a single portrait image.</Text>
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
                          onPress={() => {
                            setMode(item.key);
                            setError("");
                            setSuccess("");
                          }}
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
                      <View style={styles.captureCard}>
                        <Text style={styles.captureTitle}>Automatic Face Enrollment</Text>
                        <Text style={styles.captureInstruction}>
                          The camera will automatically capture 5 angles of your face. Just follow the on-screen prompts.
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
                      {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" /> : null}

                      <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
                        <Text style={styles.secondaryButtonText}>{imageUri ? "Change Image" : "Select Image"}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.primaryButtonWrap, uploading && styles.buttonDisabled]} onPress={() => void handleUpload()} disabled={uploading}>
                        <View style={styles.primaryButton}>
                          {uploading ? <ActivityIndicator color={referenceColors.primary} /> : <Text style={styles.primaryButtonText}>Upload & Register</Text>}
                        </View>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}

            <View style={styles.registeredSection}>
              <Text style={styles.registeredTitle}>Registered Faces</Text>
              <Text style={styles.registeredSubtitle}>
                {faces.length} photo{faces.length !== 1 ? "s" : ""} across {Object.keys(groupedFaces).length} person{Object.keys(groupedFaces).length !== 1 ? "s" : ""}
              </Text>

              {facesLoading ? (
                <ActivityIndicator color={referenceColors.primary} style={{ marginTop: 16 }} />
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
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    height: 260,
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
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: referenceColors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  captureCard: {
    minHeight: 150,
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
    ...cardShadow,
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
    width: (SCREEN_WIDTH - 88) / 3,
    height: (SCREEN_WIDTH - 88) / 3,
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
  },
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
    height: OVAL_H,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
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
    borderColor: referenceColors.primary,
    borderStyle: "dashed",
  },
  ovalBorderReady: {
    borderColor: referenceColors.success,
    borderStyle: "solid",
  },
  overlayBottom: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
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
  cancelText: {
    color: "#fda4af",
    fontSize: 16,
    fontWeight: "700",
  },
  cameraStepText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
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
    color: "rgba(255,255,255,0.82)",
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
    bottom: 48,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cameraAngleLabel: {
    color: "#60a5fa",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  cameraInstruction: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  autoHint: {
    color: "#cbd5e1",
    fontSize: 12,
    textAlign: "center",
  },
  uploadingText: {
    color: referenceColors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
  uploadingSubText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
  },
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
