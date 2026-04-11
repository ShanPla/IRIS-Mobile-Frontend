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
  TextInput,
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
  { label: "Uncertain", value: "possible_threat" },
  { label: "Intruder", value: "unknown" },
];

const PAGE_SIZE = 20;

export default function LogsScreen() {
  const navigation = useNavigation<Nav>();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<EventType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
      case "authorized": return "#16a34a";
      case "unknown": return "#dc2626";
      case "possible_threat": return "#ea580c";
      default: return "#64748b";
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

  const authorizedCount = events.filter((event) => event.event_type === "authorized").length;
  const possibleCount = events.filter((event) => event.event_type === "possible_threat").length;
  const intruderCount = events.filter((event) => event.event_type === "unknown").length;
  const visibleEvents = events.filter((event) => {
    const label = `${event.matched_name ?? ""} ${getBadgeLabel(event.event_type)}`.toLowerCase();
    return label.includes(searchQuery.trim().toLowerCase());
  });

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Event History</Text>
          <Text style={styles.subtitle}>Review all security events</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>SR</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

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

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statGood]}>
          <Text style={styles.statValue}>{authorizedCount}</Text>
          <Text style={styles.statLabel}>Authorized</Text>
        </View>
        <View style={[styles.statCard, styles.statWarn]}>
          <Text style={[styles.statValue, { color: "#ea580c" }]}>{possibleCount}</Text>
          <Text style={styles.statLabel}>Uncertain</Text>
        </View>
        <View style={[styles.statCard, styles.statDanger]}>
          <Text style={[styles.statValue, { color: "#dc2626" }]}>{intruderCount}</Text>
          <Text style={styles.statLabel}>Intruders</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const renderEvent = ({ item }: { item: SecurityEvent }) => {
    const badgeColor = getBadgeColor(item.event_type);

    return (
      <TouchableOpacity
        style={[styles.eventRow, item.alarm_triggered && styles.eventRowAlert]}
        onPress={() => navigation.navigate("EventDetails", { event: item })}
      >
        {thumbnails[item.id] ? (
          <Image source={{ uri: thumbnails[item.id] }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { borderColor: `${badgeColor}55` }]}>
            <Text style={[styles.thumbnailText, { color: badgeColor }]}>
              {item.event_type === "authorized" ? "OK" : "!"}
            </Text>
          </View>
        )}
        <View style={styles.eventInfo}>
          <Text style={styles.eventText}>
            {item.matched_name ?? getBadgeLabel(item.event_type)}
          </Text>
          <Text style={styles.eventTime}>
            {new Date(item.timestamp).toLocaleString()}
            {item.alarm_triggered ? " | Alarm triggered" : ""}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}44` }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>
                {getBadgeLabel(item.event_type)}
              </Text>
            </View>
            {item.alarm_triggered ? (
              <View style={styles.alarmBadge}>
                <Text style={styles.alarmBadgeText}>Alarm</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleEvents}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEvent}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} /> : <Text style={styles.emptyText}>No events found</Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#2563eb" style={{ padding: 16 }} />
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
  container: { flex: 1, backgroundColor: "#f8fafc" },
  list: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  headerCopy: { flex: 1 },
  backButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  backText: { color: "#2563eb", fontSize: 14, fontWeight: "800" },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13, marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  searchIcon: { color: "#94a3b8", fontSize: 11, fontWeight: "900" },
  searchInput: { flex: 1, color: "#0f172a", fontSize: 15, paddingVertical: 0 },
  filters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 6,
  },
  filterTab: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  filterTabActive: { backgroundColor: "#2563eb" },
  filterText: { color: "#475569", fontSize: 11, fontWeight: "800" },
  filterTextActive: { color: "#f8fafc" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  statGood: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  statWarn: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  statDanger: { backgroundColor: "#fff1f2", borderColor: "#fecaca" },
  statValue: { color: "#16a34a", fontSize: 22, fontWeight: "900" },
  statLabel: { color: "#475569", fontSize: 11, marginTop: 3, fontWeight: "700" },
  error: { color: "#dc2626", fontSize: 13, textAlign: "center", marginBottom: 12 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 12,
    gap: 14,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  eventRowAlert: { backgroundColor: "#fff1f2", borderColor: "#fecaca" },
  thumbnail: { width: 66, height: 66, borderRadius: 16, backgroundColor: "#cbd5e1" },
  thumbnailPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailText: { fontSize: 18, fontWeight: "900" },
  eventInfo: { flex: 1 },
  eventText: { color: "#0f172a", fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  eventTime: { color: "#64748b", fontSize: 11, marginTop: 3 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  alarmBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
  },
  alarmBadgeText: { color: "#dc2626", fontSize: 11, fontWeight: "800" },
  emptyText: { color: "#64748b", textAlign: "center", marginTop: 40, fontSize: 14 },
  loadMore: { alignItems: "center", padding: 16 },
  loadMoreText: { color: "#2563eb", fontSize: 14, fontWeight: "800" },
});
