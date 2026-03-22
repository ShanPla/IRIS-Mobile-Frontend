import { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { getStoredBackendUrl, getStoredToken } from "../../lib/api";
import { styles } from "./styles";

export default function LiveFeedScreen() {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [key, setKey] = useState(0);

  useEffect(() => { void buildFeedUrl(); }, []);

  const buildFeedUrl = async () => {
    setLoading(true);
    setError("");
    try {
      const base = await getStoredBackendUrl();
      const token = await getStoredToken();
      if (!base) { setError("Backend not configured."); return; }
      setFeedUrl(`${base}/api/camera/stream${token ? `?token=${token}` : ""}`);
    } catch {
      setError("Failed to build feed URL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Feed</Text>
      <Text style={styles.desc}>Streaming from Raspberry Pi camera</Text>

      {loading ? (
        <ActivityIndicator color="#22d3ee" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.feedWrapper}>
          <Image
            key={key}
            source={{ uri: feedUrl! }}
            style={styles.feed}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.refreshBtn} onPress={() => setKey((k) => k + 1)}>
            <Text style={styles.refreshBtnText}>🔄 Refresh Frame</Text>
          </TouchableOpacity>
          <Text style={styles.note}>
            Note: Live MJPEG streaming may not work in all environments. Use refresh if the feed is static.
          </Text>
        </View>
      )}
    </View>
  );
}