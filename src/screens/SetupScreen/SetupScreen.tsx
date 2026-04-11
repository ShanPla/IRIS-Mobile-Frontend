import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { addDevice } from "../../lib/pi";
import { useAuth } from "../../context/AuthContext";

type Nav = NativeStackNavigationProp<RootStackParamList, "Setup">;

export default function SetupScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshSession, session } = useAuth();
  const [url, setUrl] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddDevice = async () => {
    if (!url.trim() || !deviceIp.trim()) {
      setError("Ngrok URL and Device IP are required");
      return;
    }
    if (!session?.email?.trim()) {
      setError("Sign in before adding a device");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = url.trim().replace(/\/$/, "");
      const withProtocol = /^https?:\/\//i.test(normalized)
        ? normalized
        : `https://${normalized}`;
      await addDevice(withProtocol, deviceIp.trim(), session.email, session.username);
      await refreshSession();
      navigation.navigate("DeviceList");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add device");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("DeviceList")}>
          <Text style={styles.backText}>{"< Devices"}</Text>
        </TouchableOpacity>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>+</Text>
        </View>
        <Text style={styles.logo}>Add Device</Text>
        <Text style={styles.subtitle}>Register a camera to this account</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Ngrok URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://xyz.ngrok-free.dev"
          placeholderTextColor="#64748b"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Device IP</Text>
        <TextInput
          style={styles.input}
          placeholder="192.168.254.100"
          placeholderTextColor="#64748b"
          value={deviceIp}
          onChangeText={setDeviceIp}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            This device will be added as a Primary device for {session?.email || "your email"}.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAddDevice}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.buttonText}>Add Device</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 60 },
  header: { alignItems: "center", marginBottom: 32 },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
  },
  backText: { color: "#2563eb", fontSize: 13, fontWeight: "800" },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoMarkText: { color: "#ffffff", fontSize: 32, fontWeight: "600", marginTop: -4 },
  logo: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 14, marginTop: 6, textAlign: "center" },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    elevation: 8,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  label: { color: "#334155", fontSize: 13, fontWeight: "800", marginBottom: 8, marginTop: 14 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    color: "#0f172a",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoCard: {
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
  },
  infoText: { color: "#334155", fontSize: 13, lineHeight: 18 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#f8fafc", fontWeight: "800", fontSize: 16 },
  error: { color: "#dc2626", fontSize: 13, marginTop: 12, textAlign: "center" },
});
