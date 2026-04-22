import type { AuthSession, UserResponse } from "../types/iris";

export interface CentralDevice {
  device_id: string;
  device_name: string;
  device_url: string;
  device_ip: string | null;
  primary_gmail?: string | null;
  status: string;
  last_heartbeat: string | null;
  paired_at?: string | null;
  last_active?: string | null;
  access_role?: "primary" | "secondary";
}

export const DEVICE_OFFLINE_MESSAGE = "Device is not online\nCheck that heartbeat is running on the Pi";
export const DEVICE_TUNNEL_MESSAGE = "Device has not reported tunnel or LAN IP yet\nCheck that heartbeat is running on the Pi";

const FALLBACK_BACKEND_URL = "https://iris-back-end.onrender.com";
const ENV_BACKEND_URL = (
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.EXPO_PUBLIC_API_URL ?? ""
).trim();

function normalizeBackendUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

export const CENTRAL_BACKEND_URL = normalizeBackendUrl(ENV_BACKEND_URL) || FALLBACK_BACKEND_URL;

async function parseBackendError(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { detail?: string };
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    }

    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    // Ignore parsing failures and use the fallback.
  }

  return fallback;
}

async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CENTRAL_BACKEND_URL}${path}`, init);
}

function friendlyDeviceLookupError(status: number, message: string): string {
  const normalized = message.toLowerCase();
  if (status === 404 || normalized.includes("not found") || normalized.includes("not online")) {
    return DEVICE_OFFLINE_MESSAGE;
  }
  if (normalized.includes("tunnel")) {
    return DEVICE_TUNNEL_MESSAGE;
  }
  return message;
}

function bearerHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    ...(extra ?? {}),
  };
}

export async function registerCentralAccount(username: string, gmail: string, password: string): Promise<UserResponse> {
  const response = await backendFetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, gmail, password }),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Registration failed (${response.status}).`));
  }

  return (await response.json()) as UserResponse;
}

export async function getCentralCurrentUser(token: string): Promise<UserResponse> {
  const response = await backendFetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Failed to load account details (${response.status}).`));
  }

  return (await response.json()) as UserResponse;
}

export async function loginCentralAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const response = await backendFetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username, password }).toString(),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Login failed (${response.status}).`));
  }

  const tokenData = (await response.json()) as { access_token: string };
  const user = await getCentralCurrentUser(tokenData.access_token);

  return {
    token: tokenData.access_token,
    username: user.username,
    email: user.gmail ?? "",
    role: user.role,
  };
}

export async function changeCentralPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const session = await loginCentralAccount(username, currentPassword);
  const response = await backendFetch("/api/auth/me/password", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Password change failed (${response.status}).`));
  }
}

export async function resolveCentralDevice(deviceId: string, token: string): Promise<CentralDevice> {
  const response = await backendFetch(`/api/auth/devices/${encodeURIComponent(deviceId.trim().toUpperCase())}`, {
    headers: bearerHeaders(token),
  });

  if (!response.ok) {
    const message = await parseBackendError(response, `Device lookup failed (${response.status}).`);
    throw new Error(friendlyDeviceLookupError(response.status, message));
  }

  return (await response.json()) as CentralDevice;
}

export async function listCentralDevices(token: string): Promise<CentralDevice[]> {
  const response = await backendFetch("/api/auth/me/devices", {
    headers: bearerHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Failed to load paired devices (${response.status}).`));
  }

  return (await response.json()) as CentralDevice[];
}

export async function pairCentralDevice(
  deviceId: string,
  token: string,
  connection?: Partial<Pick<CentralDevice, "device_name" | "device_url" | "device_ip" | "primary_gmail">>,
): Promise<CentralDevice> {
  const response = await backendFetch("/api/auth/me/devices", {
    method: "POST",
    headers: bearerHeaders(token, {
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      device_id: deviceId.trim().toUpperCase(),
      device_name: connection?.device_name,
      device_url: connection?.device_url,
      device_ip: connection?.device_ip,
      primary_gmail: connection?.primary_gmail,
    }),
  });

  if (!response.ok) {
    const message = await parseBackendError(response, `Device pairing failed (${response.status}).`);
    throw new Error(friendlyDeviceLookupError(response.status, message));
  }

  return (await response.json()) as CentralDevice;
}

export async function unpairCentralDevice(deviceId: string, token: string): Promise<void> {
  const response = await backendFetch(`/api/auth/me/devices/${encodeURIComponent(deviceId.trim().toUpperCase())}`, {
    method: "DELETE",
    headers: bearerHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await parseBackendError(response, `Device removal failed (${response.status}).`));
  }
}
