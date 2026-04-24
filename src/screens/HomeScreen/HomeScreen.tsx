import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Cpu,
  HardDrive,
  Plus,
  ScanFace,
  Shield,
  ShieldAlert,
  Users,
  Video,
  Wifi,
} from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { usePiHealth } from "../../hooks/usePiHealth";
import { getSessionAccess } from "../../lib/access";
import { buildPiUrl, ensureDeviceAuth, piGet, piPost, piPut } from "../../lib/pi";
import type { EventsResponse, SecurityEvent, SecurityMode, SystemStatus } from "../../types/iris";
import { buttonShadow, cardShadow, referenceColors, referenceLiveImage } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { activeDevice, session, sessionPassword } = useAuth();
  const access = getSessionAccess(session);
  const { health } = usePiHealth(10000, session?.username);
  const layout = useScreenLayout({ bottom: "tab" });

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const lastNotifiedRef = useRef<number | null>(null);
  const lastPushTokenRef = useRef<{ deviceId: string; token: string } | null>(null);

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

  const requestNotificationPermission = useCallback(async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  }, []);

  const notifyEvent = useCallback(
    async (_eventType: string, _mode: SecurityMode | null, message: string, vibrate: boolean) => {
      await requestNotificationPermission();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "I.R.I.S Alert",
          body: message,
        },
        trigger: null,
      });

      if (vibrate) {
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      }
    },
    [requestNotificationPermission]
  );

  const registerPushToken = useCallback(async () => {
    if (!activeDevice || !session?.username) return;
    if (!sessionPassword) return;

    try {
      await ensureDeviceAuth(session.username, sessionPassword, session.username);
      const { status: permissionStatus } = await Notifications.getPermissionsAsync();
      if (permissionStatus !== "granted") {
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
  }, [activeDevice, session?.username, sessionPassword]);

  const wsHandlers = useMemo(
    () => ({
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
        const currentMode = d.mode === "home" || d.mode === "away" ? (d.mode as SecurityMode) : status?.mode ?? null;
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
            ]
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
          const deduped = prev.filter((event) => event.id !== evt.id);
          return [evt, ...deduped].slice(0, 5);
        });
      },
      onModeChange: (msg: unknown) => {
        const d = msg as { mode?: string };
        if (d.mode === "home" || d.mode === "away") {
          setStatus((prev) => (prev ? { ...prev, mode: d.mode as SecurityMode } : prev));
        }
      },
      onAlarmChange: (msg: unknown) => {
        const d = msg as { active?: boolean };
        if (typeof d.active === "boolean") {
          setStatus((prev) => (prev ? { ...prev, alarm_active: d.active ?? prev.alarm_active } : prev));
        }
      },
      onThreatCleared: (msg: unknown) => {
        const d = msg as { id?: number };
        if (d.id) {
          setRecentEvents((prev) => prev.map((event) => (event.id === d.id ? { ...event, event_type: "authorized" } : event)));
        }
      },
    }),
    [navigation, notifyEvent, status]
  );

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
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
      void registerPushToken();
    }, [fetchData, registerPushToken])
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
      case "authorized":
        return referenceColors.success;
      case "unknown":
        return referenceColors.danger;
      case "possible_threat":
        return referenceColors.warning;
      default:
        return referenceColors.textMuted;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "authorized":
        return "authorized";
      case "unknown":
        return "intruder";
      case "possible_threat":
        return "possible threat";
      default:
        return type;
    }
  };

  const knownFaces = health?.known_faces ?? recentEvents.filter((event) => event.matched_name).length;
  const cameraReady = health?.camera_ready ?? Boolean(frameUri);
  const engineRunning = health?.engine_running ?? !error;
  const highRiskEvents = recentEvents.filter((event) => event.event_type === "unknown" || event.alarm_triggered).length;
  const metrics = [
    { label: "CPU", value: cameraReady ? "45%" : "--", icon: Cpu },
    { label: "RAM", value: engineRunning ? "62%" : "--", icon: Activity },
    { label: "Disk", value: "78%", icon: HardDrive },
  ];

  const statusBorderColor = status?.alarm_active ? "#fecaca" : "#bbf7d0";
  const liveImageHeight = getResponsiveMediaHeight(layout.width, { min: 180, max: 250, ratio: 0.56 });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ReferenceBackdrop />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ReferenceBackdrop />
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchData();
            }}
            tintColor={referenceColors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>I.R.I.S</Text>
            <Text style={styles.headerSubtitle}>{activeDevice ? "Your property is protected" : "Connect a Pi to start monitoring"}</Text>
          </View>
          {access.canAddDevice ? (
            <TouchableOpacity style={styles.addButtonWrap} onPress={() => navigation.navigate("AddCamera")} activeOpacity={0.9}>
              <View style={styles.addButton}>
                <Plus size={18} color={referenceColors.primary} strokeWidth={2.6} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View
          style={[
            styles.statusCard,
            { borderColor: statusBorderColor },
            status?.alarm_active ? styles.statusCardAlert : styles.statusCardSafe,
          ]}
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusLead}>
              <View style={[styles.statusIconWrap, { borderColor: statusBorderColor }]}>
                {status?.alarm_active ? (
                  <AlertTriangle size={20} color={referenceColors.danger} strokeWidth={2.2} />
                ) : (
                  <CheckCircle2 size={20} color={referenceColors.success} strokeWidth={2.2} />
                )}
              </View>
              <View>
                <Text style={styles.statusEyebrow}>System Status</Text>
                <Text style={[styles.statusValue, status?.alarm_active && styles.statusValueAlert]}>
                  {status?.alarm_active ? "warning" : "online"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.detailsButton} onPress={() => navigation.navigate("LiveFeed")}>
              <Text style={styles.detailsButtonText}>Details</Text>
              <ChevronRight size={14} color={referenceColors.textSoft} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.metricRow}>
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <View key={item.label} style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <Icon size={14} color={referenceColors.textMuted} strokeWidth={2.2} />
                    <Text style={styles.metricLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.metricValue}>{item.value}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.connectionRow}>
            <View style={[styles.connectionPill, styles.connectionSuccess]}>
              <Wifi size={14} color={referenceColors.success} strokeWidth={2.2} />
              <Text style={styles.connectionText}>{cameraReady ? "Connected" : "Disconnected"}</Text>
            </View>
            <View style={[styles.connectionPill, styles.connectionInfo]}>
              <Camera size={14} color={referenceColors.primary} strokeWidth={2.2} />
              <Text style={styles.connectionText}>{cameraReady ? "Camera Active" : "Camera Offline"}</Text>
            </View>
            <View style={styles.connectionPill}>
              <Bell size={14} color={referenceColors.textSoft} strokeWidth={2.2} />
              <Text style={styles.connectionText}>{status?.alarm_active ? "Alarm Triggered" : "Alerts On"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.liveCard} onPress={() => navigation.navigate("LiveFeed")} activeOpacity={0.92}>
          <Image source={{ uri: frameUri || referenceLiveImage }} style={[styles.liveImage, { height: liveImageHeight }]} resizeMode="cover" />

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>

          <View style={styles.liveTime}>
            <Text style={styles.liveTimeText}>{new Date().toLocaleTimeString()}</Text>
          </View>

          <View style={styles.liveOverlay}>
            <Video size={18} color="#ffffff" strokeWidth={2.2} />
            <Text style={styles.liveOverlayTitle}>View Full Screen</Text>
            <ChevronRight size={18} color="#ffffff" strokeWidth={2.2} />
          </View>
        </TouchableOpacity>

        <View style={styles.controlGrid}>
          <TouchableOpacity style={styles.controlCard} onPress={() => void toggleMode()}>
            {status?.mode === "away" ? (
              <ShieldAlert size={22} color={referenceColors.warning} strokeWidth={2.2} />
            ) : (
              <Shield size={22} color={referenceColors.primary} strokeWidth={2.2} />
            )}
            <Text style={styles.controlLabel}>Mode</Text>
            <Text style={styles.controlValue}>{status?.mode === "away" ? "Away" : "Home"}</Text>
            <Text style={styles.controlAction}>Switch</Text>
          </TouchableOpacity>

          <View style={[styles.controlCard, status?.alarm_active ? styles.controlAlert : styles.controlSafe]}>
            <Shield size={22} color={status?.alarm_active ? referenceColors.danger : referenceColors.success} strokeWidth={2.2} />
            <Text style={styles.controlLabel}>Security</Text>
            <Text style={[styles.controlValue, status?.alarm_active && styles.controlValueAlert]}>
              {status?.alarm_active ? "Triggered" : "Armed"}
            </Text>
            <Text style={styles.controlActionMuted}>{highRiskEvents} high risk</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity style={styles.sectionLink} onPress={() => navigation.navigate("Logs")}>
            <Text style={styles.sectionLinkText}>View All</Text>
            <ChevronRight size={14} color={referenceColors.primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {recentEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No events yet</Text>
          </View>
        ) : (
          recentEvents.map((event) => {
            const badgeColor = getEventBadgeColor(event.event_type);
            return (
              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => navigation.navigate("EventDetails", { event })}>
                <View style={[styles.eventIconWrap, { backgroundColor: `${badgeColor}1A`, borderColor: `${badgeColor}4D` }]}>
                  {event.event_type === "authorized" ? (
                    <CheckCircle2 size={18} color={badgeColor} strokeWidth={2.2} />
                  ) : (
                    <AlertTriangle size={18} color={badgeColor} strokeWidth={2.2} />
                  )}
                </View>

                <View style={styles.eventCopy}>
                  <Text style={styles.eventName}>{event.matched_name ?? getEventLabel(event.event_type)}</Text>
                  <Text style={styles.eventMeta}>{new Date(event.timestamp).toLocaleString()}</Text>
                </View>

                <View style={[styles.eventBadge, { backgroundColor: `${badgeColor}16`, borderColor: `${badgeColor}3A` }]}>
                  <Text style={[styles.eventBadgeText, { color: badgeColor }]}>{getEventLabel(event.event_type)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.quickGrid}>
          {access.canOpenFaces ? (
            <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate("FacialRegistration")}>
              <ScanFace size={22} color={referenceColors.primary} strokeWidth={2.2} />
              <Text style={styles.quickTitle}>Faces</Text>
              <Text style={styles.quickMeta}>{knownFaces}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate("Logs")}>
            <Activity size={22} color={referenceColors.textSoft} strokeWidth={2.2} />
            <Text style={styles.quickTitle}>Events</Text>
            <Text style={styles.quickMeta}>{recentEvents.length}</Text>
          </TouchableOpacity>

          {access.canOpenSharedUsers ? (
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => navigation.getParent()?.navigate("SharedUsers" as never)}
            >
              <Users size={22} color={referenceColors.textSoft} strokeWidth={2.2} />
              <Text style={styles.quickTitle}>Users</Text>
              <Text style={styles.quickMeta}>{knownFaces}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.ScrollView>
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
  centered: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: referenceColors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerTitle: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  addButtonWrap: {
    borderRadius: 18,
    ...buttonShadow,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
    ...cardShadow,
  },
  statusCardSafe: {
    backgroundColor: "rgba(220,252,231,0.62)",
  },
  statusCardAlert: {
    backgroundColor: "rgba(255,241,242,0.68)",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  statusLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  statusIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusEyebrow: {
    color: referenceColors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  statusValue: {
    color: referenceColors.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "capitalize",
  },
  statusValueAlert: {
    color: "#b91c1c",
  },
  detailsButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailsButtonText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    padding: 12,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricLabel: {
    color: referenceColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
  },
  connectionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    paddingHorizontal: 12,
  },
  connectionSuccess: {
    borderColor: "#bbf7d0",
  },
  connectionInfo: {
    borderColor: "#bfdbfe",
  },
  connectionText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  liveCard: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: referenceColors.border,
    backgroundColor: "#ffffff",
    marginBottom: 18,
    ...cardShadow,
  },
  liveImage: {
    width: "100%",
  },
  liveBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.92)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  liveBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  liveTime: {
    position: "absolute",
    top: 14,
    right: 14,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.78)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTimeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  liveOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    backgroundColor: "rgba(15,23,42,0.76)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  liveOverlayTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  controlGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  controlCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 22,
    padding: 18,
    ...cardShadow,
  },
  controlSafe: {
    backgroundColor: "rgba(220,252,231,0.75)",
    borderColor: "#bbf7d0",
  },
  controlAlert: {
    backgroundColor: "rgba(255,241,242,0.78)",
    borderColor: "#fecaca",
  },
  controlLabel: {
    color: referenceColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 14,
  },
  controlValue: {
    color: referenceColors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  controlValueAlert: {
    color: referenceColors.danger,
  },
  controlAction: {
    color: referenceColors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  controlActionMuted: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionLinkText: {
    color: referenceColors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  eventIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
  },
  eventName: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  eventMeta: {
    color: referenceColors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  eventBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "42%",
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
    textAlign: "center",
  },
  quickGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  quickCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...cardShadow,
  },
  quickTitle: {
    color: referenceColors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  quickMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
