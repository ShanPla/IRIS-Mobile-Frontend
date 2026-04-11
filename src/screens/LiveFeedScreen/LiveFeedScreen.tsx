import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { buildPiUrl } from "../../lib/pi";
import { useAuth } from "../../context/AuthContext";

export default function LiveFeedScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const [frameUri, setFrameUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
        const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
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
    const getDelay = () => consecutiveFailsRef.current >= 5 ? 500 : 150;
    intervalRef.current = setInterval(() => void poll(), getDelay());

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, session?.username]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
      setFrameUri(url);
      setLoading(false);
      setError("");
      setReconnecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot refresh frame");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Live Monitor</Text>
          <Text style={styles.subtitle}>Real-time camera feed</Text>
        </View>
      </View>

      <View style={styles.feedContainer}>
        {loading ? (
          <ActivityIndicator color="#60a5fa" size="large" />
        ) : reconnecting ? (
          <View style={styles.reconnectWrap}>
            <ActivityIndicator color="#facc15" size="large" />
            <Text style={styles.reconnectText}>Stream interrupted - reconnecting...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <Image source={{ uri: frameUri }} style={styles.feedImage} resizeMode="cover" />
        )}

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>{paused ? "PAUSED" : "LIVE"}</Text>
        </View>

        <View style={styles.feedTimePill}>
          <Text style={styles.feedTimeText}>{new Date().toLocaleTimeString()}</Text>
        </View>

        <View pointerEvents="none" style={styles.gridOverlay}>
          <View style={[styles.gridLineVertical, { left: "25%" }]} />
          <View style={[styles.gridLineVertical, { left: "50%" }]} />
          <View style={[styles.gridLineVertical, { left: "75%" }]} />
          <View style={[styles.gridLineHorizontal, { top: "33%" }]} />
          <View style={[styles.gridLineHorizontal, { top: "66%" }]} />
          <View style={styles.scanLine} />
        </View>

        <View style={styles.feedControls}>
          <View style={styles.controlSide}>
            <TouchableOpacity style={styles.overlayControl} onPress={() => void handleRefresh()}>
              <Text style={styles.overlayControlText}>{isRefreshing ? "..." : "RF"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overlayControl} onPress={() => setIsMuted(!isMuted)}>
              <Text style={styles.overlayControlText}>{isMuted ? "MU" : "AU"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cameraPill}>
            <Text style={styles.cameraPillText}>Front Door</Text>
          </View>
          <View style={styles.controlSide}>
            <TouchableOpacity style={styles.overlayControl}>
              <Text style={styles.overlayControlText}>ST</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.overlayControl, paused && styles.overlayControlActive]} onPress={() => setPaused(!paused)}>
              <Text style={styles.overlayControlText}>{paused ? "PL" : "FS"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Stream Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Resolution</Text>
          <Text style={styles.infoValue}>1920 x 1080</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Frame Rate</Text>
          <Text style={styles.infoValue}>{paused ? "Paused" : "30 FPS"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Bitrate</Text>
          <Text style={styles.infoValue}>2.5 Mbps</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Latency</Text>
          <Text style={[styles.infoValue, reconnecting || error ? styles.infoValueWarn : styles.infoValueGood]}>
            {reconnecting ? "Reconnecting" : error ? "Interrupted" : "124ms"}
          </Text>
        </View>
      </View>

      <View style={styles.detectionCard}>
        <View style={styles.detectionHeader}>
          <View style={styles.detectionIcon}>
            <Text style={styles.detectionIconText}>AI</Text>
          </View>
          <View>
            <Text style={styles.detectionTitle}>Detection Active</Text>
            <Text style={styles.detectionSubtitle}>Motion and face recognition</Text>
          </View>
        </View>
        <View style={styles.detectionGrid}>
          <View style={styles.detectionMetric}>
            <Text style={styles.metricLabel}>Motion Sensitivity</Text>
            <Text style={styles.metricValue}>High</Text>
          </View>
          <View style={styles.detectionMetric}>
            <Text style={styles.metricLabel}>Face Tolerance</Text>
            <Text style={styles.metricValue}>0.6</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickControls}>
        <TouchableOpacity style={[styles.quickControl, styles.snapshotControl]}>
          <Text style={styles.quickControlText}>Take Snapshot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickControl, styles.recordControl]}>
          <Text style={styles.quickControlText}>Record Clip</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
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
  feedContainer: {
    height: 360,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    overflow: "hidden",
    marginBottom: 18,
    elevation: 6,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  feedImage: { width: "100%", height: "100%" },
  reconnectWrap: { alignItems: "center", gap: 12 },
  reconnectText: { color: "#facc15", fontSize: 13, textAlign: "center" },
  errorText: { color: "#fecaca", fontSize: 13 },
  liveBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(220,38,38,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" },
  liveBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  feedTimePill: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  feedTimeText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(34,211,238,0.22)",
  },
  gridLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(34,211,238,0.22)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "48%",
    height: 2,
    backgroundColor: "rgba(34,211,238,0.75)",
  },
  feedControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: "rgba(15,23,42,0.52)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  controlSide: { flexDirection: "row", gap: 8 },
  overlayControl: {
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
  },
  overlayControlActive: { backgroundColor: "#2563eb", borderColor: "#60a5fa" },
  overlayControlText: { color: "#ffffff", fontSize: 11, fontWeight: "900" },
  cameraPill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
  },
  cameraPillText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  feedBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(15,23,42,0.76)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  feedTitle: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  feedSubtitle: { color: "#dbeafe", fontSize: 12, marginTop: 2 },
  feedPauseButton: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  feedPauseButtonActive: { backgroundColor: "#2563eb", borderColor: "#60a5fa" },
  feedPauseText: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  feedPauseTextActive: { color: "#ffffff" },
  infoCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  infoTitle: { color: "#0f172a", fontSize: 18, fontWeight: "800", marginBottom: 12 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  infoLabel: { color: "#64748b", fontSize: 13 },
  infoValue: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  infoValueGood: { color: "#16a34a" },
  infoValueWarn: { color: "#dc2626" },
  detectionCard: {
    backgroundColor: "#eef6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 20,
    padding: 18,
  },
  detectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  detectionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  detectionIconText: { color: "#2563eb", fontWeight: "900" },
  detectionTitle: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  detectionSubtitle: { color: "#64748b", fontSize: 12, marginTop: 2 },
  detectionGrid: { flexDirection: "row", gap: 10 },
  detectionMetric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.9)",
    padding: 12,
  },
  metricLabel: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  metricValue: { color: "#0f172a", fontSize: 16, fontWeight: "800", marginTop: 3 },
  quickControls: { flexDirection: "row", gap: 12, marginTop: 4 },
  quickControl: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  snapshotControl: { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe" },
  recordControl: { backgroundColor: "#ffedd5", borderColor: "#fdba74" },
  quickControlText: { color: "#0f172a", fontSize: 14, fontWeight: "800" },
});
