import { useEffect, useMemo, useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Eye, EyeOff, Lock, Mail, Shield, User } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { listStoredAccounts, updateStoredAccountPassword } from "../../lib/accounts";
import type { StoredAccountRecovery } from "../../lib/accounts";
import { getPlatformGoogleClientId } from "../../lib/google";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

WebBrowser.maybeCompleteAuthSession();

type Nav = NativeStackNavigationProp<RootStackParamList, "Login">;

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
  const navigation = useNavigation<Nav>();
  const { login, continueWithGoogle, register } = useAuth();
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
  const [googleLoading, setGoogleLoading] = useState(false);

  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryAccounts, setRecoveryAccounts] = useState<StoredAccountRecovery[]>([]);
  const [recoveryQuery, setRecoveryQuery] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState("");
  const [revealedPasswordFor, setRevealedPasswordFor] = useState<string | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<string | null>(null);
  const [newRecoveryPassword, setNewRecoveryPassword] = useState("");
  const [confirmRecoveryPassword, setConfirmRecoveryPassword] = useState("");

  const googlePlatformClientId = getPlatformGoogleClientId();
  const googleClientConfig = useMemo(
    () => ({
      clientId: googlePlatformClientId ?? "missing-google-client-id",
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || undefined,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() || undefined,
      selectAccount: true,
    }),
    [googlePlatformClientId],
  );
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest(
    googleClientConfig,
    {
      scheme: "irismobile",
      path: "oauthredirect",
    },
  );

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
      setRegSuccess("Account created! Signing you in...");
    } catch (e) {
      setRegError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  const setGoogleError = (message: string) => {
    if (activeTab === "signin") {
      setLoginError(message);
      setRegError("");
      return;
    }

    setRegError(message);
    setLoginError("");
  };

  useEffect(() => {
    if (!googleResponse) {
      return;
    }

    if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      setGoogleLoading(false);
      return;
    }

    if (googleResponse.type === "error") {
      setGoogleLoading(false);
      setGoogleError(googleResponse.error?.message ?? "Google sign-in failed");
      return;
    }

    if (googleResponse.type !== "success") {
      return;
    }

    const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;
    if (!idToken) {
      setGoogleLoading(false);
      setGoogleError("Google sign-in did not return an ID token");
      return;
    }

    void (async () => {
      try {
        setLoginError("");
        setRegError("");
        setRegSuccess("");
        await continueWithGoogle(idToken);
      } catch (error) {
        setGoogleError(error instanceof Error ? error.message : "Google sign-in failed");
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse]);

  const openRecovery = async () => {
    setRecoveryVisible(true);
    setRecoveryLoading(true);
    setRecoveryQuery("");
    setRecoveryError("");
    setRecoverySuccess("");
    setRevealedPasswordFor(null);
    setResettingPasswordFor(null);
    setNewRecoveryPassword("");
    setConfirmRecoveryPassword("");
    try {
      const accounts = await listStoredAccounts();
      setRecoveryAccounts(accounts);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const closeRecovery = () => {
    setRecoveryVisible(false);
    setRecoveryQuery("");
    setRecoveryError("");
    setRecoverySuccess("");
    setRevealedPasswordFor(null);
    setResettingPasswordFor(null);
    setNewRecoveryPassword("");
    setConfirmRecoveryPassword("");
  };

  const useRecoveredAccount = (account: StoredAccountRecovery) => {
    setActiveTab("signin");
    setUsername(account.username);
    if (account.provider === "google") {
      setPassword("");
      setShowPassword(false);
      setLoginError("Tap Sign in with Google to continue with this account.");
    } else {
      setPassword(account.password);
      setShowPassword(true);
      setLoginError("");
    }
    closeRecovery();
  };

  const startResetPassword = (usernameToReset: string) => {
    setResettingPasswordFor(usernameToReset);
    setNewRecoveryPassword("");
    setConfirmRecoveryPassword("");
    setRecoveryError("");
    setRecoverySuccess("");
  };

  const saveRecoveredPassword = async (account: StoredAccountRecovery) => {
    if (newRecoveryPassword.length < 6) {
      setRecoveryError("New password must be at least 6 characters");
      return;
    }

    if (newRecoveryPassword !== confirmRecoveryPassword) {
      setRecoveryError("Passwords do not match");
      return;
    }

    try {
      const updatedAccount = await updateStoredAccountPassword(account.username, newRecoveryPassword);

      setRecoveryAccounts((current) =>
        current.map((item) => (item.username === account.username ? updatedAccount : item)),
      );
      setRecoveryError("");
      setRecoverySuccess(`Saved password updated for ${updatedAccount.username}`);
      setRevealedPasswordFor(updatedAccount.username);
      setResettingPasswordFor(null);
      setNewRecoveryPassword("");
      setConfirmRecoveryPassword("");
      setActiveTab("signin");
      setUsername(updatedAccount.username);
      setPassword(updatedAccount.password);
      setShowPassword(true);
      setLoginError("");
    } catch (error) {
      setRecoverySuccess("");
      setRecoveryError(error instanceof Error ? error.message : "Unable to update the saved password");
    }
  };

  const handleGoogleAuth = async () => {
    if (!googlePlatformClientId) {
      setGoogleError("Google sign-in is missing the client ID for this app.");
      return;
    }

    if (!googleRequest) {
      setGoogleError("Google sign-in is still getting ready.");
      return;
    }

    setLoginError("");
    setRegError("");
    setRegSuccess("");
    setGoogleLoading(true);

    try {
      const result = await promptGoogleAsync();
      if (result.type === "cancel" || result.type === "dismiss") {
        setGoogleLoading(false);
      } else if (result.type === "error") {
        setGoogleLoading(false);
        setGoogleError(result.error?.message ?? "Google sign-in failed");
      }
    } catch (error) {
      setGoogleLoading(false);
      setGoogleError(error instanceof Error ? error.message : "Google sign-in failed");
    }
  };

  const isSignIn = activeTab === "signin";
  const normalizedRecoveryQuery = recoveryQuery.trim().toLowerCase();
  const filteredRecoveryAccounts = recoveryAccounts.filter((account) => {
    if (!normalizedRecoveryQuery) {
      return true;
    }

    return (
      account.username.toLowerCase().includes(normalizedRecoveryQuery) ||
      account.email.toLowerCase().includes(normalizedRecoveryQuery)
    );
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ReferenceBackdrop />
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
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
                  <TouchableOpacity style={styles.inlineLinkRow} onPress={() => void openRecovery()}>
                    <Text style={styles.inlineLink}>Forgot username or password?</Text>
                  </TouchableOpacity>
                  {loginError ? <Text style={styles.error}>{loginError}</Text> : null}

                  <TouchableOpacity
                    style={[styles.primaryButtonWrap, loginLoading && styles.buttonDisabled]}
                    onPress={() => void handleLogin()}
                    disabled={loginLoading}
                    activeOpacity={0.9}
                  >
                    <View style={styles.primaryButton}>
                      {loginLoading ? <ActivityIndicator color={referenceColors.primary} /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
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
                      {regLoading ? <ActivityIndicator color={referenceColors.primary} /> : <Text style={styles.primaryButtonText}>Create Account</Text>}
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                onPress={() => void handleGoogleAuth()}
                disabled={googleLoading}
              >
                {googleLoading ? <ActivityIndicator color={referenceColors.primary} /> : <Text style={styles.googleIcon}>G</Text>}
                <Text style={styles.googleText}>{isSignIn ? "Sign in with Google" : "Sign up with Google"}</Text>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {isSignIn ? "Don't have an account?" : "Already have an account?"}
                </Text>
                <TouchableOpacity onPress={() => setActiveTab(isSignIn ? "signup" : "signin")}>
                  <Text style={styles.switchLink}>{isSignIn ? "Sign up" : "Sign in"}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate("Setup")}>
                <Text style={styles.footerLinkText}>Set up a device anytime</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      <Modal visible={recoveryVisible} transparent animationType="fade" onRequestClose={closeRecovery}>
        <TouchableWithoutFeedback onPress={closeRecovery}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => undefined}>
              <KeyboardAvoidingView
                style={styles.modalKeyboardShell}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
              >
                <View style={styles.modalCard}>
                  <ScrollView
                    contentContainerStyle={styles.modalScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.modalTitle}>Recover Account</Text>
                    <Text style={styles.modalSubtitle}>
                      Find any username saved on this phone, reveal the saved password, or update the saved password here.
                    </Text>

                    <View style={styles.recoverySearchShell}>
                      <User size={18} color="#94a3b8" strokeWidth={2.2} />
                      <TextInput
                        style={styles.recoverySearchInput}
                        placeholder="Search username or Gmail"
                        placeholderTextColor="#94a3b8"
                        value={recoveryQuery}
                        onChangeText={setRecoveryQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    {recoveryError ? <Text style={styles.error}>{recoveryError}</Text> : null}
                    {recoverySuccess ? <Text style={styles.success}>{recoverySuccess}</Text> : null}

                    {recoveryLoading ? (
                      <View style={styles.recoveryLoading}>
                        <ActivityIndicator color={referenceColors.primary} />
                      </View>
                    ) : recoveryAccounts.length === 0 ? (
                      <View style={styles.emptyRecoveryCard}>
                        <Text style={styles.emptyRecoveryTitle}>No saved accounts found yet</Text>
                        <Text style={styles.emptyRecoveryText}>
                          Sign up or sign in once on this phone, then you can recover the saved username and password here.
                        </Text>
                      </View>
                    ) : filteredRecoveryAccounts.length === 0 ? (
                      <View style={styles.emptyRecoveryCard}>
                        <Text style={styles.emptyRecoveryTitle}>No saved account matches</Text>
                        <Text style={styles.emptyRecoveryText}>
                          Try a different username or Gmail, or clear the search to see every saved account.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.recoveryList}>
                        {filteredRecoveryAccounts.map((account) => {
                          const showSavedPassword = revealedPasswordFor === account.username;
                          const showResetForm = resettingPasswordFor === account.username;

                          return (
                            <View key={account.username} style={styles.recoveryItem}>
                              <View style={styles.recoveryHeader}>
                                <View style={styles.recoveryCopy}>
                                  <Text style={styles.recoveryUsername}>{account.username}</Text>
                                  <Text style={styles.recoveryMeta}>
                                    {account.email || "No Gmail saved"} | {account.role.replace(/_/g, " ")}
                                    {account.provider === "google" ? " | google" : ""}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.recoveryUseButton}
                                  onPress={() => useRecoveredAccount(account)}
                                >
                                  <Text style={styles.recoveryUseButtonText}>
                                    {account.provider === "google" ? "Google" : "Use"}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {account.provider === "google" ? (
                                <View style={styles.googleRecoveryCard}>
                                  <Text style={styles.googleRecoveryText}>
                                    This saved account signs in with Google. Use the Google button on the main form.
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.recoveryActionRow}>
                                  <TouchableOpacity
                                    style={styles.recoveryRevealButton}
                                    onPress={() =>
                                      setRevealedPasswordFor(showSavedPassword ? null : account.username)
                                    }
                                  >
                                    <Text style={styles.recoveryRevealText}>
                                      {showSavedPassword ? `Password: ${account.password}` : "Show saved password"}
                                    </Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.recoverySecondaryButton}
                                    onPress={() =>
                                      showResetForm ? setResettingPasswordFor(null) : startResetPassword(account.username)
                                    }
                                  >
                                    <Text style={styles.recoverySecondaryButtonText}>
                                      {showResetForm ? "Cancel reset" : "Reset saved password"}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}

                              {showResetForm && account.provider !== "google" ? (
                                <View style={styles.resetCard}>
                                  <Text style={styles.resetTitle}>Update saved password on this phone</Text>
                                  <View style={styles.resetInputShell}>
                                    <Lock size={18} color="#94a3b8" strokeWidth={2.2} />
                                    <TextInput
                                      style={styles.resetInput}
                                      placeholder="New password"
                                      placeholderTextColor="#94a3b8"
                                      secureTextEntry
                                      value={newRecoveryPassword}
                                      onChangeText={setNewRecoveryPassword}
                                      autoCapitalize="none"
                                      autoCorrect={false}
                                    />
                                  </View>
                                  <View style={styles.resetInputShell}>
                                    <Lock size={18} color="#94a3b8" strokeWidth={2.2} />
                                    <TextInput
                                      style={styles.resetInput}
                                      placeholder="Confirm new password"
                                      placeholderTextColor="#94a3b8"
                                      secureTextEntry
                                      value={confirmRecoveryPassword}
                                      onChangeText={setConfirmRecoveryPassword}
                                      autoCapitalize="none"
                                      autoCorrect={false}
                                    />
                                  </View>
                                  <TouchableOpacity
                                    style={styles.resetSaveButton}
                                    onPress={() => void saveRecoveredPassword(account)}
                                  >
                                    <Text style={styles.resetSaveButtonText}>Save password</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <TouchableOpacity style={styles.closeButton} onPress={closeRecovery}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  inlineLinkRow: {
    alignItems: "flex-end",
    marginTop: -2,
    marginBottom: 8,
  },
  inlineLink: {
    color: referenceColors.primary,
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: referenceColors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    color: "#64748b",
    fontSize: 12,
  },
  googleButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleIcon: {
    color: referenceColors.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  googleText: {
    color: referenceColors.textSoft,
    fontSize: 14,
    fontWeight: "600",
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
  footerLink: {
    alignItems: "center",
    marginTop: 14,
  },
  footerLinkText: {
    color: referenceColors.textMuted,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalKeyboardShell: {
    width: "100%",
  },
  modalCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 28,
    padding: 20,
    maxHeight: "88%",
    ...cardShadow,
  },
  modalScrollContent: {
    gap: 14,
  },
  modalTitle: {
    color: referenceColors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  recoverySearchShell: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recoverySearchInput: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 14,
    paddingVertical: 14,
  },
  recoveryLoading: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyRecoveryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  emptyRecoveryTitle: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyRecoveryText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  recoveryList: {
    gap: 12,
  },
  recoveryItem: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  recoveryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recoveryCopy: {
    flex: 1,
  },
  recoveryUsername: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  recoveryMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  recoveryUseButton: {
    backgroundColor: referenceColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  recoveryUseButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  recoveryActionRow: {
    gap: 10,
  },
  googleRecoveryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  googleRecoveryText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  recoveryRevealButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recoveryRevealText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  recoverySecondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: referenceColors.primary,
    backgroundColor: "rgba(37,99,235,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recoverySecondaryButtonText: {
    color: referenceColors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  resetCard: {
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  resetTitle: {
    color: referenceColors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  resetInputShell: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetInput: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 14,
    paddingVertical: 12,
  },
  resetSaveButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  resetSaveButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  closeButton: {
    backgroundColor: referenceColors.text,
    borderRadius: 16,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
