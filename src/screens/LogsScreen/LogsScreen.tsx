import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { apiClient, buildApiUrl } from "../../lib/api";
import type { SecurityEvent, EventsResponse } from "../../types/iris";
import { styles } from "./styles";

const LIMIT = 15;

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

export default function LogsScreen() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [snapshotUrls, setSnapshotUrls] = useState<Record<number, string | undefined>>({});

  useEffect(() => { void loadEvents(0); }, []);

  const loadEvents = async (newOffset: number) => {
    setError("");
    try {
      const response = await apiClient.get<EventsResponse>("/api/events/", {
        params: { limit: LIMIT, offset: newOffset },
      });
      setEvents(response.data.items);
      setTotal(response.data.total);
      setOffset(newOffset);

      const urls: Record<number, string | undefined> = {};
      await Promise.all(
        response.data.items.map(async (event) => {
          urls[event.id] = await buildApiUrl(event.snapshot_path);
        })
      );
      setSnapshotUrls(urls);
    } catch {
      setError("Failed to load events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Event Logs</Text>
      <Text style={styles.meta}>{total} total events</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void loadEvents(0); }}
              tintColor="#22d3ee"
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.eventCard, item.alarm_triggered && styles.eventCardAlarm]}>
              {snapshotUrls[item.id] ? (
                <Image source={{ uri: snapshotUrls[item.id] }} style={styles.snapshot} />
              ) : (
                <View style={styles.snapshotPlaceholder}>
                  <Text style={styles.snapshotIcon}>📷</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventType, { color: eventColor[item.event_type] }]}>
                  {eventLabel[item.event_type]}
                  {item.matched_name ? ` — ${item.matched_name}` : ""}
                </Text>
                <Text style={styles.eventTime}>{new Date(item.timestamp).toLocaleString()}</Text>
                {item.alarm_triggered && <Text style={styles.alarmTag}>Alarm Triggered</Text>}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No events found.</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.pageBtn, offset === 0 && styles.pageBtnDisabled]}
                  disabled={offset === 0}
                  onPress={() => void loadEvents(offset - LIMIT)}
                >
                  <Text style={styles.pageBtnText}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>{currentPage} / {totalPages}</Text>
                <TouchableOpacity
                  style={[styles.pageBtn, offset + LIMIT >= total && styles.pageBtnDisabled]}
                  disabled={offset + LIMIT >= total}
                  onPress={() => void loadEvents(offset + LIMIT)}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}