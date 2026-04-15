import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ArrowLeft,
  ChevronRight,
  LogOut,
  Smartphone,
} from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { updateStoredAccountPassword } from "../../lib/accounts";
import { getDevices, piPut } from "../../lib/pi";
import type { PiDevice } from "../../lib/pi";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

type Nav = NativeStackNavigationProp<RootStackParamList, "Profile">;

function isPrimaryDevice(device: PiDevice, index: number) {
  if (device.accessRole === "secondary") return false;
  if (device.accessRole === "primary") return true;
  return index === 0;
}

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, logout } = useAuth();
  const [devices, setDevices] = useState<PiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    const storedDevices = await getDevices(session?.username);
    setDevices(storedDevices);
    setLoading(false);
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadProfile();
    }, [loadProfile])
  );

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Missing Details", "Both password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "New password must be at least 6 characters.");
      return;
    }

    setChangingPassword(true);
    setPasswordSuccess("");
    try {
      await piPut<{ ok: boolean; message?: string }>(
        "/api/auth/me/password",
        { current_password: currentPassword, new_password: newPassword },
        session?.username,
      );
      if (session?.username) {
        await updateStoredAccountPassword(session.username, newPassword);
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess("Password updated.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not change password";
      const friendly = message.includes("401") || message.toLowerCase().includes("incorrect")
        ? "Current password is incorrect."
        : message;
      Alert.alert("Password Change Failed", friendly);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ReferenceBackdrop />
        <ActivityIndicator color={referenceColors.primary} />
      </View>
    );
  }

  const username = session?.username ?? "I.R.I.S User";
  const initials = username.slice(0, 2).toUpperCase();
  const primaryCount = devices.filter(isPrimaryDevice).length;
  const secondaryCount = devices.length - primaryCount;

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
            keyboardDismissMode="on-drag"
          >
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("DeviceList")}>
              <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
              <Text style={styles.backText}>Back to Devices</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.pageTitle}>Profile</Text>
              <Text style={styles.pageSubtitle}>Manage your account preferences</Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.username}>{username}</Text>
                <Text style={styles.emailText}>{session?.email || "Email not linked"}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{session?.role?.replace(/_/g, " ") ?? "User"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{primaryCount}</Text>
                <Text style={styles.metricLabel}>Primary</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{secondaryCount}</Text>
                <Text style={styles.metricLabel}>Secondary</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{devices.length}</Text>
                <Text style={styles.metricLabel}>Devices</Text>
              </View>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate("DeviceList")}>
                <Smartphone size={20} color={referenceColors.textSoft} strokeWidth={2.2} />
                <View style={styles.quickCopy}>
                  <Text style={styles.quickTitle}>My Devices</Text>
                  <Text style={styles.quickSubtitle}>Return to device list</Text>
                </View>
                <ChevronRight size={16} color="#94a3b8" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Change Password</Text>

              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor="#94a3b8"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="New password (min 6 chars)"
                placeholderTextColor="#94a3b8"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />

              {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, changingPassword && styles.buttonDisabled]}
                onPress={() => void handlePasswordChange()}
                disabled={changingPassword}
              >
                {changingPassword ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Change Password</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutCard} onPress={logout}>
              <LogOut size={18} color={referenceColors.danger} strokeWidth={2.2} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  backText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    marginBottom: 18,
  },
  pageTitle: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 20,
    ...cardShadow,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: referenceColors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    color: referenceColors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  emailText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    marginTop: 6,
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  roleText: {
    color: referenceColors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingVertical: 16,
    ...cardShadow,
  },
  metricValue: {
    color: referenceColors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  metricLabel: {
    color: referenceColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  quickActions: {
    marginTop: 18,
    gap: 10,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 16,
    ...cardShadow,
  },
  quickCopy: {
    flex: 1,
  },
  quickTitle: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  quickSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 18,
    marginTop: 18,
    ...cardShadow,
  },
  sectionTitle: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: referenceColors.text,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 12,
  },
  success: {
    color: referenceColors.success,
    fontSize: 13,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    ...buttonShadow,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  logoutCard: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,241,242,0.88)",
    borderWidth: 1,
    borderColor: "#fecaca",
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...cardShadow,
  },
  logoutText: {
    color: referenceColors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
});
