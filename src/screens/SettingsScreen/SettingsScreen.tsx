import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { piGet, piPut } from "../../lib/pi";
import type { SystemConfig, SystemStatus } from "../../types/iris";

export default function SettingsScreen() {
  const { logout, session, activeDevice } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const [configData, statusData] = await Promise.all([
        piGet<SystemConfig>("/api/system/config", session?.username),
        piGet<SystemStatus>("/api/system/status", session?.username),
      ]);
      setConfig(configData);
      setStatus(statusData);
    } catch {
      Alert.alert("Error", "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchConfig();
    }, [fetchConfig])
  );

  const updateField = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await piPut("/api/system/config", config, session?.username);
      setDirty(false);
      Alert.alert("Saved", "Settings updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (newMode: "home" | "away") => {
    if (!status || status.mode === newMode) return;
    try {
      await piPut("/api/system/mode", { mode: newMode }, session?.username);
      setStatus({ ...status, mode: newMode });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to change mode");
    }
  };

  if (loading || !config) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const initials = (session?.username ?? "SW").slice(0, 2).toUpperCase();
  const role = session?.role?.replace(/_/g, " ") ?? "Admin";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>Configure your security system</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>{initials}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.profileName}>{session?.username ?? "SecureWatch User"}</Text>
          <Text style={styles.profileMeta}>
            {role} - {activeDevice?.name ?? "Front Door Camera"}
          </Text>
        </View>
        <Text style={styles.chevron}>{">"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconPurple]}>
                <Text style={[styles.settingIconText, styles.iconPurpleText]}>BL</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Receive alerts on your device</Text>
              </View>
            </View>
            <Switch
              value={config.notifications_enabled}
              onValueChange={(v) => updateField("notifications_enabled", v)}
              trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingRow, styles.rowLast]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconOrange]}>
                <Text style={[styles.settingIconText, styles.iconOrangeText]}>SN</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Include Snapshot</Text>
                <Text style={styles.settingDesc}>Attach images to alarms</Text>
              </View>
            </View>
            <Switch
              value={config.include_snapshot_in_alerts}
              onValueChange={(v) => updateField("include_snapshot_in_alerts", v)}
              trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detection</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconBlue]}>
                <Text style={[styles.settingIconText, styles.iconBlueText]}>MD</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Motion Detection</Text>
                <Text style={styles.settingDesc}>Area threshold</Text>
              </View>
            </View>
            <TextInput
              style={styles.numInput}
              keyboardType="numeric"
              value={String(config.motion_area_threshold)}
              onChangeText={(v) => updateField("motion_area_threshold", Number(v) || 0)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconSlate]}>
                <Text style={[styles.settingIconText, styles.iconSlateText]}>CD</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Cooldown</Text>
                <Text style={styles.settingDesc}>Seconds between detections</Text>
              </View>
            </View>
            <TextInput
              style={styles.numInput}
              keyboardType="numeric"
              value={String(config.detection_cooldown_seconds)}
              onChangeText={(v) => updateField("detection_cooldown_seconds", Number(v) || 0)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconPurple]}>
                <Text style={[styles.settingIconText, styles.iconPurpleText]}>FR</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Face Recognition Tolerance</Text>
                <Text style={styles.settingDesc}>Match accuracy threshold</Text>
              </View>
            </View>
            <TextInput
              style={styles.numInput}
              keyboardType="decimal-pad"
              value={String(config.face_recognition_tolerance)}
              onChangeText={(v) => updateField("face_recognition_tolerance", parseFloat(v) || 0)}
            />
          </View>

          <View style={[styles.settingRow, styles.rowLast]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconRed]}>
                <Text style={[styles.settingIconText, styles.iconRedText]}>AD</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Alarm Delay</Text>
                <Text style={styles.settingDesc}>Escalation delay in seconds</Text>
              </View>
            </View>
            <TextInput
              style={styles.numInput}
              keyboardType="numeric"
              value={String(config.alarm_escalation_delay)}
              onChangeText={(v) => updateField("alarm_escalation_delay", Number(v) || 0)}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconSlate]}>
                <Text style={[styles.settingIconText, styles.iconSlateText]}>MO</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Security Mode</Text>
                <Text style={styles.settingDesc}>
                  {status?.mode === "home" ? "Home mode logs silently" : "Away mode triggers alarms"}
                </Text>
              </View>
            </View>
            <View style={styles.inlineToggle}>
              <TouchableOpacity
                style={[styles.modeButton, status?.mode === "home" && styles.modeButtonActive]}
                onPress={() => void handleModeChange("home")}
              >
                <Text style={[styles.modeText, status?.mode === "home" && styles.modeTextActive]}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, status?.mode === "away" && styles.modeButtonActive]}
                onPress={() => void handleModeChange("away")}
              >
                <Text style={[styles.modeText, status?.mode === "away" && styles.modeTextActive]}>Away</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.settingRow, styles.rowLast]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconGreen]}>
                <Text style={[styles.settingIconText, styles.iconGreenText]}>BZ</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingLabel}>Buzzer Enabled</Text>
                <Text style={styles.settingDesc}>Local alarm sound</Text>
              </View>
            </View>
            <Switch
              value={config.buzzer_enabled}
              onValueChange={(v) => updateField("buzzer_enabled", v)}
              trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      {dirty && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity style={[styles.settingRow, styles.rowLast]} onPress={logout}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, styles.iconRed]}>
                <Text style={[styles.settingIconText, styles.iconRedText]}>LO</Text>
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.logoutLabel}>Log Out</Text>
                <Text style={styles.settingDesc}>Sign out of your account</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dangerCard}>
        <View style={[styles.settingIcon, styles.iconRed]}>
          <Text style={[styles.settingIconText, styles.iconRedText]}>!</Text>
        </View>
        <View style={styles.settingCopy}>
          <Text style={styles.dangerTitle}>Factory Reset</Text>
          <Text style={styles.settingDesc}>Erase all data and settings from the device</Text>
        </View>
      </View>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>SecureWatch v2.1.0</Text>
        <Text style={styles.versionText}>2026 Security Systems</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 116 },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18 },
  pageTitle: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  pageSubtitle: { color: "#64748b", fontSize: 14, marginTop: 3 },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  profileText: { flex: 1 },
  profileName: { color: "#0f172a", fontSize: 18, fontWeight: "800", textTransform: "capitalize" },
  profileMeta: { color: "#475569", fontSize: 13, marginTop: 4, textTransform: "capitalize" },
  chevron: { color: "#94a3b8", fontSize: 30, fontWeight: "300" },
  section: { marginHorizontal: 20, marginBottom: 18 },
  sectionTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  groupCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  settingRow: {
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  settingInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  settingCopy: { flex: 1 },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  settingIconText: { fontSize: 12, fontWeight: "900" },
  iconPurple: { backgroundColor: "#f3e8ff" },
  iconPurpleText: { color: "#9333ea" },
  iconOrange: { backgroundColor: "#ffedd5" },
  iconOrangeText: { color: "#ea580c" },
  iconBlue: { backgroundColor: "#dbeafe" },
  iconBlueText: { color: "#2563eb" },
  iconSlate: { backgroundColor: "#f1f5f9" },
  iconSlateText: { color: "#475569" },
  iconRed: { backgroundColor: "#fee2e2" },
  iconRedText: { color: "#dc2626" },
  iconGreen: { backgroundColor: "#dcfce7" },
  iconGreenText: { color: "#16a34a" },
  settingLabel: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  settingDesc: { color: "#64748b", fontSize: 12, marginTop: 3 },
  numInput: {
    minWidth: 78,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    fontSize: 14,
    textAlign: "right",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inlineToggle: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 3,
  },
  modeButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  modeButtonActive: { backgroundColor: "#2563eb" },
  modeText: { color: "#64748b", fontSize: 12, fontWeight: "800" },
  modeTextActive: { color: "#ffffff" },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 18,
    elevation: 4,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: "#f8fafc", fontWeight: "800", fontSize: 16 },
  logoutLabel: { color: "#dc2626", fontSize: 15, fontWeight: "800" },
  dangerCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  dangerTitle: { color: "#dc2626", fontSize: 15, fontWeight: "800" },
  versionInfo: { alignItems: "center", marginTop: 28, gap: 4 },
  versionText: { color: "#94a3b8", fontSize: 12 },
});
