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
      case "homeowner_primary": return "#22d3ee";
      case "homeowner_invited": return "#a78bfa";
      default: return "#6b7280";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22d3ee" size="large" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22d3ee" />
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
  container: { flex: 1, backgroundColor: "#030712" },
  content: { padding: 20, paddingTop: 60 },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#6b7280", marginTop: 12, fontSize: 13 },
  title: {
    color: "#e5e7eb",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20,
  },
  errorText: { color: "#f87171", fontSize: 13, marginBottom: 12 },

  // Cards
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardTitle: {
    color: "#e5e7eb",
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
    borderBottomColor: "#1f293766",
  },
  label: { color: "#9ca3af", fontSize: 13 },
  value: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statBox: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 72,
  },
  statValue: { color: "#22d3ee", fontSize: 20, fontWeight: "800" },
  statLabel: { color: "#9ca3af", fontSize: 11, marginTop: 2 },

  // Paired users
  userRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f293766",
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  username: { color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: "#030712", fontSize: 10, fontWeight: "700" },
  userMeta: { color: "#6b7280", fontSize: 12 },
  emptyText: { color: "#6b7280", fontSize: 13, fontStyle: "italic" },

  // Danger zone
  dangerCard: { borderColor: "#7f1d1d" },
  dangerText: { color: "#9ca3af", fontSize: 13, marginBottom: 14, lineHeight: 18 },
  resetButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  resetButtonDisabled: { opacity: 0.5 },
  resetButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
