import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { piGet, piPut, piPostForm, piDelete, buildPiUrl } from "../../lib/pi";
import type { FaceProfile, UserResponse } from "../../types/iris";

export default function ProfileScreen() {
  const { session, logout } = useAuth();

  const [user, setUser] = useState<UserResponse | null>(null);
  const [faces, setFaces] = useState<FaceProfile[]>([]);
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [uploading, setUploading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [meData, facesData] = await Promise.all([
        piGet<UserResponse>("/api/auth/me"),
        piGet<FaceProfile[]>("/api/faces/"),
      ]);
      setUser(meData);
      setFaces(facesData);

      if (facesData.length > 0) {
        const url = await buildPiUrl(`/api/faces/${facesData[0].id}/image`);
        setFaceImageUrl(url);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchProfile();
    }, [fetchProfile])
  );

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordError("Both fields are required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await piPut("/api/auth/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUploadFace = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", user?.username ?? "unknown");
      formData.append("file", {
        uri: result.assets[0].uri,
        type: "image/jpeg",
        name: "face.jpg",
      } as unknown as Blob);

      await piPostForm("/api/faces/", formData);
      await fetchProfile();
      Alert.alert("Success", "Face profile updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFace = (face: FaceProfile) => {
    Alert.alert("Delete Face", `Remove ${face.name}'s face profile?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await piDelete(`/api/faces/${face.id}`);
            await fetchProfile();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Delete failed");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.username ?? "?").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username ?? "Unknown"}</Text>
        <Text style={styles.role}>{user?.role?.replace(/_/g, " ") ?? ""}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Face Recognition</Text>
        {faces.length > 0 ? (
          faces.map((face) => (
            <View key={face.id} style={styles.faceRow}>
              {faceImageUrl ? (
                <Image source={{ uri: faceImageUrl }} style={styles.faceImage} />
              ) : (
                <View style={styles.faceImagePlaceholder} />
              )}
              <View style={styles.faceInfo}>
                <Text style={styles.faceName}>{face.name}</Text>
                <Text style={styles.faceDate}>Added {new Date(face.created_at).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteFace(face)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No face profile registered</Text>
        )}
        <TouchableOpacity
          style={[styles.secondaryButton, uploading && styles.buttonDisabled]}
          onPress={handleUploadFace}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#22d3ee" />
          ) : (
            <Text style={styles.secondaryButtonText}>{faces.length > 0 ? "Update Photo" : "Add Photo"}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor="#6b7280"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="New password (min 6 chars)"
          placeholderTextColor="#6b7280"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
        {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}
        <TouchableOpacity
          style={[styles.button, changingPassword && styles.buttonDisabled]}
          onPress={handlePasswordChange}
          disabled={changingPassword}
        >
          {changingPassword ? (
            <ActivityIndicator color="#030712" />
          ) : (
            <Text style={styles.buttonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" },
  profileHeader: { alignItems: "center", paddingTop: 60, paddingBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#22d3ee", fontSize: 24, fontWeight: "700" },
  username: { color: "#e5e7eb", fontSize: 20, fontWeight: "700" },
  role: { color: "#6b7280", fontSize: 13, marginTop: 4 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  faceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  faceImage: { width: 48, height: 48, borderRadius: 8, marginRight: 12 },
  faceImagePlaceholder: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#374151", marginRight: 12 },
  faceInfo: { flex: 1 },
  faceName: { color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  faceDate: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  deleteText: { color: "#f87171", fontSize: 13, fontWeight: "600" },
  emptyText: { color: "#6b7280", fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 14,
    color: "#e5e7eb",
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  button: {
    backgroundColor: "#22d3ee",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#030712", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButtonText: { color: "#22d3ee", fontWeight: "600" },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  success: { color: "#4ade80", fontSize: 13, marginBottom: 8 },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 32,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f87171",
    alignItems: "center",
  },
  logoutText: { color: "#f87171", fontWeight: "600", fontSize: 15 },
});
