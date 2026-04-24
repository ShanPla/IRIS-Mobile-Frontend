import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Modal,
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
  RefreshCw,
  ScanLine,
  Video,
  X,
} from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { buildPiUrl, getActiveDevice } from "../../lib/pi";
import { getCachedResolution, invalidateBaseUrlCache } from "../../lib/resolveBaseUrl";
import { saveRemoteImageToLibrary } from "../../lib/saveImage";
import { cardShadow, referenceColors, referenceLiveImage } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

const POLL_INTERVAL_MS = 100;          // between successful loads — tight loop, actual cadence bounded by server+network
const POLL_RETRY_INTERVAL_MS = 500;    // after consecutive failures, back off
const RECONNECT_THRESHOLD = 5;          // fails before showing "Reconnecting" UI

export default function LiveFeedScreen() {
  const navigation = useNavigation();
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "tab" });
  const [frameUri, setFrameUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [transport, setTransport] = useState<"lan" | "tunnel" | "unknown">("unknown");
  const [measuredFps, setMeasuredFps] = useState(0);
  const [lastFrameMs, setLastFrameMs] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailsRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  // Backpressure gate: while a frame is in flight (fetched URL set, but <Image>
  // hasn't yet fired onLoad/onError) we don't schedule another. Replaces the
  // old unconditional setInterval that queued requests.
  const inFlightRef = useRef(false);
  const frameStartRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);

  // Re-probe LAN on foreground so a Wi-Fi ↔ cellular change picks the right path.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        invalidateBaseUrlCache();
      }
    });
    return () => sub.remove();
  }, []);

  // Polling driver. The `requestFrame` function is stored in a ref so that
  // <Image onLoad|onError> callbacks can trigger the next poll without a
  // closure-capture dance across effect boundaries.
  const requestFrameRef = useRef<() => void>(() => {});
  const pausedRef = useRef(paused);
  const cancelledRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    cancelledRef.current = false;

    const schedule = (delay: number) => {
      if (cancelledRef.current || pausedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => void requestFrameRef.current(), delay);
    };

    const requestFrame = async () => {
      if (cancelledRef.current || pausedRef.current || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
        const device = await getActiveDevice(session?.username);
        if (device) {
          const res = getCachedResolution(device.deviceId);
          setTransport(res?.isLan ? "lan" : res ? "tunnel" : "unknown");
        }
        frameStartRef.current = Date.now();
        setFrameUri(url);
        // inFlightRef stays true until <Image onLoad|onError> fires.
      } catch (e) {
        inFlightRef.current = false;
        consecutiveFailsRef.current += 1;
        if (consecutiveFailsRef.current >= RECONNECT_THRESHOLD) {
          setReconnecting(true);
          setError("");
        } else {
          setError(e instanceof Error ? e.message : "Cannot load frame");
        }
        setLoading(false);
        schedule(POLL_RETRY_INTERVAL_MS);
      }
    };

    requestFrameRef.current = () => void requestFrame();

    if (paused) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    void requestFrame();

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [paused, session?.username]);

  const onImageLoad = () => {
    inFlightRef.current = false;
    consecutiveFailsRef.current = 0;
    setReconnecting(false);
    setLoading(false);
    setError("");

    const now = Date.now();
    setLastFrameMs(now - frameStartRef.current);
    const times = frameTimesRef.current;
    times.push(now);
    while (times.length > 0 && times[0] < now - 2000) times.shift();
    if (times.length >= 2) {
      const windowMs = now - times[0];
      setMeasuredFps(Math.round((times.length - 1) / (windowMs / 1000)));
    }

    if (!pausedRef.current && !cancelledRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => requestFrameRef.current(), POLL_INTERVAL_MS);
    }
  };

  const onImageError = () => {
    inFlightRef.current = false;
    consecutiveFailsRef.current += 1;
    if (consecutiveFailsRef.current >= RECONNECT_THRESHOLD) {
      setReconnecting(true);
      setError("");
    } else {
      setError("Cannot load frame");
    }
    setLoading(false);
    if (!pausedRef.current && !cancelledRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => requestFrameRef.current(), POLL_RETRY_INTERVAL_MS);
    }
  };

  const handleRefresh = async () => {
    try {
      invalidateBaseUrlCache();
      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
      setFrameUri(url);
      setLoading(false);
      setError("");
      setReconnecting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot refresh frame");
    }
  };

  const handleSnapshot = async () => {
    if (savingSnapshot) return;
    setSavingSnapshot(true);
    try {
      const url = await buildPiUrl(`/api/camera/frame?v=${Date.now()}`, session?.username);
      await saveRemoteImageToLibrary(url);
      Alert.alert("Snapshot saved", "Saved to your Photos in the IRIS album.");
    } catch (e) {
      Alert.alert("Snapshot failed", e instanceof Error ? e.message : "Could not save snapshot");
    } finally {
      setSavingSnapshot(false);
    }
  };
  const feedHeight = getResponsiveMediaHeight(layout.width, { min: 260, max: 420, ratio: 0.9 });

  return (
    <View style={styles.container}>
      <ReferenceBackdrop />
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[styles.content, layout.contentStyle]}
      >
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

        <View style={[styles.feedCard, { height: feedHeight }]}>
          {/* Image must always mount when a URI is set, otherwise onLoad/onError
              never fires and the polling loop stalls. Spinners/errors overlay on top. */}
          {frameUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              style={StyleSheet.absoluteFill}
              onPress={() => setFullscreenOpen(true)}
              disabled={!!error || reconnecting}
            >
              <Image
                source={{ uri: frameUri }}
                style={styles.feedImage}
                resizeMode="cover"
                onLoad={onImageLoad}
                onError={onImageError}
              />
            </TouchableOpacity>
          ) : (
            <Image source={{ uri: referenceLiveImage }} style={styles.feedFallback} resizeMode="cover" />
          )}

          {loading && !reconnecting && !error && (
            <View style={[StyleSheet.absoluteFillObject, styles.centerFeedState]}>
              <ActivityIndicator color="#ffffff" size="large" />
            </View>
          )}
          {reconnecting && (
            <View style={[StyleSheet.absoluteFillObject, styles.centerFeedState]}>
              <ActivityIndicator color="#facc15" size="large" />
              <Text style={styles.reconnectText}>Stream interrupted. Reconnecting...</Text>
            </View>
          )}
          {error && !reconnecting && (
            <View style={[StyleSheet.absoluteFillObject, styles.centerFeedState]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

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
          </View>

          <View style={styles.feedControls}>
            <TouchableOpacity style={styles.overlayControl} onPress={() => void handleRefresh()}>
              <RefreshCw size={16} color="#ffffff" strokeWidth={2.2} />
            </TouchableOpacity>

            <View style={styles.cameraPill}>
              <Camera size={15} color="#ffffff" strokeWidth={2.2} />
              <Text style={styles.cameraPillText}>Front Door</Text>
            </View>

            <TouchableOpacity
              style={[styles.overlayControl, paused && styles.overlayControlActive]}
              onPress={() => setPaused((value) => !value)}
            >
              <Video size={16} color="#ffffff" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Stream Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Resolution</Text>
            <Text style={styles.infoValue}>640 x 480</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Frame Rate</Text>
            <Text style={styles.infoValue}>
              {paused ? "Paused" : measuredFps > 0 ? `${measuredFps} FPS` : "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Transport</Text>
            <Text style={[styles.infoValue, transport === "lan" ? styles.goodText : transport === "tunnel" ? styles.warnText : null]}>
              {transport === "lan" ? "LAN direct" : transport === "tunnel" ? "Cloudflare tunnel" : "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Latency</Text>
            <Text style={[styles.infoValue, reconnecting || error ? styles.warnText : styles.goodText]}>
              {reconnecting ? "Reconnecting" : error ? "Interrupted" : lastFrameMs != null ? `${lastFrameMs}ms` : "—"}
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
          <TouchableOpacity
            style={[styles.quickButton, styles.quickButtonPurple]}
            onPress={() => void handleSnapshot()}
            disabled={savingSnapshot}
          >
            <Text style={styles.quickButtonText}>
              {savingSnapshot ? "Saving..." : "Take Snapshot"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>

      <Modal
        visible={fullscreenOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenOpen(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          {frameUri ? (
            <Image
              source={{ uri: frameUri }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: layout.insets.top + 12 }]}
            onPress={() => setFullscreenOpen(false)}
          >
            <X size={20} color="#ffffff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </Modal>
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
    flex: 1,
    minWidth: 0,
  },
  infoValue: {
    color: referenceColors.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
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
  quickButtonText: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  fullscreenClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,23,42,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
});
