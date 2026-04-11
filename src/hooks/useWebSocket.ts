import { useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { getActiveDevice } from "../lib/pi";

interface WebSocketMessage {
  type: string;
  data?: unknown;
}

interface UseWebSocketOptions {
  onSecurityEvent?: (data: unknown) => void;
  onModeChange?: (data: unknown) => void;
  onAlarmChange?: (data: unknown) => void;
  onThreatCleared?: (data: unknown) => void;
  onConfigUpdated?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions, accountId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(async () => {
    const device = await getActiveDevice(accountId);
    if (!device) return;

    const wsUrl = device.url.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    const fullUrl = `${wsUrl}/ws/live?token=${device.token}`;

    try {
      const ws = new WebSocket(fullUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 1000;
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WebSocketMessage;
          switch (msg.type) {
            case "security_event":
              options.onSecurityEvent?.(msg);
              break;
            case "mode_change":
              options.onModeChange?.(msg);
              break;
            case "alarm_change":
              options.onAlarmChange?.(msg);
              break;
            case "threat_cleared":
              options.onThreatCleared?.(msg);
              break;
            case "config_updated":
              options.onConfigUpdated?.();
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        cleanup();
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      scheduleReconnect();
    }
  }, [options, accountId]);

  const cleanup = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const disconnect = () => {
    cleanup();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const scheduleReconnect = () => {
    reconnectTimeoutRef.current = setTimeout(() => {
      void connect();
    }, reconnectDelayRef.current);
    reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
  };

  useEffect(() => {
    void connect();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          void connect();
        }
      } else if (state === "background") {
        disconnect();
      }
    });

    return () => {
      disconnect();
      subscription.remove();
    };
  }, [connect]);

  return { disconnect };
}
