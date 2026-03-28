import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../../lib/api";
import type { FaceProfile } from "../../types/iris";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Permissions {
  switching_modes: boolean;
  enable_disable_camera: boolean;
  alert_and_record: boolean;
}

interface UserWithPermissions extends FaceProfile {
  status: "active" | "inactive";
  permissions: Permissions;
}

const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  switching_modes: "Switching Modes",
  enable_disable_camera: "Enable/Disable Camera",
  alert_and_record: "Alert and Record",
};

export default function TrustedFacesScreen() {
  const navigation = useNavigation<Nav>();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [selected, setSelected] = useState<UserWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadProfiles(); }, []);

  const loadProfiles = async () => {
    setError("");
    try {
      const response = await apiClient.get<FaceProfile[]>("/api/faces/");
      const mapped: UserWithPermissions[] = response.data.map((p, i) => ({
        ...p,
        status: i % 2 === 0 ? "active" : "inactive",
        permissions: {
          switching_modes: true,
          enable_disable_camera: false,
          alert_and_record: true,
        },
      }));
      setUsers(mapped);
      if (mapped.length > 0) setSelected(mapped[0]);
    } catch {
      setError("Failed to load profiles.");
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (key: keyof Permissions) => {
    if (!selected) return;
    const updated = {
      ...selected,
      permissions: { ...selected.permissions, [key]: !selected.permissions[key] },
    };
    setSelected(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: connect to backend permission endpoint
    setTimeout(() => setSaving(false), 800);
  };

  const renderPermissionsSection = (user: UserWithPermissions | null) => (
    <View style={styles.selectedSection}>
      <Text style={styles.selectedLabel}>Selected User:</Text>
      <View style={styles.selectedUser}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>👤</Text>
        </View>
        <Text style={[styles.selectedUserName, !user && { color: "#4b5563" }]}>
          {user ? user.name : "No user"}
        </Text>
        <View style={[
          styles.statusDot,
          { backgroundColor: user ? (user.status === "active" ? "#4ade80" : "#f87171") : "#374151" }
        ]} />
      </View>

      {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((key) => (
        <TouchableOpacity
          key={key}
          style={styles.permissionRow}
          onPress={() => user && togglePermission(key)}
          disabled={!user}
        >
          <View style={[
            styles.checkbox,
            user && user.permissions[key] && styles.checkboxChecked
          ]}>
            {user && user.permissions[key] && (
              <Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>✓</Text>
            )}
          </View>
          <Text style={[styles.permissionLabel, !user && { color: "#4b5563" }]}>
            {PERMISSION_LABELS[key]}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.saveBtn, !user && { opacity: 0.4 }]}
        onPress={() => user && void handleSave()}
        disabled={!user || saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trusted Users</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("FacialRegistration")}
        >
          <Text style={styles.addBtnText}>Add New Face</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {users.length === 0 ? (
            <>
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}>
                <Text style={{ fontSize: 40 }}>👥</Text>
                <Text style={styles.empty}>No trusted faces registered yet.</Text>
                <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>
                  Tap "Add New Face" to register an authorized person.
                </Text>
              </View>
              {renderPermissionsSection(null)}
            </>
          ) : (
            <>
              <View style={styles.userList}>
                {users.map((user, index) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userRow,
                      selected?.id === user.id && styles.userRowSelected,
                      index === users.length - 1 && styles.userRowLast,
                    ]}
                    onPress={() => setSelected(user)}
                  >
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>👤</Text>
                    </View>
                    <Text style={styles.userName}>{user.name}</Text>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: user.status === "active" ? "#4ade80" : "#f87171" }
                    ]} />
                  </TouchableOpacity>
                ))}
              </View>
              {renderPermissionsSection(selected)}
            </>
          )}

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.statusDot, { backgroundColor: "#4ade80" }]} />
              <Text style={styles.legendText}>active/viewing</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.statusDot, { backgroundColor: "#f87171" }]} />
              <Text style={styles.legendText}>inactive/offline</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}