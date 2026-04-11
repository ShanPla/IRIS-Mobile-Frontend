import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { piGet, piPost } from "../../lib/pi";

interface PairedUser {
  id: number;
  user_id: number;
  username: string;
  role: string;
  paired_at: string;
  last_active: string;
}

interface SystemStats {
  total_users: number;
  admin_count: number;
  homeowner_count: number;
  invited_count: number;
  paired_devices: number;
  total_events: number;
  total_faces: number;
  device_id: string;
  device_name: string;
}

interface ResetResult {
  events_deleted: number;
  faces_deleted: number;
  users_deleted: number;
  snapshots_cleared: boolean;
  config_reset: boolean;
}

export default function AdminScreen() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [pairedUsers, setPairedUsers] = useState<PairedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [statsData, usersData] = await Promise.all([
        piGet<SystemStats>("/api/admin/stats"),
        piGet<PairedUser[]>("/api/admin/paired-users"),
      ]);
      setStats(statsData);
      setPairedUsers(usersData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(true);
  };

  const handleFactoryReset = () => {
    Alert.alert(
      "Factory Reset",
      "This will permanently delete:\n\n" +
        "- All security events & snapshots\n" +
        "- All face profiles & images\n" +
        "- All non-admin user accounts\n" +
        "- All device pairings\n" +
        "- Reset system config to defaults\n\n" +
        "Admin accounts will be preserved.\n\n" +
        "This action CANNOT be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: confirmReset,
        },
      ],
    );
  };

  const confirmReset = () => {
    Alert.alert(
      "Are you absolutely sure?",
      "Type-level confirmation: all data will be wiped from this Pi.",
      [
        { text: "No, go back", style: "cancel" },
        {
          text: "Yes, factory reset",
          style: "destructive",
          onPress: executeReset,
        },
      ],
    );
  };

  const executeReset = async () => {
    setResetting(true);
    try {
      const result = await piPost<ResetResult>("/api/admin/factory-reset");
      Alert.alert(
        "Factory Reset Complete",
        `Deleted:\n` +
          `- ${result.events_deleted} events\n` +
          `- ${result.faces_deleted} face profiles\n` +
          `- ${result.users_deleted} user accounts\n` +
          `- Snapshots cleared: ${result.snapshots_cleared ? "Yes" : "No"}\n` +
          `- Config reset: ${result.config_reset ? "Yes" : "No"}`,
      );
      void loadData();
    } catch (e) {
      Alert.alert("Reset Failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "homeowner_primary": return "Primary";
      case "homeowner_invited": return "Invited";
      default: return role;
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "#f59e0b";
      case "homeowner_primary": return "#2563eb";
      case "homeowner_invited": return "#7c3aed";
      default: return "#64748b";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" size="large" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
      }
    >
      <Text style={styles.title}>Admin Panel</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Device Info */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Info</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Device ID</Text>
            <Text style={styles.value}>{stats.device_id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Device Name</Text>
            <Text style={styles.value}>{stats.device_name}</Text>
          </View>
        </View>
      )}

      {/* System Stats */}
      {stats && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Stats</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Users" value={stats.total_users} />
            <StatBox label="Admins" value={stats.admin_count} />
            <StatBox label="Primary" value={stats.homeowner_count} />
            <StatBox label="Invited" value={stats.invited_count} />
            <StatBox label="Paired" value={stats.paired_devices} />
            <StatBox label="Events" value={stats.total_events} />
            <StatBox label="Faces" value={stats.total_faces} />
          </View>
        </View>
      )}

      {/* Paired Users */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Paired Users ({pairedUsers.length})
        </Text>
        {pairedUsers.length === 0 ? (
          <Text style={styles.emptyText}>No users have paired with this Pi yet.</Text>
        ) : (
          pairedUsers.map((u) => (
            <View key={u.id} style={styles.userRow}>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.username}>{u.username}</Text>
                  <View style={[styles.badge, { backgroundColor: roleBadgeColor(u.role) }]}>
                    <Text style={styles.badgeText}>{roleLabel(u.role)}</Text>
                  </View>
                </View>
                <Text style={styles.userMeta}>
                  Paired: {formatDate(u.paired_at)}
                </Text>
                <Text style={styles.userMeta}>
                  Last active: {formatDate(u.last_active)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Factory Reset */}
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.cardTitle}>Danger Zone</Text>
        <Text style={styles.dangerText}>
          Factory reset will permanently delete all events, face profiles,
          non-admin users, and reset system configuration.
        </Text>
        <TouchableOpacity
          style={[styles.resetButton, resetting && styles.resetButtonDisabled]}
          onPress={handleFactoryReset}
          disabled={resetting}
        >
          {resetting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.resetButtonText}>Factory Reset</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 116 },
  center: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#64748b", marginTop: 12, fontSize: 13 },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20,
  },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 12 },

  // Cards
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  // Key-value rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
  },
  label: { color: "#475569", fontSize: 13 },
  value: { color: "#0f172a", fontSize: 13, fontWeight: "600" },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 72,
  },
  statValue: { color: "#2563eb", fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#475569", fontSize: 11, marginTop: 2 },

  // Paired users
  userRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  username: { color: "#0f172a", fontSize: 15, fontWeight: "600" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: "#f8fafc", fontSize: 10, fontWeight: "700" },
  userMeta: { color: "#64748b", fontSize: 12 },
  emptyText: { color: "#64748b", fontSize: 13, fontStyle: "italic" },

  // Danger zone
  dangerCard: { borderColor: "#fecaca" },
  dangerText: { color: "#475569", fontSize: 13, marginBottom: 14, lineHeight: 18 },
  resetButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  resetButtonDisabled: { opacity: 0.5 },
  resetButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
