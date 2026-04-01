import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { addDevice } from "../../lib/pi";
import { useAuth } from "../../context/AuthContext";

interface Props {
  navigation?: { goBack: () => void };
}

export default function SetupScreen({ navigation }: Props) {
  const { refreshSession } = useAuth();
  const [url, setUrl] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"url" | "credentials">("url");

  const handleVerify = async () => {
    if (!url.trim() || !deviceId.trim()) {
      setError("Pi URL and Device ID are required");
      return;
    }
    setStep("credentials");
    setError("");
  };

  const handlePair = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const normalized = url.trim().replace(/\/$/, "");
      const withProtocol = /^https?:\/\//i.test(normalized)
        ? normalized
        : `https://${normalized}`;
      await addDevice(withProtocol, deviceId.trim(), username.trim(), password);
      await refreshSession();
      if (navigation) {
        navigation.goBack();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pairing failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>IRIS</Text>
        <Text style={styles.subtitle}>Add Raspberry Pi</Text>
      </View>

      {step === "url" ? (
        <>
          <Text style={styles.label}>Pi URL (ngrok or local)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. https://xyz.ngrok-free.dev"
            placeholderTextColor="#6b7280"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Device ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. IRIS-A3F2"
            placeholderTextColor="#6b7280"
            value={deviceId}
            onChangeText={setDeviceId}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => Alert.alert("QR Scanner", "Navigate to AddCamera screen for QR scanning")}
          >
            <Text style={styles.scanButtonText}>Scan QR Code Instead</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleVerify}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceInfoText}>Connecting to: {deviceId}</Text>
            <Text style={styles.deviceInfoUrl}>{url}</Text>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Your username"
            placeholderTextColor="#6b7280"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handlePair}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#030712" />
            ) : (
              <Text style={styles.buttonText}>Pair Device</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { setStep("url"); setError(""); }}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { padding: 24, paddingTop: 80 },
  header: { alignItems: "center", marginBottom: 40 },
  logo: { color: "#22d3ee", fontSize: 32, fontWeight: "800", letterSpacing: 6 },
  subtitle: { color: "#9ca3af", fontSize: 16, marginTop: 8 },
  label: { color: "#9ca3af", fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 14,
    color: "#e5e7eb",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#374151",
  },
  button: {
    backgroundColor: "#22d3ee",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#030712", fontWeight: "700", fontSize: 16 },
  scanButton: { alignItems: "center", marginTop: 16, padding: 12 },
  scanButtonText: { color: "#22d3ee", fontSize: 14 },
  backButton: { alignItems: "center", marginTop: 16, padding: 12 },
  backButtonText: { color: "#6b7280", fontSize: 14 },
  error: { color: "#f87171", fontSize: 13, marginTop: 12, textAlign: "center" },
  deviceInfo: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  deviceInfoText: { color: "#22d3ee", fontWeight: "600", fontSize: 14 },
  deviceInfoUrl: { color: "#6b7280", fontSize: 12, marginTop: 4 },
});
