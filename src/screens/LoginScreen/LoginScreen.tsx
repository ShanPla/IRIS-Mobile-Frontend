import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../lib/api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  // Sign In state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign Up state
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLoginError("Username and password are required.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    const success = await login(username, password);
    setLoginLoading(false);
    if (!success) {
      setLoginError("Login failed. Check your credentials.");
    }
    // RootNavigator auto-switches to Main when session is set
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regPassword.trim() || !regEmail.trim()) {
      setRegError("Username, password, and email are required.");
      return;
    }
    setRegLoading(true);
    setRegError("");
    setRegSuccess("");
    try {
      await apiClient.post("/api/auth/register", {
        username: regUsername.trim(),
        password: regPassword,
        email: regEmail.trim(),
        phone: regPhone.trim() || null,
      });
      setRegSuccess("Account created! You can now sign in.");
      setRegUsername("");
      setRegPassword("");
      setRegEmail("");
      setRegPhone("");
      setTimeout(() => {
        setActiveTab("signin");
        setRegSuccess("");
      }, 2000);
    } catch {
      setRegError("Registration failed. Ask your admin to create your account.");
    } finally {
      setRegLoading(false);
    }
  };

  return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.logo}>IRIS</Text>
            <Text style={styles.subtitle}>Integrated Recognition for Intrusion System</Text>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "signin" && styles.tabActive]}
                onPress={() => { setActiveTab("signin"); setLoginError(""); }}
              >
                <Text style={[styles.tabText, activeTab === "signin" && styles.tabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "signup" && styles.tabActive]}
                onPress={() => { setActiveTab("signup"); setRegError(""); setRegSuccess(""); }}
              >
                <Text style={[styles.tabText, activeTab === "signup" && styles.tabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Form */}
            {activeTab === "signin" && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#6b7280"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => void handleLogin()}
                  disabled={loginLoading}
                >
                  {loginLoading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.btnText}>Sign In</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.tempNote}>
                  Temp test account: testuser / test1234
                </Text>
              </>
            )}

            {/* Sign Up Form */}
            {activeTab === "signup" && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#6b7280"
                  value={regUsername}
                  onChangeText={setRegUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#6b7280"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number (optional)"
                  placeholderTextColor="#6b7280"
                  value={regPhone}
                  onChangeText={setRegPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#6b7280"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  secureTextEntry
                />
                {regError ? <Text style={styles.error}>{regError}</Text> : null}
                {regSuccess ? <Text style={styles.success}>{regSuccess}</Text> : null}
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => void handleRegister()}
                  disabled={regLoading}
                >
                  {regLoading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.btnText}>Create Account</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => navigation.replace("Setup")}>
              <Text style={styles.setupLink}>Change backend URL</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
}