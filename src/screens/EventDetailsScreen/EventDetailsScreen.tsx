import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Image,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { buildApiUrl } from "../../lib/api";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetails">;

const eventLabels: Record<string, string> = {
  authorized: "Authorized",
  unknown: "Unknown Person",
  unverifiable: "Unverifiable",
};

const badgeStyle: Record<string, object> = {
  authorized: styles.badgeAuthorized,
  unknown: styles.badgeUnknown,
  unverifiable: styles.badgeUnverifiable,
};

export default function EventDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { event } = route.params;
  const [snapshotUrl, setSnapshotUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void buildApiUrl(event.snapshot_path).then((url) => {
      setSnapshotUrl(url);
      setLoading(false);
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#e5e7eb", fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Snapshot */}
        <View style={styles.snapshotCard}>
          {loading ? (
            <View style={styles.snapshotPlaceholder}>
              <ActivityIndicator color="#22d3ee" />
            </View>
          ) : snapshotUrl ? (
            <Image source={{ uri: snapshotUrl }} style={styles.snapshot} resizeMode="cover" />
          ) : (
            <View style={styles.snapshotPlaceholder}>
              <Text style={{ color: "#4b5563", fontSize: 13 }}>No snapshot available</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.badge, badgeStyle[event.event_type]]}>
              {eventLabels[event.event_type] ?? event.event_type}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date & Time</Text>
            <Text style={styles.infoValue}>
              {new Date(event.timestamp).toLocaleString()}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Matched Name</Text>
            <Text style={styles.infoValue}>
              {event.matched_name ?? "—"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Event ID</Text>
            <Text style={styles.infoValue}>#{event.id}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Alarm</Text>
            {event.alarm_triggered ? (
              <View style={styles.alarmBadge}>
                <Text style={styles.alarmBadgeText}>Triggered</Text>
              </View>
            ) : (
              <Text style={styles.infoValue}>No</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}