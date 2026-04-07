import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Alert,
  Vibration,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { useAuth } from "../../context/AuthContext";
import { piGet, piPut, buildPiUrl } from "../../lib/pi";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { SystemStatus, SecurityEvent, SecurityMode, EventsResponse } from "../../types/iris";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { session, activeDevice, logout } = useAuth();

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const wsHandlers = useMemo(() => ({
    onSecurityEvent: (msg: unknown) => {
      const d = msg as { id?: number; event_type?: string; alarm_triggered?: boolean; snapshot_url?: string; timestamp?: string; mode?: string; matched_name?: string };
      if (!d.event_type || !d.timestamp) return;

      // ── In-app alert for confirmed intruder ──────────────────────
      if (d.event_type === "unknown" && d.alarm_triggered) {
        Vibration.vibrate([0, 500, 200, 500, 200, 500]); // urgent pattern
        Alert.alert(
          "INTRUDER ALERT",
          "An unrecognized person was confirmed after monitoring. Check the live feed immediately.",
          [
            { text: "View Live Feed", onPress: () => navigation.navigate("LiveFeed") },
            { text: "Dismiss", style: "cancel" },
          ],
        );
      }

      // ── Update recent events list ────────────────────────────────
      const evt: SecurityEvent = {
        id: d.id ?? Date.now(),
        event_type: d.event_type as SecurityEvent["event_type"],
        matched_name: d.matched_name ?? null,
        snapshot_path: d.snapshot_url ?? null,
        alarm_triggered: d.alarm_triggered ?? false,
        notification_sent: false,
        mode: d.mode ?? "",
        notes: null,
        timestamp: d.timestamp,
      };
      setRecentEvents((prev) => {
        const deduped = prev.filter((e) => e.id !== evt.id);
        return [evt, ...deduped].slice(0, 5);
      });
    },
    onModeChange: (msg: unknown) => {
      const d = msg as { mode?: string };
      if (d.mode === "home" || d.mode === "away") {
        setStatus((prev) => prev ? { ...prev, mode: d.mode as SecurityMode } : prev);
      }
    },
    onAlarmChange: (msg: unknown) => {
      const d = msg as { active?: boolean };
      if (d.active !== undefined) {
        setStatus((prev) => prev ? { ...prev, alarm_active: d.active as boolean } : prev);
      }
    },
    onThreatCleared: (msg: unknown) => {
      const d = msg as { id?: number };
      if (d.id) {
        setRecentEvents((prev) =>
          prev.map((e) => e.id === d.id ? { ...e, event_type: "authorized" } : e)
        );
      }
    },
  }), [navigation]);

  useWebSocket(wsHandlers);

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [statusData, eventsData] = await Promise.all([
        piGet<SystemStatus>("/api/system/status"),
        piGet<EventsResponse>("/api/events/?limit=5"),
      ]);
      setStatus(statusData);
      setRecentEvents(eventsData.items);

      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`);
      setFrameUri(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  const toggleMode = async () => {
    if (!status) return;
    const newMode = status.mode === "home" ? "away" : "home";
    try {
      await piPut("/api/system/mode", { mode: newMode });
      setStatus({ ...status, mode: newMode });
    } catch {
      Alert.alert("Error", "Failed to change mode");
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case "authorized": return "#4ade80";
      case "unknown": return "#f87171";
      case "possible_threat": return "#fb923c";
      default: return "#6b7280";
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "authorized": return "authorized";
      case "unknown": return "intruder";
      case "possible_threat": return "possible threat";
      default: return type;
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchData(); }} tintColor="#22d3ee" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>IRIS</Text>
          <Text style={styles.headerDevice}>
            {activeDevice ? `${activeDevice.name} (${activeDevice.deviceId})` : "No Pi connected"}
          </Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Status Cards */}
      <View style={styles.statusRow}>
        <TouchableOpacity style={styles.statusCard} onPress={toggleMode}>
          <Text style={styles.statusLabel}>MODE</Text>
          <Text style={[styles.statusValue, { color: "#22d3ee" }]}>
            {status?.mode?.toUpperCase() ?? "—"}
          </Text>
          <Text style={styles.statusHint}>
            {status?.mode === "home" ? "No alarm · Tap for away" : "Alarm active · Tap for home"}
          </Text>
        </TouchableOpacity>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>ALARM</Text>
          <Text style={[styles.statusValue, { color: status?.alarm_active ? "#f87171" : "#4ade80" }]}>
            {status?.alarm_active ? "ACTIVE" : "Inactive"}
          </Text>
        </View>
      </View>

      {/* Live Preview */}
      <TouchableOpacity style={styles.previewCard} onPress={() => navigation.navigate("LiveFeed")}>
        {frameUri ? (
          <Image source={{ uri: frameUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>Camera preview</Text>
          </View>
        )}
        <Text style={styles.previewLabel}>Tap for live feed</Text>
      </TouchableOpacity>

      {/* Recent Events */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Events</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Logs")}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentEvents.length === 0 ? (
          <Text style={styles.emptyText}>No events yet</Text>
        ) : (
          recentEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventRow}
              onPress={() => navigation.navigate("EventDetails", { event })}
            >
              <View style={[styles.eventDot, { backgroundColor: getEventBadgeColor(event.event_type) }]} />
              <View style={styles.eventInfo}>
                <Text style={styles.eventText}>
                  {event.matched_name ?? getEventLabel(event.event_type)}
                </Text>
                <Text style={styles.eventTime}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.eventBadge, { color: getEventBadgeColor(event.event_type) }]}>
                {getEventLabel(event.event_type)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  centered: { flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#6b7280" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { color: "#22d3ee", fontSize: 24, fontWeight: "800", letterSpacing: 4 },
  headerDevice: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  logoutText: { color: "#f87171", fontSize: 13 },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginBottom: 8, paddingHorizontal: 20 },
  statusRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  statusCard: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statusLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  statusValue: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  statusHint: { color: "#6b7280", fontSize: 10, marginTop: 4 },
  previewCard: {
    marginHorizontal: 20,
    backgroundColor: "#1f2937",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewImage: { width: "100%", height: 200 },
  previewPlaceholder: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
  },
  previewPlaceholderText: { color: "#6b7280", fontSize: 13 },
  previewLabel: { color: "#9ca3af", fontSize: 12, textAlign: "center", padding: 10 },
  section: { paddingHorizontal: 20, marginBottom: 32 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: "#e5e7eb", fontSize: 16, fontWeight: "700" },
  seeAll: { color: "#22d3ee", fontSize: 13 },
  emptyText: { color: "#6b7280", fontSize: 13, textAlign: "center", paddingVertical: 20 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  eventDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  eventInfo: { flex: 1 },
  eventText: { color: "#e5e7eb", fontSize: 14 },
  eventTime: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  eventBadge: { fontSize: 11, fontWeight: "600" },
});
