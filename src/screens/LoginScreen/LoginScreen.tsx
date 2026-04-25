import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Eye, EyeOff, Lock, Mail, Shield, User } from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

type InputRowProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: "user" | "mail" | "lock";
  secureTextEntry?: boolean;
  toggleSecure?: () => void;
  keyboardType?: "default" | "email-address";
  onSubmitEditing?: () => void;
};

function InputRow({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  toggleSecure,
  keyboardType = "default",
  onSubmitEditing,
}: InputRowProps) {
  const Icon = icon === "mail" ? Mail : icon === "lock" ? Lock : User;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon size={18} color="#94a3b8" strokeWidth={2.2} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          returnKeyType={onSubmitEditing ? "done" : "next"}
          onSubmitEditing={onSubmitEditing}
        />
        {toggleSecure ? (
          <TouchableOpacity style={styles.iconButton} onPress={toggleSecure}>
            {secureTextEntry ? <Eye size={18} color="#94a3b8" /> : <EyeOff size={18} color="#94a3b8" />}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const { login, register } = useAuth();
  const layout = useScreenLayout({ bottom: "stack", centered: true });
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLoginError("Username and password are required");
      return;
    }

    setLoginLoading(true);
    setLoginError("");
    try {
      await login(username.trim(), password);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed. Please try again.");
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
      setRegSuccess("Account created. Signing you in...");
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  const isSignIn = activeTab === "signin";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ReferenceBackdrop />
          <Animated.ScrollView
            style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
            contentContainerStyle={[styles.content, layout.contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Shield size={32} color={referenceColors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.brandTitle}>I.R.I.S</Text>
              <Text style={styles.brandSubtitle}>
                {isSignIn ? "Sign in to your account" : "Create your I.R.I.S account"}
              </Text>
            </View>

            <View style={styles.card}>
              {regSuccess && isSignIn ? <Text style={styles.success}>{regSuccess}</Text> : null}

              {isSignIn ? (
                <>
                  <InputRow
                    label="Username"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="your username"
                    icon="user"
                  />
                  <InputRow
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    icon="lock"
                    secureTextEntry={!showPassword}
                    toggleSecure={() => setShowPassword((value) => !value)}
                    onSubmitEditing={() => void handleLogin()}
                  />
                  <Text style={styles.passwordNote}>
                    Passwords are not saved on this phone. Ask an administrator to reset a forgotten password.
                  </Text>
                  {loginError ? <Text style={styles.error}>{loginError}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryButtonWrap, loginLoading && styles.buttonDisabled]}
                    onPress={() => void handleLogin()}
                    disabled={loginLoading}
                    activeOpacity={0.9}
                  >
                    <View style={styles.primaryButton}>
                      {loginLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <InputRow
                    label="Username"
                    value={regUsername}
                    onChangeText={setRegUsername}
                    placeholder="Username (min 3 chars)"
                    icon="user"
                  />
                  <InputRow
                    label="Gmail"
                    value={regEmail}
                    onChangeText={setRegEmail}
                    placeholder="your@gmail.com"
                    icon="mail"
                    keyboardType="email-address"
                  />
                  <InputRow
                    label="Password"
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder="Password (min 6 chars)"
                    icon="lock"
                    secureTextEntry={!showRegPassword}
                    toggleSecure={() => setShowRegPassword((value) => !value)}
                    onSubmitEditing={() => void handleRegister()}
                  />
                  {regError ? <Text style={styles.error}>{regError}</Text> : null}
                  {regSuccess ? <Text style={styles.success}>{regSuccess}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryButtonWrap, regLoading && styles.buttonDisabled]}
                    onPress={() => void handleRegister()}
                    disabled={regLoading}
                    activeOpacity={0.9}
                  >
                    <View style={styles.primaryButton}>
                      {regLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Create Account</Text>}
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {isSignIn ? "Don't have an account?" : "Already have an account?"}
                </Text>
                <TouchableOpacity onPress={() => setActiveTab(isSignIn ? "signup" : "signin")}>
                  <Text style={styles.switchLink}>{isSignIn ? "Sign up" : "Sign in"}</Text>
                </TouchableOpacity>
              </View>

            </View>
          </Animated.ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 52,
  },
  brand: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...buttonShadow,
  },
  brandTitle: {
    color: referenceColors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 15,
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 28,
    padding: 22,
    ...cardShadow,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "rgba(248,250,252,0.88)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  input: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordNote: {
    color: referenceColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
    marginBottom: 10,
    textAlign: "right",
  },
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  success: {
    color: referenceColors.success,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  primaryButtonWrap: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 4,
    ...buttonShadow,
  },
  primaryButton: {
    minHeight: 58,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    flexWrap: "wrap",
  },
  switchText: {
    color: referenceColors.textMuted,
    fontSize: 13,
  },
  switchLink: {
    color: referenceColors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
