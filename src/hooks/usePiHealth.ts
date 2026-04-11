import { useState, useEffect, useRef } from "react";
import { piGet } from "../lib/pi";
import type { CameraHealth } from "../types/iris";

export function usePiHealth(pollInterval = 5000, accountId?: string) {
  const [health, setHealth] = useState<CameraHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await piGet<CameraHealth>("/health/camera", accountId);
        setHealth(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Health check failed");
      } finally {
        setLoading(false);
      }
    };

    void fetchHealth();
    intervalRef.current = setInterval(() => void fetchHealth(), pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollInterval, accountId]);

  return { health, loading, error };
}
