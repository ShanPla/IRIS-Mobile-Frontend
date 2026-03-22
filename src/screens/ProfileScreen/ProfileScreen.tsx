import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { apiClient, buildApiUrl } from "../../lib/api";
import type { FaceProfile } from "../../types/iris";
import { styles } from "./styles";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<FaceProfile | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiClient.get<FaceProfile[]>("/api/faces/");
      if (response.data.length > 0) {
        const p = response.data[0];
        setProfile(p);
        setImageUrl(await buildApiUrl(`/api/faces/${p.id}/image`));
      }
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
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
    setError("");
    try {
      const formData = new FormData();
      formData.append("name", "My Profile");
      formData.append("file", {
        uri: asset.uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as never);
      await apiClient.post("/api/faces/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadProfile();
    } catch {
      setError("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    Alert.alert("Remove Profile", "Are you sure you want to remove your face profile?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          try {
            await apiClient.delete(`/api/faces/${profile.id}`);
            setProfile(null);
            setImageUrl(undefined);
          } catch {
            setError("Failed to delete profile.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Face Profile</Text>
      <Text style={styles.desc}>Your registered face used for identity verification.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.profileCard}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarIcon}>👤</Text>
            </View>
          )}
          {profile ? (
            <>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileDate}>
                Registered {new Date(profile.created_at).toLocaleDateString()}
              </Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => void handleUpload()} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#000" /> : <Text style={styles.uploadBtnText}>Update Photo</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => void handleDelete()}>
                <Text style={styles.deleteBtnText}>Remove Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.noProfile}>No face profile registered yet.</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => void handleUpload()} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#000" /> : <Text style={styles.uploadBtnText}>Upload Photo</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}