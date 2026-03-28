import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiClient, buildApiUrl } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { FaceProfile } from "../../types/iris";
import { styles } from "./styles";

export default function ProfileScreen() {
  const { session } = useAuth();

  const [name, setName] = useState(session?.username ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [infoError, setInfoError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loadingFace, setLoadingFace] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { void loadProfile(); }, []);

  const loadProfile = async () => {
    setLoadingFace(true);
    try {
      const response = await apiClient.get<FaceProfile[]>("/api/faces/");
      if (response.data.length > 0) {
        const p = response.data[0];
        setProfile(p);
        setImageUrl(await buildApiUrl(`/api/faces/${p.id}/image`));
      }
    } catch {
      // silently fail
    } finally {
      setLoadingFace(false);
    }
  };

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    setInfoError("");
    setInfoSuccess("");
    try {
      await new Promise((r) => setTimeout(r, 800)); // TODO: backend
      setInfoSuccess("Profile updated successfully!");
      setTimeout(() => setInfoSuccess(""), 2500);
    } catch {
      setInfoError("Failed to update profile.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError("Both fields are required.");
      return;
    }
    setSavingPassword(true);
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await new Promise((r) => setTimeout(r, 800)); // TODO: backend
      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setPasswordSuccess(""), 2500);
    } catch {
      setPasswordError("Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleUploadFace = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", name || session?.username || "My Profile");
      formData.append("file", {
        uri: asset.uri,
        name: "face.jpg",
        type: "image/jpeg",
      } as never);
      await apiClient.post("/api/faces/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadProfile();
    } catch {
      Alert.alert("Error", "Failed to upload face photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFace = () => {
    if (!profile) return;
    Alert.alert("Remove Face Profile", "This will remove your face from the recognition system. Continue?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            await apiClient.delete(`/api/faces/${profile.id}`);
            setProfile(null);
            setImageUrl(undefined);
          } catch {
            Alert.alert("Error", "Failed to delete face profile.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={{ fontSize: 10 }}>✓</Text>
            </View>
          </View>
          <Text style={styles.username}>{session?.username}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{session?.role?.replace("_", " ")}</Text>
          </View>
        </View>

        {/* Personal Info */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#4b5563"
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="#4b5563"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput
                style={styles.fieldInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+63 900 000 0000"
                placeholderTextColor="#4b5563"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          {infoError || infoSuccess ? (
            <View style={styles.feedback}>
              {infoError ? <Text style={styles.error}>{infoError}</Text> : null}
              {infoSuccess ? <Text style={styles.success}>{infoSuccess}</Text> : null}
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleSaveInfo()} disabled={savingInfo}>
              {savingInfo ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Security */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <TextInput
                style={styles.fieldInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor="#4b5563"
                secureTextEntry
              />
            </View>
            <View style={[styles.fieldRow, styles.fieldRowLast]}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <TextInput
                style={styles.fieldInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor="#4b5563"
                secureTextEntry
              />
            </View>
          </View>
          {passwordError || passwordSuccess ? (
            <View style={styles.feedback}>
              {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
              {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleChangePassword()} disabled={savingPassword}>
              {savingPassword ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Face Profile */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Face Recognition</Text>
          </View>

          {loadingFace ? (
            <ActivityIndicator color="#22d3ee" />
          ) : profile ? (
            <>
              <View style={styles.faceProfileCard}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.faceAvatar} />
                ) : (
                  <View style={styles.faceAvatarPlaceholder}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                  </View>
                )}
                <View style={styles.faceInfo}>
                  <Text style={styles.faceName}>{profile.name}</Text>
                  <Text style={styles.faceDate}>
                    Added {new Date(profile.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.faceStatus}>● Registered</Text>
                </View>
                <TouchableOpacity
                  style={styles.faceEditBtn}
                  onPress={() => void handleUploadFace()}
                  disabled={uploading}
                >
                  {uploading
                    ? <ActivityIndicator color="#22d3ee" size="small" />
                    : <Text style={styles.faceEditBtnText}>Update</Text>
                  }
                </TouchableOpacity>
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteFace}>
                  <Text style={styles.dangerBtnText}>Remove Face Profile</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.noFaceCard}>
              <Text style={{ fontSize: 36 }}>🫥</Text>
              <Text style={styles.noFaceText}>No face profile registered</Text>
              <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>
                Register your face so the system can identify you as an authorized user.
              </Text>
              <View style={[styles.actionRow, { width: "100%", marginTop: 8 }]}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleUploadFace()} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.primaryBtnText}>Register Face</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}