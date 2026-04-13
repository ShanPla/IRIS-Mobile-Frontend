import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  ArrowLeft,
  Camera,
  MicOff,
  RefreshCw,
  ScanLine,
  Video,
  Volume2,
} from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { buildPiUrl } from "../../lib/pi";
import { cardShadow, referenceColors, referenceLiveImage } from "../../theme/reference";

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
    const getDelay = () => (consecutiveFailsRef.current >= 5 ? 500 : 150);
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
    <View style={styles.container}>
      <ReferenceBackdrop />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Live Monitor</Text>
            <Text style={styles.subtitle}>Real-time camera feed</Text>
          </View>
        </View>

        <View style={styles.feedCard}>
          {loading ? (
            <ActivityIndicator color="#ffffff" size="large" />
          ) : reconnecting ? (
            <View style={styles.centerFeedState}>
              <ActivityIndicator color="#facc15" size="large" />
              <Text style={styles.reconnectText}>Stream interrupted. Reconnecting...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerFeedState}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <Image source={{ uri: frameUri || referenceLiveImage }} style={styles.feedImage} resizeMode="cover" />
          )}

          {(loading || reconnecting || error) && <Image source={{ uri: referenceLiveImage }} style={styles.feedFallback} resizeMode="cover" />}

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{paused ? "PAUSED" : "LIVE"}</Text>
          </View>

          <View style={styles.timePill}>
            <Text style={styles.timeText}>{new Date().toLocaleTimeString()}</Text>
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
            <View style={styles.controlCluster}>
              <TouchableOpacity style={styles.overlayControl} onPress={() => void handleRefresh()}>
                <RefreshCw size={16} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.overlayControl} onPress={() => setIsMuted((value) => !value)}>
                {isMuted ? <MicOff size={16} color="#ffffff" strokeWidth={2.2} /> : <Volume2 size={16} color="#ffffff" strokeWidth={2.2} />}
              </TouchableOpacity>
            </View>

            <View style={styles.cameraPill}>
              <Camera size={15} color="#ffffff" strokeWidth={2.2} />
              <Text style={styles.cameraPillText}>Front Door</Text>
            </View>

            <View style={styles.controlCluster}>
              <TouchableOpacity style={styles.overlayControl}>
                <ScanLine size={16} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.overlayControl, paused && styles.overlayControlActive]}
                onPress={() => setPaused((value) => !value)}
              >
                <Video size={16} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Stream Information</Text>
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
            <Text style={[styles.infoValue, reconnecting || error ? styles.warnText : styles.goodText]}>
              {reconnecting ? "Reconnecting" : error ? "Interrupted" : "124ms"}
            </Text>
          </View>
        </View>

        <View style={styles.detectionCard}>
          <View style={styles.detectionHeader}>
            <View style={styles.detectionIcon}>
              <ScanLine size={20} color={referenceColors.primary} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Detection Active</Text>
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

        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickButton, styles.quickButtonPurple]}>
            <Text style={styles.quickButtonText}>{isRefreshing ? "Refreshing..." : "Take Snapshot"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickButton, styles.quickButtonOrange]}>
            <Text style={styles.quickButtonText}>Record Clip</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  feedCard: {
    height: 380,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    ...cardShadow,
  },
  feedImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  feedFallback: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.28,
  },
  centerFeedState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 2,
  },
  reconnectText: {
    color: "#fde68a",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
  errorText: {
    color: "#fecaca",
    fontSize: 13,
    textAlign: "center",
  },
  liveBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.92)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  liveBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  timePill: {
    position: "absolute",
    top: 14,
    right: 14,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.78)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
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
    backgroundColor: "rgba(34,211,238,0.74)",
  },
  feedControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    backgroundColor: "rgba(15,23,42,0.56)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  controlCluster: {
    flexDirection: "row",
    gap: 8,
  },
  overlayControl: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayControlActive: {
    backgroundColor: referenceColors.primary,
    borderColor: "#60a5fa",
  },
  cameraPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cameraPillText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    ...cardShadow,
  },
  cardTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 12,
    paddingTop: 12,
  },
  infoLabel: {
    color: referenceColors.textMuted,
    fontSize: 13,
  },
  infoValue: {
    color: referenceColors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  warnText: {
    color: referenceColors.danger,
  },
  goodText: {
    color: referenceColors.success,
  },
  detectionCard: {
    backgroundColor: "rgba(238,246,255,0.84)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 24,
    padding: 18,
    ...cardShadow,
  },
  detectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
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
  detectionSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  detectionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  detectionMetric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: {
    color: referenceColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: referenceColors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  quickButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
  quickButtonPurple: {
    backgroundColor: "#f3e8ff",
    borderColor: "#d8b4fe",
  },
  quickButtonOrange: {
    backgroundColor: "#ffedd5",
    borderColor: "#fdba74",
  },
  quickButtonText: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
