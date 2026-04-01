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
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [selected, setSelected] = useState<InvitedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const data = await piGet<InvitedUser[]>("/api/auth/invited");
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

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
      await piPut(`/api/auth/invite/${selected.username}/permissions`, selected.permissions);
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
        <ActivityIndicator color="#22d3ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trusted Users</Text>
        <TouchableOpacity onPress={() => navigation.navigate("FacialRegistration")}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
                    trackColor={{ true: "#22d3ee", false: "#374151" }}
                    thumbColor="#e5e7eb"
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={savePermissions}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#030712" /> : <Text style={styles.saveText}>Save</Text>}
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
  container: { flex: 1, backgroundColor: "#030712" },
  centered: { flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { color: "#e5e7eb", fontSize: 20, fontWeight: "700" },
  addText: { color: "#22d3ee", fontSize: 15, fontWeight: "600" },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginBottom: 8 },
  emptyText: { color: "#6b7280", textAlign: "center", paddingTop: 40, paddingHorizontal: 20, fontSize: 14 },
  splitView: { flex: 1 },
  userList: { maxHeight: 280 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  userRowSelected: { backgroundColor: "#1f2937" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#22d3ee", fontWeight: "700", fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  userRole: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  permissionsPanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  permTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "700", marginBottom: 16 },
  permRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  permLabel: { color: "#e5e7eb", fontSize: 14 },
  saveButton: {
    backgroundColor: "#22d3ee",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { color: "#030712", fontWeight: "700", fontSize: 15 },
  selectHint: { color: "#6b7280", textAlign: "center", paddingTop: 40, fontSize: 14 },
});
