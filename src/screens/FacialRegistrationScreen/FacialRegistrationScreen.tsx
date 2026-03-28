import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../../lib/api";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FacialRegistrationScreen() {
  const navigation = useNavigation<Nav>();
  const [name, setName] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePickImage = async () => {
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
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setProgress(50);
      setError("");
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) { setError("Please enter a name."); return; }
    if (!imageUri) { setError("Please select a photo."); return; }

    setUploading(true);
    setError("");
    setSuccess("");
    setProgress(75);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", {
        uri: imageUri,
        name: "face.jpg",
        type: "image/jpeg",
      } as never);

      await apiClient.post("/api/faces/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProgress(100);
      setSuccess("Face registered successfully!");
      setTimeout(() => navigation.goBack(), 1500);
    } catch {
      setError("Failed to register face. Please try again.");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#e5e7eb", fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facial Registration</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Face Circle */}
        <TouchableOpacity style={styles.faceCircle} onPress={() => void handlePickImage()}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.faceImage} resizeMode="cover" />
          ) : (
            <View style={styles.facePlaceholder}>
              <Text style={{ fontSize: 48 }}>👤</Text>
              <Text style={styles.facePlaceholderText}>Tap to select photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Scan Progress */}
        <View style={styles.scanCard}>
          <Text style={styles.scanPercent}>{progress}%</Text>
          <Text style={styles.scanLabel}>Face Scan</Text>
          <Text style={styles.scanDesc}>
            {progress === 0
              ? "Select a clear photo of your face to begin registration."
              : progress === 50
              ? "Photo selected. Enter your name and tap Register."
              : progress === 75
              ? "Uploading and processing..."
              : "Registration complete!"}
          </Text>
        </View>

        {/* Name Input */}
        <TextInput
          style={styles.nameInput}
          placeholder="Enter full name"
          placeholderTextColor="#6b7280"
          value={name}
          onChangeText={setName}
          autoCorrect={false}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {/* Buttons */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => void handleRegister()}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.actionBtnText}>Register Face</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => void handlePickImage()}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
            Choose Different Photo
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}