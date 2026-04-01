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
  const { logout } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const [configData, statusData] = await Promise.all([
        piGet<SystemConfig>("/api/system/config"),
        piGet<SystemStatus>("/api/system/status"),
      ]);
      setConfig(configData);
      setStatus(statusData);
    } catch {
      Alert.alert("Error", "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

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
      await piPut("/api/system/config", config);
      setDirty(false);
      Alert.alert("Saved", "Settings updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAlarmToggle = async () => {
    if (!status) return;
    try {
      await piPut("/api/system/alarm", { active: !status.alarm_active });
      setStatus({ ...status, alarm_active: !status.alarm_active });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to toggle alarm");
    }
  };

  if (loading || !config) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#22d3ee" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alarm</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Alarm Active</Text>
          <Switch
            value={status?.alarm_active ?? false}
            onValueChange={handleAlarmToggle}
            trackColor={{ true: "#f87171", false: "#374151" }}
            thumbColor="#e5e7eb"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detection</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Motion Threshold</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="numeric"
            value={String(config.motion_area_threshold)}
            onChangeText={(v) => updateField("motion_area_threshold", Number(v) || 0)}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Cooldown (seconds)</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="numeric"
            value={String(config.detection_cooldown_seconds)}
            onChangeText={(v) => updateField("detection_cooldown_seconds", Number(v) || 0)}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Face Tolerance</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="decimal-pad"
            value={String(config.face_recognition_tolerance)}
            onChangeText={(v) => updateField("face_recognition_tolerance", parseFloat(v) || 0)}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Alarm Delay (seconds)</Text>
          <TextInput
            style={styles.numInput}
            keyboardType="numeric"
            value={String(config.alarm_escalation_delay)}
            onChangeText={(v) => updateField("alarm_escalation_delay", Number(v) || 0)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Push Notifications</Text>
          <Switch
            value={config.notifications_enabled}
            onValueChange={(v) => updateField("notifications_enabled", v)}
            trackColor={{ true: "#22d3ee", false: "#374151" }}
            thumbColor="#e5e7eb"
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Include Snapshot</Text>
          <Switch
            value={config.include_snapshot_in_alerts}
            onValueChange={(v) => updateField("include_snapshot_in_alerts", v)}
            trackColor={{ true: "#22d3ee", false: "#374151" }}
            thumbColor="#e5e7eb"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hardware</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Buzzer Enabled</Text>
          <Switch
            value={config.buzzer_enabled}
            onValueChange={(v) => updateField("buzzer_enabled", v)}
            trackColor={{ true: "#22d3ee", false: "#374151" }}
            thumbColor="#e5e7eb"
          />
        </View>
      </View>

      {dirty && (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#030712" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" },
  pageTitle: { color: "#e5e7eb", fontSize: 20, fontWeight: "700", paddingHorizontal: 20, paddingTop: 60 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { color: "#22d3ee", fontSize: 14, fontWeight: "700", marginBottom: 12, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  label: { color: "#e5e7eb", fontSize: 14 },
  numInput: {
    backgroundColor: "#1f2937",
    color: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 14,
    width: 80,
    textAlign: "right",
    borderWidth: 1,
    borderColor: "#374151",
  },
  saveButton: {
    backgroundColor: "#22d3ee",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: "#030712", fontWeight: "700", fontSize: 16 },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f87171",
    alignItems: "center",
  },
  logoutText: { color: "#f87171", fontWeight: "600", fontSize: 15 },
});
