import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AlertTriangle, ArrowLeft, CheckCircle2, Search } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { buildPiUrl, piGet } from "../../lib/pi";
import type { EventType, EventsResponse, SecurityEvent } from "../../types/iris";
import { cardShadow, referenceColors } from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

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
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "tab" });
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

  const fetchEvents = useCallback(
    async (reset: boolean) => {
      try {
        setError("");
        const currentOffset = reset ? 0 : offsetRef.current;
        let path = `/api/events/?limit=${PAGE_SIZE}&offset=${currentOffset}`;
        if (filter) path += `&event_type=${filter}`;

        const data = await piGet<EventsResponse>(path, session?.username);
        const newOffset = currentOffset + data.items.length;
        offsetRef.current = newOffset;

        if (reset) {
          setEvents(data.items);
        } else {
          setEvents((prev) => [...prev, ...data.items]);
        }
        setTotal(data.total);

        const newThumbs: Record<number, string> = {};
        for (const event of data.items) {
          if (event.snapshot_path) {
            newThumbs[event.id] = await buildPiUrl(event.snapshot_path, session?.username);
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
    },
    [filter, session?.username]
  );

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
        return "authorized";
      case "unknown":
        return "intruder";
      case "possible_threat":
        return "possible threat";
      default:
        return type;
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
          <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerCopy}>
          <Text style={styles.title}>Event History</Text>
          <Text style={styles.subtitle}>Review all security events</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color="#94a3b8" strokeWidth={2.2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.filterPill, filter === item.value && styles.filterPillActive]}
            onPress={() => handleFilterChange(item.value)}
          >
            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statGood]}>
          <Text style={styles.statValue}>{authorizedCount}</Text>
          <Text style={styles.statLabel}>Authorized</Text>
        </View>
        <View style={[styles.statCard, styles.statWarn]}>
          <Text style={[styles.statValue, styles.statWarnText]}>{possibleCount}</Text>
          <Text style={styles.statLabel}>Uncertain</Text>
        </View>
        <View style={[styles.statCard, styles.statDanger]}>
          <Text style={[styles.statValue, styles.statDangerText]}>{intruderCount}</Text>
          <Text style={styles.statLabel}>Intruders</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const renderEvent = ({ item }: { item: SecurityEvent }) => {
    const badgeColor = getBadgeColor(item.event_type);
    const thumbnailSize = layout.compact ? 58 : 70;

    return (
      <TouchableOpacity style={[styles.eventCard, item.alarm_triggered && styles.eventCardAlert]} onPress={() => navigation.navigate("EventDetails", { event: item })}>
        {thumbnails[item.id] ? (
          <Image source={{ uri: thumbnails[item.id] }} style={[styles.thumbnail, { width: thumbnailSize, height: thumbnailSize }]} />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { width: thumbnailSize, height: thumbnailSize, borderColor: `${badgeColor}4D` }]}>
            {item.event_type === "authorized" ? (
              <CheckCircle2 size={22} color={badgeColor} strokeWidth={2.2} />
            ) : (
              <AlertTriangle size={22} color={badgeColor} strokeWidth={2.2} />
            )}
          </View>
        )}

        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}>{item.matched_name ?? getBadgeLabel(item.event_type)}</Text>
          <Text style={styles.eventMeta}>
            {new Date(item.timestamp).toLocaleString()}
            {item.alarm_triggered ? " | Alarm triggered" : ""}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}44` }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{getBadgeLabel(item.event_type)}</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ReferenceBackdrop />
          <FlatList
            style={styles.container}
            data={visibleEvents}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEvent}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={[styles.list, layout.contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={referenceColors.primary} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              loading ? <ActivityIndicator color={referenceColors.primary} style={{ marginTop: 40 }} /> : <Text style={styles.emptyText}>No events found</Text>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={referenceColors.primary} style={{ padding: 16 }} />
              ) : events.length < total ? (
                <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
  headerCopy: {
    gap: 4,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
  },
  searchBar: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 15,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: referenceColors.primary,
    borderColor: referenceColors.primary,
  },
  filterText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    ...cardShadow,
  },
  statGood: {
    backgroundColor: "rgba(240,253,244,0.84)",
    borderColor: "#bbf7d0",
  },
  statWarn: {
    backgroundColor: "rgba(255,247,237,0.84)",
    borderColor: "#fed7aa",
  },
  statDanger: {
    backgroundColor: "rgba(255,241,242,0.84)",
    borderColor: "#fecaca",
  },
  statValue: {
    color: referenceColors.success,
    fontSize: 22,
    fontWeight: "800",
  },
  statWarnText: {
    color: referenceColors.warning,
  },
  statDangerText: {
    color: referenceColors.danger,
  },
  statLabel: {
    color: referenceColors.textSoft,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    ...cardShadow,
  },
  eventCardAlert: {
    backgroundColor: "rgba(255,241,242,0.9)",
    borderColor: "#fecaca",
  },
  thumbnail: {
    borderRadius: 18,
    backgroundColor: "#cbd5e1",
  },
  thumbnailPlaceholder: {
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  eventMeta: {
    color: referenceColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  alarmBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
  },
  alarmBadgeText: {
    color: referenceColors.danger,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 40,
  },
  loadMore: {
    alignItems: "center",
    padding: 16,
  },
  loadMoreText: {
    color: referenceColors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
