import { useState, useCallback, useMemo, useRef } from "react";
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
import * as Notifications from "expo-notifications";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { useAuth } from "../../context/AuthContext";
import { piGet, piPut, buildPiUrl, ensureDeviceAuth, piPost } from "../../lib/pi";
import { getAccountPassword } from "../../lib/accounts";
import { useWebSocket } from "../../hooks/useWebSocket";
import { usePiHealth } from "../../hooks/usePiHealth";
import type { SystemStatus, SecurityEvent, SecurityMode, EventsResponse } from "../../types/iris";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { activeDevice, session } = useAuth();
  const { health } = usePiHealth(10000, session?.username);

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const lastNotifiedRef = useRef<number | null>(null);
  const lastPushTokenRef = useRef<{ deviceId: string; token: string } | null>(null);

  const requestNotificationPermission = useCallback(async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  }, []);

  const notifyEvent = useCallback(async (eventType: string, mode: SecurityMode | null, message: string, vibrate: boolean) => {
    await requestNotificationPermission();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "SecureWatch Alert",
        body: message,
      },
      trigger: null,
    });
    if (vibrate) {
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    }
  }, [requestNotificationPermission]);

  const registerPushToken = useCallback(async () => {
    if (!activeDevice || !session?.username) return;
    const password = await getAccountPassword(session.username);
    if (!password) return;

    try {
      await ensureDeviceAuth(session.username, password, session.username);
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      const token = deviceToken.data;
      if (!token) return;
      if (lastPushTokenRef.current?.deviceId === activeDevice.deviceId && lastPushTokenRef.current?.token === token) {
        return;
      }
      await piPost("/api/auth/me/fcm-token", { fcm_token: token }, session.username);
      lastPushTokenRef.current = { deviceId: activeDevice.deviceId, token };
    } catch {
      // Ignore push registration errors; local alerts still work.
    }
  }, [activeDevice, session?.username]);

  const wsHandlers = useMemo(() => ({
    onSecurityEvent: (msg: unknown) => {
      const d = msg as {
        id?: number;
        event_type?: string;
        alarm_triggered?: boolean;
        snapshot_url?: string;
        timestamp?: string;
        mode?: string;
        matched_name?: string;
      };
      if (!d.event_type || !d.timestamp) return;

      const eventId = d.id ?? Date.now();
      const currentMode = (d.mode === "home" || d.mode === "away") ? (d.mode as SecurityMode) : status?.mode ?? null;
      const isIntruder = d.event_type === "unknown";
      const isUncertain = d.event_type === "possible_threat";
      const isAuthorized = d.event_type === "authorized";

      if (lastNotifiedRef.current !== eventId) {
        if (currentMode === "home" && (isIntruder || isUncertain)) {
          void notifyEvent(d.event_type, currentMode, "Intruder or uncertain activity detected while in Home mode.", true);
          lastNotifiedRef.current = eventId;
        }

        if (currentMode === "away" && (isIntruder || isUncertain)) {
          void notifyEvent(d.event_type, currentMode, "Intruder or uncertain activity detected while in Away mode.", true);
          lastNotifiedRef.current = eventId;
        }

        if (currentMode === "away" && isAuthorized) {
          void notifyEvent(d.event_type, currentMode, "Authorized person detected while in Away mode.", false);
          lastNotifiedRef.current = eventId;
        }
      }

      if (d.event_type === "unknown" && d.alarm_triggered) {
        Alert.alert(
          "INTRUDER ALERT",
          "An unrecognized person was confirmed after monitoring. Check the live feed immediately.",
          [
            { text: "View Live Feed", onPress: () => navigation.navigate("LiveFeed") },
            { text: "Dismiss", style: "cancel" },
          ],
        );
      }

      const evt: SecurityEvent = {
        id: eventId,
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
      if (typeof d.active === "boolean") {
        const alarmActive = d.active;
        setStatus((prev) => prev ? { ...prev, alarm_active: alarmActive } : prev);
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

  useWebSocket(wsHandlers, session?.username);

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [statusData, eventsData] = await Promise.all([
        piGet<SystemStatus>("/api/system/status", session?.username),
        piGet<EventsResponse>("/api/events/?limit=5", session?.username),
      ]);
      setStatus(statusData);
      setRecentEvents(eventsData.items);

      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
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
      void registerPushToken();
    }, [fetchData])
  );

  const toggleMode = async () => {
    if (!status) return;
    const newMode = status.mode === "home" ? "away" : "home";
    try {
      await piPut("/api/system/mode", { mode: newMode }, session?.username);
      setStatus({ ...status, mode: newMode });
    } catch {
      Alert.alert("Error", "Failed to change mode");
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case "authorized": return "#16a34a";
      case "unknown": return "#dc2626";
      case "possible_threat": return "#ea580c";
      default: return "#64748b";
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

  const knownFaces = health?.known_faces ?? recentEvents.filter((event) => event.matched_name).length;
  const cameraReady = health?.camera_ready ?? Boolean(frameUri);
  const engineRunning = health?.engine_running ?? !error;
  const highRiskEvents = recentEvents.filter((event) => event.event_type === "unknown" || event.alarm_triggered).length;
  const metrics = [
    { label: "CPU", value: cameraReady ? "45%" : "--" },
    { label: "RAM", value: engineRunning ? "62%" : "--" },
    { label: "Disk", value: "78%" },
  ];

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
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchData(); }} tintColor="#2563eb" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SecureWatch</Text>
          <Text style={styles.headerDevice}>
            {activeDevice ? "Your property is protected" : "Connect a Pi to start monitoring"}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("AddCamera")}>
          <Text style={styles.addText}>+</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.heroCard, status?.alarm_active && styles.heroCardAlert]}>
        <View style={styles.heroHeader}>
          <View style={[styles.statusIcon, status?.alarm_active && styles.statusIconAlert]}>
            <Text style={[styles.statusIconText, status?.alarm_active && styles.statusIconTextAlert]}>
              {status?.alarm_active ? "!" : "OK"}
            </Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>System Status</Text>
            <Text style={[styles.heroTitle, status?.alarm_active && styles.heroTitleAlert]}>
              {status?.alarm_active ? "warning" : "online"}
            </Text>
          </View>
          <TouchableOpacity style={styles.heroDetailButton} onPress={() => navigation.navigate("LiveFeed")}>
            <Text style={styles.heroDetailText}>Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricGrid}>
          {metrics.map((item) => (
            <View key={item.label} style={styles.metricTile}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chipRow}>
          <View style={[styles.statusChip, cameraReady && styles.statusChipGood]}>
            <View style={[styles.chipDot, cameraReady && styles.chipDotGood]} />
            <Text style={styles.chipText}>{cameraReady ? "Connected" : "Disconnected"}</Text>
          </View>
          <View style={[styles.statusChip, cameraReady && styles.statusChipBlue]}>
            <View style={[styles.chipDot, cameraReady && styles.chipDotBlue]} />
            <Text style={styles.chipText}>{cameraReady ? "Camera Active" : "Camera Offline"}</Text>
          </View>
          <View style={[styles.statusChip, !status?.alarm_active && styles.statusChipNeutral]}>
            <View style={[styles.chipDot, !status?.alarm_active && styles.chipDotNeutral]} />
            <Text style={styles.chipText}>{status?.alarm_active ? "Alarm Triggered" : "Alerts On"}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.previewCard} onPress={() => navigation.navigate("LiveFeed")}>
        {frameUri ? (
          <Image source={{ uri: frameUri }} style={styles.previewImage} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>Camera preview</Text>
          </View>
        )}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <View style={styles.previewFooter}>
          <Text style={styles.previewTitle}>View Full Screen</Text>
          <Text style={styles.previewLabel}>Live Monitor</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.controlGrid}>
        <TouchableOpacity style={styles.controlCard} onPress={toggleMode}>
          <Text style={styles.controlIcon}>{status?.mode === "away" ? "AW" : "HM"}</Text>
          <Text style={styles.controlLabel}>Mode</Text>
          <Text style={styles.controlValue}>{status?.mode === "away" ? "Away" : "Home"}</Text>
          <Text style={styles.controlAction}>Switch</Text>
        </TouchableOpacity>

        <View style={[styles.controlCard, status?.alarm_active ? styles.controlAlert : styles.controlSafe]}>
          <Text style={styles.controlIcon}>{status?.alarm_active ? "AL" : "AR"}</Text>
          <Text style={styles.controlLabel}>Security</Text>
          <Text style={[styles.controlValue, status?.alarm_active && styles.controlValueAlert]}>
            {status?.alarm_active ? "Triggered" : "Armed"}
          </Text>
          <Text style={styles.controlHint}>{highRiskEvents} high risk</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Logs")}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>
        {recentEvents.length === 0 ? (
          <Text style={styles.emptyText}>No events yet</Text>
        ) : (
          recentEvents.map((event) => {
            const badgeColor = getEventBadgeColor(event.event_type);
            return (
              <TouchableOpacity
                key={event.id}
                style={styles.eventRow}
                onPress={() => navigation.navigate("EventDetails", { event })}
              >
                <View style={[styles.eventDot, { backgroundColor: badgeColor }]} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventText}>
                    {event.matched_name ?? getEventLabel(event.event_type)}
                  </Text>
                  <Text style={styles.eventTime}>
                    {new Date(event.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.eventBadgePill, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}44` }]}>
                  <Text style={[styles.eventBadge, { color: badgeColor }]}>
                    {getEventLabel(event.event_type)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate("FacialRegistration")}>
          <Text style={styles.quickActionTitle}>Faces</Text>
          <Text style={styles.quickActionMeta}>{knownFaces}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate("Logs")}>
          <Text style={styles.quickActionTitle}>Events</Text>
          <Text style={styles.quickActionMeta}>{recentEvents.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate("FacialRegistration")}>
          <Text style={styles.quickActionTitle}>Users</Text>
          <Text style={styles.quickActionMeta}>{knownFaces}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 116 },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#64748b" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
  },
  headerTitle: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  headerDevice: { color: "#64748b", fontSize: 12, marginTop: 2 },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  addText: { color: "#ffffff", fontSize: 28, fontWeight: "600", marginTop: -2 },
  error: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12, paddingHorizontal: 20 },
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    elevation: 6,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  heroCardAlert: { backgroundColor: "#fff1f2", borderColor: "#fecaca" },
  heroHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  statusIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconAlert: { borderColor: "#fecaca" },
  statusIconText: { color: "#16a34a", fontWeight: "900", fontSize: 13 },
  statusIconTextAlert: { color: "#dc2626" },
  heroText: { flex: 1 },
  heroEyebrow: { color: "#475569", fontSize: 12, fontWeight: "700" },
  heroTitle: { color: "#0f172a", fontSize: 22, fontWeight: "800", marginTop: 2 },
  heroTitleAlert: { color: "#b91c1c" },
  heroDetailButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  heroDetailText: { color: "#334155", fontSize: 13, fontWeight: "800" },
  metricGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  metricTile: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.95)",
  },
  metricLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metricValue: { color: "#0f172a", fontSize: 16, fontWeight: "800", marginTop: 3 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  statusChipGood: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
  statusChipBlue: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  statusChipNeutral: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" },
  chipDotGood: { backgroundColor: "#16a34a" },
  chipDotBlue: { backgroundColor: "#2563eb" },
  chipDotNeutral: { backgroundColor: "#64748b" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  previewCard: {
    marginHorizontal: 20,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginBottom: 18,
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  previewImage: { width: "100%", height: 210 },
  previewPlaceholder: {
    width: "100%",
    height: 210,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
  },
  previewPlaceholderText: { color: "#64748b", fontSize: 13 },
  liveBadge: {
    position: "absolute",
    left: 14,
    top: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(220,38,38,0.94)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ffffff" },
  liveBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  previewFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.72)",
  },
  previewTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  previewLabel: { color: "#dbeafe", fontSize: 12, marginTop: 2 },
  controlGrid: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  controlCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  controlSafe: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  controlAlert: { backgroundColor: "#fff1f2", borderColor: "#fecaca" },
  controlIcon: { color: "#2563eb", fontSize: 16, fontWeight: "900", marginBottom: 12 },
  controlLabel: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  controlValue: { color: "#0f172a", fontSize: 20, fontWeight: "800", marginTop: 2 },
  controlValueAlert: { color: "#dc2626" },
  controlAction: { color: "#2563eb", fontSize: 12, fontWeight: "800", marginTop: 12 },
  controlHint: { color: "#64748b", fontSize: 12, marginTop: 12 },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800" },
  seeAll: { color: "#2563eb", fontSize: 13, fontWeight: "800" },
  emptyText: { color: "#64748b", fontSize: 13, textAlign: "center", paddingVertical: 20 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  eventDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  eventInfo: { flex: 1 },
  eventText: { color: "#0f172a", fontSize: 14, fontWeight: "700" },
  eventTime: { color: "#64748b", fontSize: 11, marginTop: 3 },
  eventBadgePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  eventBadge: { fontSize: 11, fontWeight: "800" },
  quickActions: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
  quickAction: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  quickActionTitle: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  quickActionMeta: { color: "#64748b", fontSize: 12, marginTop: 5 },
});
