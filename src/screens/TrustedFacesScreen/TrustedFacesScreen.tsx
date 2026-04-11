import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { piGet, piPut } from "../../lib/pi";
import { useAuth } from "../../context/AuthContext";
import type { InvitedUser, PermissionSet } from "../../types/iris";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PERMISSION_LABELS: Array<{ key: keyof PermissionSet; label: string }> = [
  { key: "can_view_events", label: "View Events" },
  { key: "can_silence_alarm", label: "Silence Alarm" },
  { key: "can_change_mode", label: "Change Mode" },
  { key: "can_manage_profiles", label: "Manage Profiles" },
];

export default function TrustedFacesScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [selected, setSelected] = useState<InvitedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const data = await piGet<InvitedUser[]>("/api/auth/invited", session?.username);
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchUsers();
    }, [fetchUsers])
  );

  const togglePermission = (key: keyof PermissionSet) => {
    if (!selected || !selected.permissions) return;
    setSelected({
      ...selected,
      permissions: {
        ...selected.permissions,
        [key]: !selected.permissions[key],
      },
    });
  };

  const savePermissions = async () => {
    if (!selected || !selected.permissions) return;
    setSaving(true);
    try {
      await piPut(`/api/auth/invite/${selected.username}/permissions`, selected.permissions, session?.username);
      setUsers((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, permissions: selected.permissions } : u))
      );
      Alert.alert("Saved", "Permissions updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trusted Users</Text>
          <Text style={styles.subtitle}>Users paired with your devices</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("FacialRegistration")}>
          <Text style={styles.addText}>+</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Text style={styles.summaryIconText}>US</Text>
        </View>
        <View>
          <Text style={styles.summaryValue}>{users.length}</Text>
          <Text style={styles.summaryLabel}>Total Users</Text>
        </View>
      </View>

      {users.length === 0 ? (
        <Text style={styles.emptyText}>No invited users. Invite homeowners from the admin panel.</Text>
      ) : (
        <View style={styles.splitView}>
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            style={styles.userList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.userRow, selected?.id === item.id && styles.userRowSelected]}
                onPress={() => setSelected(item)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.username}</Text>
                  <Text style={styles.userRole}>{item.role}</Text>
                </View>
              </TouchableOpacity>
            )}
          />

          {selected && selected.permissions ? (
            <View style={styles.permissionsPanel}>
              <Text style={styles.permTitle}>Permissions for {selected.username}</Text>
              {PERMISSION_LABELS.map(({ key, label }) => (
                <View key={key} style={styles.permRow}>
                  <Text style={styles.permLabel}>{label}</Text>
                  <Switch
                    value={selected.permissions![key]}
                    onValueChange={() => togglePermission(key)}
                    trackColor={{ true: "#2563eb", false: "#cbd5e1" }}
                    thumbColor="#0f172a"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={savePermissions}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#f8fafc" /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.permissionsPanel}>
              <Text style={styles.selectHint}>Select a user to manage permissions</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 14, marginTop: 3 },
  addText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "600",
    backgroundColor: "#2563eb",
    width: 52,
    height: 52,
    lineHeight: 48,
    textAlign: "center",
    borderRadius: 18,
    overflow: "hidden",
  },
  error: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 8 },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: "#eef6ff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    elevation: 4,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryIconText: { color: "#2563eb", fontWeight: "900" },
  summaryValue: { color: "#0f172a", fontSize: 24, fontWeight: "900" },
  summaryLabel: { color: "#64748b", fontSize: 13 },
  emptyText: { color: "#64748b", textAlign: "center", paddingTop: 40, paddingHorizontal: 20, fontSize: 14 },
  splitView: { flex: 1, paddingBottom: 116 },
  userList: { maxHeight: 280 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  userRowSelected: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { color: "#0f172a", fontSize: 15, fontWeight: "600" },
  userRole: { color: "#64748b", fontSize: 12, marginTop: 2 },
  permissionsPanel: {
    flex: 1,
    marginHorizontal: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
  },
  permTitle: { color: "#0f172a", fontSize: 16, fontWeight: "700", marginBottom: 16 },
  permRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  permLabel: { color: "#0f172a", fontSize: 14 },
  saveButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: "#f8fafc", fontWeight: "700", fontSize: 15 },
  selectHint: { color: "#64748b", textAlign: "center", paddingTop: 40, fontSize: 14 },
});
