import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { piPostForm, piPost, buildPiUrl } from "../../lib/pi";
import type { FaceProfile } from "../../types/iris";

const GUIDED_ANGLES = ["front", "left", "right"] as const;

export default function FacialRegistrationScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"upload" | "guided">("upload");

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [currentAngle, setCurrentAngle] = useState(0);
  const [capturedAngles, setCapturedAngles] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const handleCapture = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    const angle = GUIDED_ANGLES[currentAngle];
    setCapturing(true);
    setError("");
    try {
      await piPost(`/api/faces/capture?name=${encodeURIComponent(name.trim())}&angle=${angle}`);
      setCapturedAngles((prev) => [...prev, angle]);

      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`);
      setPreviewUri(url);

      if (currentAngle < GUIDED_ANGLES.length - 1) {
        setCurrentAngle((prev) => prev + 1);
      } else {
        setSuccess("All angles captured! Face registered.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Register Face</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.label}>Person's Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Steephen"
        placeholderTextColor="#6b7280"
        value={name}
        onChangeText={setName}
      />

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === "upload" && styles.modeTabActive]}
          onPress={() => setMode("upload")}
        >
          <Text style={[styles.modeText, mode === "upload" && styles.modeTextActive]}>Upload Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === "guided" && styles.modeTabActive]}
          onPress={() => setMode("guided")}
        >
          <Text style={[styles.modeText, mode === "guided" && styles.modeTextActive]}>Pi Camera Capture</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      {mode === "upload" ? (
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
      ) : (
        <>
          <View style={styles.progressRow}>
            {GUIDED_ANGLES.map((angle, i) => (
              <View key={angle} style={styles.progressItem}>
                <View style={[styles.progressDot, capturedAngles.includes(angle) && styles.progressDotDone]} />
                <Text style={[styles.progressLabel, currentAngle === i && styles.progressLabelActive]}>
                  {angle}
                </Text>
              </View>
            ))}
          </View>

          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.captureArea}>
              <Text style={styles.captureInstruction}>
                Look {GUIDED_ANGLES[currentAngle]} at the Pi camera
              </Text>
            </View>
          )}

          {!success ? (
            <TouchableOpacity
              style={[styles.button, capturing && styles.buttonDisabled]}
              onPress={handleCapture}
              disabled={capturing}
            >
              {capturing ? (
                <ActivityIndicator color="#030712" />
              ) : (
                <Text style={styles.buttonText}>
                  Capture {GUIDED_ANGLES[currentAngle]}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { paddingBottom: 40 },
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
  modeRow: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginTop: 20, marginBottom: 16 },
  modeTab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: "#22d3ee" },
  modeText: { color: "#9ca3af", fontSize: 13, fontWeight: "600" },
  modeTextActive: { color: "#030712" },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginVertical: 8, paddingHorizontal: 20 },
  success: { color: "#4ade80", fontSize: 13, textAlign: "center", marginVertical: 8, paddingHorizontal: 20 },
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
  progressRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginVertical: 16 },
  progressItem: { alignItems: "center" },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#374151",
    marginBottom: 4,
  },
  progressDotDone: { backgroundColor: "#4ade80" },
  progressLabel: { color: "#6b7280", fontSize: 12 },
  progressLabelActive: { color: "#22d3ee", fontWeight: "700" },
  captureArea: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
    marginHorizontal: 20,
    borderRadius: 12,
    marginVertical: 12,
  },
  captureInstruction: { color: "#9ca3af", fontSize: 15, textAlign: "center" },
});
