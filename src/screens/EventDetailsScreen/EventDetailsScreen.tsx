import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { buildPiUrl } from "../../lib/pi";
import { saveRemoteImageToLibrary } from "../../lib/saveImage";
import type { SecurityEvent } from "../../types/iris";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

type Route = RouteProp<RootStackParamList, "EventDetails">;

export default function EventDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "stack" });
  const event: SecurityEvent = route.params.event;
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event.snapshot_path) {
      void buildPiUrl(event.snapshot_path, session?.username).then(setSnapshotUrl);
    }
  }, [event.snapshot_path, session?.username]);

  const handleSaveSnapshot = async () => {
    if (!snapshotUrl || saving) return;
    setSaving(true);
    try {
      await saveRemoteImageToLibrary(snapshotUrl);
      Alert.alert("Snapshot saved", "Saved to your Photos in the IRIS album.");
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Could not save snapshot");
    } finally {
      setSaving(false);
    }
  };

  const getBadgeColor = (type: string) => {
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

  const getBadgeLabel = (type: string) => {
    switch (type) {
      case "authorized":
        return "Authorized";
      case "unknown":
        return "Intruder Detected";
      case "possible_threat":
        return "Possible Threat";
      default:
        return type;
    }
  };

  const badgeColor = getBadgeColor(event.event_type);
  const snapshotHeight = getResponsiveMediaHeight(layout.width, { min: 220, max: 340, ratio: 0.75 });

  return (
    <View style={styles.container}>
      <ReferenceBackdrop />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, layout.contentStyle]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Event Details</Text>
          <Text style={styles.subtitle}>Review the captured event and metadata</Text>
        </View>

        {snapshotUrl ? (
          <>
            <Image source={{ uri: snapshotUrl }} style={[styles.snapshot, { height: snapshotHeight }]} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={() => void handleSaveSnapshot()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Download size={16} color="#ffffff" strokeWidth={2.4} />
                  <Text style={styles.saveButtonText}>Save to Photos</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.snapshotPlaceholder, { height: Math.max(200, snapshotHeight - 60) }]}>
            <Text style={styles.placeholderText}>No snapshot</Text>
          </View>
        )}

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}44` }]}>
            {event.event_type === "authorized" ? (
              <CheckCircle2 size={14} color={badgeColor} strokeWidth={2.2} />
            ) : (
              <AlertTriangle size={14} color={badgeColor} strokeWidth={2.2} />
            )}
            <Text style={[styles.badgeText, { color: badgeColor }]}>{getBadgeLabel(event.event_type)}</Text>
          </View>
          {event.alarm_triggered ? (
            <View style={styles.alarmBadge}>
              <Text style={styles.alarmBadgeText}>Alarm Triggered</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailsCard}>
          <DetailRow label="Event ID" value={String(event.id)} />
          <DetailRow label="Type" value={getBadgeLabel(event.event_type)} />
          <DetailRow label="Matched Name" value={event.matched_name ?? "-"} />
          <DetailRow label="Timestamp" value={new Date(event.timestamp).toLocaleString()} />
          <DetailRow label="Mode" value={event.mode ?? "-"} />
          <DetailRow label="Alarm Triggered" value={event.alarm_triggered ? "Yes" : "No"} />
          <DetailRow label="Notification Sent" value={event.notification_sent ? "Yes" : "No"} />
          {event.notes ? <DetailRow label="Notes" value={event.notes} isLast /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  backText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
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
  snapshot: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#0f172a",
  },
  saveButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: referenceColors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...buttonShadow,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  snapshotPlaceholder: {
    width: "100%",
    borderRadius: 28,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: referenceColors.textMuted,
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginBottom: 18,
  },
  badge: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  alarmBadge: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alarmBadgeText: {
    color: referenceColors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  detailsCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 16,
    ...cardShadow,
  },
  detailRow: {
    minHeight: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: referenceColors.textMuted,
    fontSize: 14,
    flex: 1,
    minWidth: 0,
  },
  detailValue: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    flexShrink: 1,
  },
});
