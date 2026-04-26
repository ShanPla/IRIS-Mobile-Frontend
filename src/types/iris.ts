export type SecurityMode = "home" | "away";
export type EventType = "authorized" | "unknown" | "unverifiable" | "possible_threat" | "uncertain_presence";

export interface SecurityEvent {
  id: number;
  event_type: EventType;
  matched_name: string | null;
  snapshot_path: string | null;
  alarm_triggered: boolean;
  notification_sent: boolean;
  mode: string;
  notes: string | null;
  timestamp: string;
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

export interface SystemConfig {
  motion_area_threshold: number;
  detection_cooldown_seconds: number;
  face_recognition_tolerance: number;
  alarm_escalation_delay: number;
  notifications_enabled: boolean;
  include_snapshot_in_alerts: boolean;
  buzzer_enabled: boolean;
  buzzer_gpio_pin: number;
}

export interface CameraHealth {
  camera_ready: boolean;
  engine_running: boolean;
  cv2_available: boolean;
  latest_frame_ts: string | null;
  mode: string;
  alarm_active: boolean;
  known_faces: number;
  detection_state?: string;
  frame_width?: number;
  frame_height?: number;
}

export interface FaceProfile {
  id: number;
  name: string;
  image_path: string;
  registered_by: number;
  created_at: string;
  updated_at: string;
}

export interface FaceValidationResult {
  ok: boolean;
  face_detected: boolean;
  face_count?: number;
  issues: string[];
  quality_score: number;
  face_ratio?: number;
  sharpness?: number;
  brightness?: number;
  yaw?: number;
  pitch?: number;
}

export interface PermissionSet {
  can_view_events: boolean;
  can_silence_alarm: boolean;
  can_change_mode: boolean;
  can_manage_profiles: boolean;
}

export interface AuthSession {
  token: string;
  username: string;
  email: string;
  role: string;
  permissions: PermissionSet | null;
}

export interface UserResponse {
  id: number;
  username: string;
  gmail: string | null;
  role: string;
  fcm_token: string | null;
  permissions: PermissionSet | null;
}

export interface InvitedUser {
  id: number;
  username: string;
  role: string;
  permissions: PermissionSet | null;
}

export interface WebSocketEvent {
  type: "security_event" | "mode_change" | "alarm_change" | "config_updated" | "pong";
  data?: unknown;
}
