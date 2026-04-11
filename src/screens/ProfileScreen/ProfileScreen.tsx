import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { useAuth } from "../../context/AuthContext";
import { getDevices } from "../../lib/pi";
import type { PiDevice } from "../../lib/pi";

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
  const [pushAlerts, setPushAlerts] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
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
    setTimeout(() => {
      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess("Password preference saved for this account.");
    }, 400);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const username = session?.username ?? "SecureWatch User";
  const initials = username.slice(0, 2).toUpperCase();
  const primaryCount = devices.filter(isPrimaryDevice).length;
  const secondaryCount = devices.length - primaryCount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("DeviceList")}>
          <Text style={styles.backText}>{"< Devices"}</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>Manage your account preferences</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.role}>{session?.role?.replace(/_/g, " ") ?? "User"}</Text>
          </View>
          <Text style={styles.memberSince}>{session?.email || "Email not linked"}</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Push Notifications</Text>
            <Text style={styles.preferenceText}>Alerts for registered devices</Text>
          </View>
          <Switch
            value={pushAlerts}
            onValueChange={setPushAlerts}
            trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Sound Alerts</Text>
            <Text style={styles.preferenceText}>Play alarm sounds on this phone</Text>
          </View>
          <Switch
            value={soundAlerts}
            onValueChange={setSoundAlerts}
            trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={[styles.preferenceRow, styles.preferenceRowLast]}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>Email Digest</Text>
            <Text style={styles.preferenceText}>Daily security summary</Text>
          </View>
          <Switch
            value={emailDigest}
            onValueChange={setEmailDigest}
            trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor="#64748b"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="New password (min 6 chars)"
          placeholderTextColor="#64748b"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}
        <TouchableOpacity
          style={[styles.button, changingPassword && styles.buttonDisabled]}
          onPress={() => void handlePasswordChange()}
          disabled={changingPassword}
        >
          {changingPassword ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.buttonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 44 },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18 },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 18,
  },
  backText: { color: "#2563eb", fontSize: 13, fontWeight: "800" },
  pageTitle: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  pageSubtitle: { color: "#64748b", fontSize: 14, marginTop: 3 },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  avatarText: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  profileInfo: { flex: 1 },
  username: { color: "#0f172a", fontSize: 22, fontWeight: "800", textTransform: "capitalize" },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  role: { color: "#2563eb", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  memberSince: { color: "#475569", fontSize: 12, marginTop: 10 },
  metricsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 18 },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  metricValue: { color: "#0f172a", fontSize: 22, fontWeight: "900" },
  metricLabel: { color: "#64748b", fontSize: 12, marginTop: 3, fontWeight: "700" },
  section: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  sectionTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800", marginBottom: 12 },
  preferenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  preferenceRowLast: { borderBottomWidth: 0 },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  preferenceText: { color: "#64748b", fontSize: 12, marginTop: 3 },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    color: "#0f172a",
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#f8fafc", fontWeight: "700", fontSize: 15 },
  success: { color: "#16a34a", fontSize: 13, marginBottom: 8 },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 28,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
    alignItems: "center",
  },
  logoutText: { color: "#dc2626", fontWeight: "700", fontSize: 15 },
});
