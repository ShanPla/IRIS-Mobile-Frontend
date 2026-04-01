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
import { useAuth } from "../../context/AuthContext";
import { piPost } from "../../lib/pi";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLoginError("Username and password are required");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    try {
      const ok = await login(username.trim(), password);
      if (!ok) setLoginError("Invalid username or password");
    } catch {
      setLoginError("Login failed. Is the Pi reachable?");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regPassword.trim()) {
      setRegError("Username and password are required");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters");
      return;
    }
    setRegLoading(true);
    setRegError("");
    setRegSuccess("");
    try {
      await piPost("/api/auth/register", {
        username: regUsername.trim(),
        password: regPassword,
      });
      setRegSuccess("Account created! You can now sign in.");
      setActiveTab("signin");
      setUsername(regUsername.trim());
      setRegUsername("");
      setRegPassword("");
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>IRIS</Text>
        <Text style={styles.subtitle}>Integrated Recognition & Intrusion System</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "signin" && styles.tabActive]}
          onPress={() => setActiveTab("signin")}
        >
          <Text style={[styles.tabText, activeTab === "signin" && styles.tabTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "signup" && styles.tabActive]}
          onPress={() => setActiveTab("signup")}
        >
          <Text style={[styles.tabText, activeTab === "signup" && styles.tabTextActive]}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "signin" ? (
        <>
          {regSuccess ? <Text style={styles.success}>{regSuccess}</Text> : null}
          <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6b7280" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#6b7280" value={password} onChangeText={setPassword} secureTextEntry />
          {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
          <TouchableOpacity style={[styles.button, loginLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={loginLoading}>
            {loginLoading ? <ActivityIndicator color="#030712" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Username (min 3 chars)" placeholderTextColor="#6b7280" value={regUsername} onChangeText={setRegUsername} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Password (min 6 chars)" placeholderTextColor="#6b7280" value={regPassword} onChangeText={setRegPassword} secureTextEntry />
          {regError ? <Text style={styles.error}>{regError}</Text> : null}
          <TouchableOpacity style={[styles.button, regLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={regLoading}>
            {regLoading ? <ActivityIndicator color="#030712" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.setupLink} onPress={() => navigation.navigate("Setup")}>
        <Text style={styles.setupLinkText}>Change Pi connection</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { padding: 24, paddingTop: 80 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { color: "#22d3ee", fontSize: 32, fontWeight: "800", letterSpacing: 6 },
  subtitle: { color: "#6b7280", fontSize: 13, marginTop: 8, textAlign: "center" },
  tabs: { flexDirection: "row", marginBottom: 24, gap: 8 },
  tab: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#1f2937", alignItems: "center" },
  tabActive: { backgroundColor: "#22d3ee" },
  tabText: { color: "#9ca3af", fontWeight: "600" },
  tabTextActive: { color: "#030712" },
  input: { backgroundColor: "#1f2937", borderRadius: 8, padding: 14, color: "#e5e7eb", fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: "#374151" },
  button: { backgroundColor: "#22d3ee", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#030712", fontWeight: "700", fontSize: 16 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8, textAlign: "center" },
  success: { color: "#4ade80", fontSize: 13, marginBottom: 8, textAlign: "center" },
  setupLink: { alignItems: "center", marginTop: 24, padding: 12 },
  setupLinkText: { color: "#6b7280", fontSize: 13 },
});
