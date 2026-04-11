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
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
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
      setLoginError("Login failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegError("Username, Gmail, and password are required");
      return;
    }
    if (!regEmail.trim().toLowerCase().endsWith("@gmail.com")) {
      setRegError("Please use a Gmail address");
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
      await register(regUsername.trim(), regEmail.trim(), regPassword);
      setRegSuccess("Account created! Signing you in...");
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>SW</Text>
        </View>
        <Text style={styles.logo}>SecureWatch</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.card}>
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
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput style={styles.input} placeholder="your username" placeholderTextColor="#94a3b8" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
            {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
            <TouchableOpacity style={[styles.button, loginLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={loginLoading}>
              {loginLoading ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput style={styles.input} placeholder="Username (min 3 chars)" placeholderTextColor="#94a3b8" value={regUsername} onChangeText={setRegUsername} autoCapitalize="none" />
            <Text style={styles.inputLabel}>Gmail</Text>
            <TextInput style={styles.input} placeholder="your@gmail.com" placeholderTextColor="#94a3b8" value={regEmail} onChangeText={setRegEmail} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput style={styles.input} placeholder="Password (min 6 chars)" placeholderTextColor="#94a3b8" value={regPassword} onChangeText={setRegPassword} secureTextEntry />
            {regError ? <Text style={styles.error}>{regError}</Text> : null}
            <TouchableOpacity style={[styles.button, regLoading && styles.buttonDisabled]} onPress={handleRegister} disabled={regLoading}>
              {regLoading ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.buttonText}>Create Account</Text>}
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.setupLinkText}>Device pairing happens after sign-in.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, paddingVertical: 60 },
  header: { alignItems: "center", marginBottom: 32 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  logoMarkText: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  logo: { color: "#0f172a", fontSize: 32, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 15, marginTop: 8, textAlign: "center" },
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
  tabs: { flexDirection: "row", marginBottom: 24, gap: 8 },
  tab: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center" },
  tabActive: { backgroundColor: "#2563eb" },
  tabText: { color: "#475569", fontWeight: "600" },
  tabTextActive: { color: "#f8fafc" },
  inputLabel: { color: "#334155", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, color: "#0f172a", fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  button: { backgroundColor: "#2563eb", borderRadius: 16, padding: 18, alignItems: "center", marginTop: 8, elevation: 4, shadowColor: "#2563eb", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#f8fafc", fontWeight: "700", fontSize: 16 },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8, textAlign: "center" },
  success: { color: "#16a34a", fontSize: 13, marginBottom: 8, textAlign: "center" },
  setupLinkText: { color: "#64748b", fontSize: 13, textAlign: "center", marginTop: 24 },
});
