import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { buildPiUrl } from "../../lib/pi";

export default function LiveFeedScreen() {
  const navigation = useNavigation();
  const [frameUri, setFrameUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveFailsRef = useRef(0);

  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`);
        // Verify the frame is actually available (not stale/503)
        const res = await fetch(url, { headers: { "ngrok-skip-browser-warning": "true" } });
        if (!res.ok) throw new Error(`Frame error (${res.status})`);
        consecutiveFailsRef.current = 0;
        setReconnecting(false);
        setFrameUri(url);
        setLoading(false);
        setError("");
      } catch (e) {
        consecutiveFailsRef.current += 1;
        if (consecutiveFailsRef.current >= 5) {
          setReconnecting(true);
          setError("");
        } else {
          setError(e instanceof Error ? e.message : "Cannot load frame");
        }
        setLoading(false);
      }
    };

    void poll();
    // Back off when reconnecting to avoid hammering the Pi
    const getDelay = () => consecutiveFailsRef.current >= 5 ? 500 : 150;
    intervalRef.current = setInterval(() => void poll(), getDelay());

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Live Feed</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Feed */}
      <View style={styles.feedContainer}>
        {loading ? (
          <ActivityIndicator color="#22d3ee" size="large" />
        ) : reconnecting ? (
          <View style={styles.reconnectWrap}>
            <ActivityIndicator color="#facc15" size="large" />
            <Text style={styles.reconnectText}>
              Stream interrupted — reconnecting...
            </Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Image
            source={{ uri: frameUri }}
            style={styles.feedImage}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, paused && styles.controlButtonActive]}
          onPress={() => setPaused(!paused)}
        >
          <Text style={styles.controlText}>{paused ? "Resume" : "Pause"}</Text>
        </TouchableOpacity>
      </View>
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
  feedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  feedImage: { width: "100%", height: "100%" },
  reconnectWrap: { alignItems: "center", gap: 12 },
  reconnectText: { color: "#facc15", fontSize: 13, textAlign: "center" },
  errorText: { color: "#f87171", fontSize: 13 },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 20,
    gap: 12,
  },
  controlButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  controlButtonActive: { backgroundColor: "#22d3ee" },
  controlText: { color: "#e5e7eb", fontWeight: "600" },
});
