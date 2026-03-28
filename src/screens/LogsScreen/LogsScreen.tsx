import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiClient } from "../../lib/api";
import type { SecurityEvent, EventsResponse } from "../../types/iris";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LIMIT = 50;

function groupByDate(events: SecurityEvent[]): Record<string, SecurityEvent[]> {
  return events.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString("en-US", {
      month: "numeric", day: "numeric", year: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
    return groups;
  }, {} as Record<string, SecurityEvent[]>);
}

export default function LogsScreen() {
  const navigation = useNavigation<Nav>();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "oldest">("recent");

  useEffect(() => { void loadEvents(); }, []);

  const loadEvents = async () => {
    setError("");
    try {
      const response = await apiClient.get<EventsResponse>("/api/events/", {
        params: { limit: LIMIT, offset: 0 },
      });
      setEvents(response.data.items);
      setTotal(response.data.total);
    } catch {
      setError("Failed to load events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = events
    .filter((e) => {
      if (!search.trim()) return true;
      const dateStr = new Date(e.timestamp).toLocaleDateString();
      return dateStr.includes(search.trim()) ||
        (e.matched_name?.toLowerCase().includes(search.toLowerCase()) ?? false);
    })
    .sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return sort === "recent" ? diff : -diff;
    });

  const grouped = groupByDate(filtered);
  const groupedEntries = Object.entries(grouped);

  const activityCount = (evts: SecurityEvent[]) =>
    `${evts.length} activit${evts.length === 1 ? "y" : "ies"}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#e5e7eb", fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Logs</Text>
      </View>

      <FlatList
        data={groupedEntries}
        keyExtractor={([date]) => date}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadEvents(); }} tintColor="#22d3ee" />
        }
        ListHeaderComponent={
          <>
            {/* Search */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search date..."
                placeholderTextColor="#6b7280"
                value={search}
                onChangeText={setSearch}
              />
              <Text style={{ color: "#6b7280" }}>🔍</Text>
            </View>

            {/* Sort */}
            <View style={styles.sortRow}>
              <TouchableOpacity
                style={[styles.sortBtn, sort === "recent" && styles.sortBtnActive]}
                onPress={() => setSort("recent")}
              >
                <Text style={[styles.sortBtnText, sort === "recent" && styles.sortBtnTextActive]}>
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortBtn, sort === "oldest" && styles.sortBtnActive]}
                onPress={() => setSort("oldest")}
              >
                <Text style={[styles.sortBtnText, sort === "oldest" && styles.sortBtnTextActive]}>
                  Oldest
                </Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {loading && <ActivityIndicator color="#22d3ee" style={{ marginTop: 20 }} />}
            <Text style={styles.meta}>{total} total events</Text>
          </>
        }
        renderItem={({ item: [date, evts] }) => (
          <View style={styles.dateGroup}>
            {evts.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventRow}
                onPress={() => navigation.navigate("EventDetails", { event })}
              >
                <View>
                  <Text style={styles.eventDate}>{date}</Text>
                  <Text style={styles.eventMeta}>{activityCount([event])} · {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <Text style={styles.eventViewBtn}>View</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={styles.empty}>No events logged yet.</Text>
              <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>
                Events will appear here when the system detects activity.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}