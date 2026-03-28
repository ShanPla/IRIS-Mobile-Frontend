import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Image, Switch,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient, buildApiUrl } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { SystemStatus, SecurityEvent } from "../../types/iris";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Placeholder cameras for testing
const PLACEHOLDER_CAMERAS = [
  { id: "1", name: "Office", icon: "🖥️" },
  { id: "2", name: "Living Room", icon: "📺" },
  { id: "3", name: "Bedroom", icon: "🛏️" },
  { id: "4", name: "Kitchen", icon: "🍳" },
];

// Placeholder events for testing when backend is empty
const PLACEHOLDER_EVENTS: SecurityEvent[] = [
  { id: 1, event_type: "authorized", snapshot_path: null, alarm_triggered: false, timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), matched_name: "Shan Platon" },
  { id: 2, event_type: "unknown", snapshot_path: null, alarm_triggered: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), matched_name: null },
  { id: 3, event_type: "unverifiable", snapshot_path: null, alarm_triggered: false, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), matched_name: null },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { session, logout } = useAuth();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [latestSnap, setLatestSnap] = useState<string | undefined>();
  const [latestEvent, setLatestEvent] = useState<SecurityEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeRooms, setActiveRooms] = useState<Record<string, boolean>>({
    "1": true, "2": true, "3": false, "4": true,
  });

  useEffect(() => { void load(); }, []);

  useEffect(() => {
  void NavigationBar.setVisibilityAsync("hidden");
  void NavigationBar.setBehaviorAsync("overlay-swipe");
}, []);

  const load = async () => {
    setError("");
    try {
      const [statusRes, eventsRes] = await Promise.all([
        apiClient.get<SystemStatus>("/api/system/status"),
        apiClient.get<{ items: SecurityEvent[] }>("/api/events/", { params: { limit: 5 } }),
      ]);
      setStatus(statusRes.data);
      const events = eventsRes.data.items.length > 0 ? eventsRes.data.items : PLACEHOLDER_EVENTS;
      setRecentEvents(events);
      if (events.length > 0) {
        const latest = events[0];
        setLatestEvent(latest);
        setLatestSnap(await buildApiUrl(latest.snapshot_path));
      }
    } catch {
      // Use placeholder data if backend unavailable
      setStatus({ mode: "home", alarm_active: false, updated_at: new Date().toISOString() });
      setRecentEvents(PLACEHOLDER_EVENTS);
      setLatestEvent(PLACEHOLDER_EVENTS[0]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleMode = async () => {
    if (!status) return;
    const newMode = status.mode === "home" ? "away" : "home";
    try {
      await apiClient.put("/api/system/mode", { mode: newMode });
      setStatus({ ...status, mode: newMode });
    } catch {
      setStatus({ ...status, mode: newMode }); // optimistic update for testing
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const warningCount = recentEvents.filter(
    (e) => e.event_type === "unknown" || e.event_type === "unverifiable"
  ).length;

  const recentTimes = recentEvents.slice(0, 3).map(
    (e) => new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  return (
    <>
      <StatusBar style="light" hidden={false} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#22d3ee" />
        }
      >
        <View style={styles.header}>
          <Text style={styles.logo}>I.R.I.S</Text>
          <TouchableOpacity onPress={() => void handleLogout()}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* System Status */}
            <View style={styles.statusCard}>
              <View style={styles.statusCardHeader}>
                <Text style={styles.statusCardTitle}>System Status</Text>
                <View style={styles.modePill}>
                  <Text style={styles.modePillText}>
                    {status?.mode === "away" ? "Away" : "Home"}
                  </Text>
                </View>
              </View>
              <View style={styles.warningRow}>
                <View style={styles.warningIcon}>
                  <Text style={{ fontSize: 20 }}>{warningCount > 0 ? "⚠️" : "✅"}</Text>
                </View>
                <View style={styles.warningInfo}>
                  <Text style={[styles.warningCount, warningCount === 0 && styles.warningCountSafe]}>
                    {warningCount === 0 ? "0 Warnings" : `${warningCount} Warning${warningCount > 1 ? "s" : ""}`}
                  </Text>
                  {recentTimes.length > 0 && (
                    <Text style={styles.warningTimes}>{recentTimes.join(" · ")}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => navigation.navigate("Logs")}
                >
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Your Alarm / Cameras */}
            <View style={styles.alarmSection}>
              <View style={styles.alarmSectionHeader}>
                <Text style={styles.sectionTitle}>Your Alarm</Text>
                <TouchableOpacity onPress={() => navigation.navigate("AddCamera")}>
                  <Text style={styles.addNew}>+ Add New</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.alarmGrid}>
                {PLACEHOLDER_CAMERAS.map((camera) => (
                  <View
                    key={camera.id}
                    style={[styles.alarmCard, activeRooms[camera.id] && styles.alarmCardActive]}
                  >
                    <View style={styles.alarmCardTop}>
                      <Text style={{ fontSize: 14, color: "#6b7280" }}>📷</Text>
                      <Switch
                        value={activeRooms[camera.id] ?? false}
                        onValueChange={(val) => setActiveRooms((prev) => ({ ...prev, [camera.id]: val }))}
                        trackColor={{ false: "#374151", true: "#22d3ee" }}
                        thumbColor={activeRooms[camera.id] ? "#fff" : "#9ca3af"}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    </View>
                    <Text style={styles.alarmIcon}>{camera.icon}</Text>
                    <Text style={styles.alarmLabel}>{camera.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Mode */}
            <View style={styles.modeSection}>
              <Text style={styles.sectionTitle}>Mode</Text>
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, status?.mode === "home" && styles.modeToggleBtnActive]}
                  onPress={() => status?.mode !== "home" && void toggleMode()}
                >
                  <Text style={[styles.modeToggleText, status?.mode === "home" && styles.modeToggleTextActive]}>
                    Home
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, status?.mode === "away" && styles.modeToggleBtnActive]}
                  onPress={() => status?.mode !== "away" && void toggleMode()}
                >
                  <Text style={[styles.modeToggleText, status?.mode === "away" && styles.modeToggleTextActive]}>
                    Away
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modeDesc}>
                {status?.mode === "home"
                  ? "Home: For when you're home. Known faces won't trigger alarms. Unknown visitors will activate the alarm and send you a snapshot alert."
                  : "Away: Stricter monitoring. Any unverified presence triggers an immediate alert."}
              </Text>
            </View>

            {/* Latest Snap */}
            <View style={styles.latestSnapSection}>
              <Text style={styles.sectionTitle}>Latest Snap</Text>
              <View style={styles.snapCard}>
                {latestSnap ? (
                  <>
                    <Image source={{ uri: latestSnap }} style={styles.snapImage} resizeMode="cover" />
                    <View style={styles.snapOverlay}>
                      <TouchableOpacity
                        style={styles.snapViewBtn}
                        onPress={() => latestEvent && navigation.navigate("EventDetails", { event: latestEvent })}
                      >
                        <Text style={styles.snapViewBtnText}>View</Text>
                      </TouchableOpacity>
                    </View>
                    {latestEvent && (
                      <Text style={styles.snapTime}>
                        {new Date(latestEvent.timestamp).toLocaleString()}
                      </Text>
                    )}
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.snapPlaceholder}
                    onPress={() => latestEvent && navigation.navigate("EventDetails", { event: latestEvent })}
                  >
                    <Text style={{ color: "#4b5563", fontSize: 32 }}>📸</Text>
                    <Text style={{ color: "#4b5563", fontSize: 13, marginTop: 8 }}>
                      {latestEvent ? "Tap to view latest event" : "No snapshots yet"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}