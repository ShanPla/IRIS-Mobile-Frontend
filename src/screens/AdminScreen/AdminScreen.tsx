import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Shield, Users } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { piGet } from "../../lib/pi";
import { cardShadow, referenceColors } from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

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

type Nav = NativeStackNavigationProp<RootStackParamList, "Admin">;

export default function AdminScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "stack" });
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [pairedUsers, setPairedUsers] = useState<PairedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "homeowner_primary":
        return "Primary";
      case "homeowner_invited":
        return "Invited";
      default:
        return role;
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "#f59e0b";
      case "homeowner_primary":
        return referenceColors.primary;
      case "homeowner_invited":
        return "#7c3aed";
      default:
        return referenceColors.textMuted;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ReferenceBackdrop />
        <ActivityIndicator color={referenceColors.primary} size="large" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ReferenceBackdrop />
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={referenceColors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Device ownership and pairing statistics</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {stats ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Device Info</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Device ID</Text>
              <Text style={styles.value}>{stats.device_id}</Text>
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <Text style={styles.label}>Device Name</Text>
              <Text style={styles.value}>{stats.device_name}</Text>
            </View>
          </View>
        ) : null}

        {stats ? (
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
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paired Users ({pairedUsers.length})</Text>
          {pairedUsers.length === 0 ? (
            <Text style={styles.emptyText}>No users have paired with this Pi yet.</Text>
          ) : (
            pairedUsers.map((user, index) => (
              <View key={user.id} style={[styles.userRow, index === pairedUsers.length - 1 && styles.rowLast]}>
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <Users size={16} color={referenceColors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.username}>{user.username}</Text>
                      <View style={[styles.badge, { backgroundColor: roleBadgeColor(user.role) }]}>
                        <Text style={styles.badgeText}>{roleLabel(user.role)}</Text>
                      </View>
                    </View>
                    <Text style={styles.userMeta}>Paired: {formatDate(user.paired_at)}</Text>
                    <Text style={styles.userMeta}>Last active: {formatDate(user.last_active)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Need to reset this device? Go to <Text style={styles.infoHighlight}>Settings</Text> and scroll to the Management section.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Shield size={16} color={referenceColors.primary} strokeWidth={2.2} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    paddingBottom: 118,
  },
  center: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: referenceColors.textMuted,
    marginTop: 12,
    fontSize: 13,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    color: referenceColors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  cardTitle: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: referenceColors.textSoft,
    fontSize: 13,
    flex: 1,
    minWidth: 0,
  },
  value: {
    color: referenceColors.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    flexShrink: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBox: {
    minWidth: 88,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  statValue: {
    color: referenceColors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: referenceColors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  userRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
  },
  userHeader: {
    flexDirection: "row",
    gap: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  username: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  userMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  infoSection: {
    alignItems: "center",
    padding: 20,
  },
  infoText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  infoHighlight: {
    color: referenceColors.primary,
    fontWeight: "700",
  },
});


function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Shield size={16} color={referenceColors.primary} strokeWidth={2.2} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    paddingBottom: 118,
  },
  center: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: referenceColors.textMuted,
    marginTop: 12,
    fontSize: 13,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  errorText: {
    color: referenceColors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  cardTitle: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  label: {
    color: referenceColors.textSoft,
    fontSize: 13,
    flex: 1,
    minWidth: 0,
  },
  value: {
    color: referenceColors.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
    flexShrink: 1,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBox: {
    minWidth: 88,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  statValue: {
    color: referenceColors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: referenceColors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  userRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226,232,240,0.8)",
  },
  userHeader: {
    flexDirection: "row",
    gap: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  username: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  userMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
  dangerCard: {
    borderColor: "#fecaca",
    backgroundColor: "rgba(255,241,242,0.88)",
  },
  dangerHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  dangerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerCopy: {
    flex: 1,
    minWidth: 0,
  },
  dangerText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  resetButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: referenceColors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    ...buttonShadow,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
