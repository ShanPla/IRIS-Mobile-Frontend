import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../../App";
import { buildPiUrl } from "../../lib/pi";
import type { SecurityEvent } from "../../types/iris";

type Route = RouteProp<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const event: SecurityEvent = route.params.event;
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (event.snapshot_path) {
      void buildPiUrl(event.snapshot_path).then(setSnapshotUrl);
    }
  }, [event.snapshot_path]);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "authorized": return "#4ade80";
      case "unknown": return "#f87171";
      case "possible_threat": return "#fb923c";
      default: return "#6b7280";
    }
  };

  const getBadgeLabel = (type: string) => {
    switch (type) {
      case "authorized": return "Authorized";
      case "unknown": return "Intruder Detected";
      case "possible_threat": return "Possible Threat";
      default: return type;
    }
  };

  const badgeColor = getBadgeColor(event.event_type);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Event Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Snapshot */}
      {snapshotUrl ? (
        <Image source={{ uri: snapshotUrl }} style={styles.snapshot} resizeMode="contain" />
      ) : (
        <View style={styles.snapshotPlaceholder}>
          <Text style={styles.placeholderText}>No snapshot</Text>
        </View>
      )}

      {/* Badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{getBadgeLabel(event.event_type)}</Text>
        </View>
        {event.alarm_triggered && (
          <View style={[styles.badge, { backgroundColor: "#f8717120" }]}>
            <Text style={[styles.badgeText, { color: "#f87171" }]}>Alarm Triggered</Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <DetailRow label="Event ID" value={String(event.id)} />
        <DetailRow label="Type" value={getBadgeLabel(event.event_type)} />
        <DetailRow label="Matched Name" value={event.matched_name ?? "—"} />
        <DetailRow label="Timestamp" value={new Date(event.timestamp).toLocaleString()} />
        <DetailRow label="Mode" value={event.mode ?? "—"} />
        <DetailRow label="Alarm Triggered" value={event.alarm_triggered ? "Yes" : "No"} />
        <DetailRow label="Notification Sent" value={event.notification_sent ? "Yes" : "No"} />
        {event.notes ? <DetailRow label="Notes" value={event.notes} /> : null}
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backText: { color: "#22d3ee", fontSize: 15 },
  title: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  snapshot: {
    width: "100%",
    height: 280,
    backgroundColor: "#111827",
  },
  snapshotPlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: "#6b7280", fontSize: 13 },
  badgeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 13, fontWeight: "600" },
  details: { paddingHorizontal: 20, marginTop: 20, marginBottom: 40 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  detailLabel: { color: "#6b7280", fontSize: 14 },
  detailValue: { color: "#e5e7eb", fontSize: 14, fontWeight: "500" },
});
