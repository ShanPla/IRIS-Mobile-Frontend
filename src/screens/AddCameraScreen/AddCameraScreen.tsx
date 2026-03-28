import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Placeholder cameras for testing
export const PLACEHOLDER_CAMERAS = [
  { id: "1", name: "Office", ip: "192.168.1.100", active: true },
  { id: "2", name: "Living Room", ip: "192.168.1.101", active: true },
  { id: "3", name: "Bedroom", ip: "192.168.1.102", active: false },
  { id: "4", name: "Kitchen", ip: "192.168.1.103", active: true },
];

export default function AddCameraScreen() {
  const navigation = useNavigation<Nav>();
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleAdd = async () => {
    if (!name.trim()) { setError("Camera name is required."); return; }
    if (!ip.trim()) { setError("IP address is required."); return; }
    setLoading(true);
    setError("");
    // TODO: connect to backend camera registration endpoint
    setTimeout(() => {
      setLoading(false);
      setSuccess(`Camera "${name}" added successfully!`);
      setTimeout(() => navigation.goBack(), 1500);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#e5e7eb", fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Pi Camera</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📷</Text>
        </View>
        <Text style={styles.desc}>
          Register a new Raspberry Pi camera by entering its name and local IP address.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Camera Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Living Room"
            placeholderTextColor="#6b7280"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Pi IP Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 192.168.1.100"
            placeholderTextColor="#6b7280"
            value={ip}
            onChangeText={setIp}
            autoCapitalize="none"
            keyboardType="numeric"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <TouchableOpacity style={styles.addBtn} onPress={() => void handleAdd()} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.addBtnText}>Add Camera</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}