export type SecurityMode = "home" | "away";

export type EventType = "authorized" | "unknown" | "unverifiable";

export interface SecurityEvent {
  id: number;
  event_type: EventType;
  snapshot_path: string | null;
  alarm_triggered: boolean;
  timestamp: string;
  matched_name: string | null;
}

export interface EventsResponse {
  items: SecurityEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemStatus {
  mode: SecurityMode;
  alarm_active: boolean;
  updated_at: string;
}

export interface FaceProfile {
  id: number;
  name: string;
  registered_by: number;
  created_at: string;
}

export interface AuthSession {
  token: string;
  username: string;
  role: string;
}