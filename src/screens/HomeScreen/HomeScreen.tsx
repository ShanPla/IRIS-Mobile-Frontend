import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  ActivityIndicator, ScrollView, RefreshControl,
} from "react-native";
import { apiClient } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import type { SystemStatus, SecurityEvent } from "../../types/iris";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../../../App";
import { styles } from "./styles";

type Props = { navigation: BottomTabNavigationProp<MainTabParamList> };

const eventColor: Record<string, string> = {
  authorized: "#4ade80",
  unknown: "#f87171",
  unverifiable: "#fbbf24",
};

const eventLabel: Record<string, string> = {
  authorized: "Authorized",
  unknown: "Unknown Person",
  unverifiable: "Unverifiable",
};

export default function HomeScreen({ navigation }: Props) {
  const { session, logout } = useAuth();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setError("");
    try {
      const [statusRes, eventsRes] = await Promise.all([
        apiClient.get<SystemStatus>("/api/system/status"),
        apiClient.get<{ items: SecurityEvent[] }>("/api/events/", { params: { limit: 3 } }),
      ]);
      setStatus(statusRes.data);
      setRecentEvents(eventsRes.data.items);
    } catch {
      setError("Failed to load data.");
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
      setError("Failed to change mode.");
    }
  };

  const silenceAlarm = async () => {
    try {
      await apiClient.put("/api/system/alarm", { active: false });
      if (status) setStatus({ ...status, alarm_active: false });
    } catch {
      setError("Failed to silence alarm.");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void load(); }}
          tintColor="#22d3ee"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.logo}>IRIS</Text>
        <TouchableOpacity onPress={() => void handleLogout()}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.welcome}>Hello, {session?.username} 👋</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : (
        <>
          {status?.alarm_active && (
            <TouchableOpacity style={styles.alarmBanner} onPress={() => void silenceAlarm()}>
              <Text style={styles.alarmBannerText}>🚨 ALARM ACTIVE — Tap to Silence</Text>
            </TouchableOpacity>
          )}

          <View style={styles.cardRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mode</Text>
              <Text style={[styles.statValue, { color: status?.mode === "away" ? "#fbbf24" : "#22d3ee" }]}>
                {status?.mode?.toUpperCase() ?? "—"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Alarm</Text>
              <Text style={[styles.statValue, { color: status?.alarm_active ? "#f87171" : "#4ade80" }]}>
                {status?.alarm_active ? "TRIGGERED" : "Safe"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.modeBtn} onPress={() => void toggleMode()}>
            <Text style={styles.modeBtnText}>
              Switch to {status?.mode === "home" ? "Away" : "Home"} Mode
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Recent Events</Text>
          {recentEvents.length === 0 ? (
            <Text style={styles.empty}>No recent events.</Text>
          ) : (
            recentEvents.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={[styles.eventDot, { backgroundColor: eventColor[event.event_type] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventType, { color: eventColor[event.event_type] }]}>
                    {eventLabel[event.event_type]}
                    {event.matched_name ? ` — ${event.matched_name}` : ""}
                  </Text>
                  <Text style={styles.eventTime}>{new Date(event.timestamp).toLocaleString()}</Text>
                </View>
                {event.alarm_triggered && (
                  <Text style={styles.alarmTag}>Alarm</Text>
                )}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Logs")}>
              <Text style={styles.actionBtnText}>📋 View Logs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate("Profile")}>
              <Text style={styles.actionBtnText}>👤 My Profile</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}