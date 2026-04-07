import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { piGet, buildPiUrl } from "../../lib/pi";
import type { SecurityEvent, EventsResponse, EventType } from "../../types/iris";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILTERS: Array<{ label: string; value: EventType | null }> = [
  { label: "All", value: null },
  { label: "Authorized", value: "authorized" },
  { label: "Possible Threat", value: "possible_threat" },
  { label: "Intruder", value: "unknown" },
];

const PAGE_SIZE = 20;

export default function LogsScreen() {
  const navigation = useNavigation<Nav>();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const offsetRef = useRef(0);

  const fetchEvents = useCallback(async (reset: boolean) => {
    try {
      setError("");
      const currentOffset = reset ? 0 : offsetRef.current;
      let path = `/api/events/?limit=${PAGE_SIZE}&offset=${currentOffset}`;
      if (filter) path += `&event_type=${filter}`;

      const data = await piGet<EventsResponse>(path);
      const newOffset = currentOffset + data.items.length;
      offsetRef.current = newOffset;

      if (reset) {
        setEvents(data.items);
      } else {
        setEvents((prev) => [...prev, ...data.items]);
      }
      setTotal(data.total);

      // Build thumbnail URLs
      const newThumbs: Record<number, string> = {};
      for (const evt of data.items) {
        if (evt.snapshot_path) {
          newThumbs[evt.id] = await buildPiUrl(evt.snapshot_path);
        }
      }
      setThumbnails((prev) => (reset ? newThumbs : { ...prev, ...newThumbs }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load events");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      offsetRef.current = 0;
      void fetchEvents(true);
    }, [fetchEvents])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    offsetRef.current = 0;
    void fetchEvents(true);
  };

  const handleLoadMore = () => {
    if (events.length >= total || loadingMore) return;
    setLoadingMore(true);
    void fetchEvents(false);
  };

  const handleFilterChange = (value: EventType | null) => {
    setFilter(value);
    offsetRef.current = 0;
  };

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
      case "authorized": return "authorized";
      case "unknown": return "intruder";
      case "possible_threat": return "possible threat";
      default: return type;
    }
  };

  const renderEvent = ({ item }: { item: SecurityEvent }) => (
    <TouchableOpacity
      style={styles.eventRow}
      onPress={() => navigation.navigate("EventDetails", { event: item })}
    >
      {thumbnails[item.id] ? (
        <Image source={{ uri: thumbnails[item.id] }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
      <View style={styles.eventInfo}>
        <Text style={styles.eventText}>
          {item.matched_name ?? getBadgeLabel(item.event_type)}
        </Text>
        <Text style={styles.eventTime}>
          {new Date(item.timestamp).toLocaleString()}
          {item.alarm_triggered ? " • Alarm triggered" : ""}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${getBadgeColor(item.event_type)}20` }]}>
        <Text style={[styles.badgeText, { color: getBadgeColor(item.event_type) }]}>
          {getBadgeLabel(item.event_type)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Event Logs</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
            onPress={() => handleFilterChange(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22d3ee" />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} /> : <Text style={styles.emptyText}>No events found</Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#22d3ee" style={{ padding: 16 }} />
          ) : events.length < total ? (
            <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          ) : null
        }
      />
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
  filters: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1f2937",
  },
  filterTabActive: { backgroundColor: "#22d3ee" },
  filterText: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#030712" },
  error: { color: "#f87171", fontSize: 13, textAlign: "center", marginBottom: 8 },
  list: { paddingHorizontal: 20 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  thumbnail: { width: 44, height: 44, borderRadius: 6, backgroundColor: "#374151" },
  thumbnailPlaceholder: { width: 44, height: 44, borderRadius: 6, backgroundColor: "#374151" },
  eventInfo: { flex: 1 },
  eventText: { color: "#e5e7eb", fontSize: 14 },
  eventTime: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  emptyText: { color: "#6b7280", textAlign: "center", marginTop: 40, fontSize: 14 },
  loadMore: { alignItems: "center", padding: 16 },
  loadMoreText: { color: "#22d3ee", fontSize: 14 },
});
