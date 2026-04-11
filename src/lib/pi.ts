import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_DEVICES_KEY = "securewatch_devices_v1";
const LEGACY_ACTIVE_KEY = "securewatch_active_device_id_v1";
const DEVICES_KEY_PREFIX = "securewatch_devices_v2_";
const ACTIVE_KEY_PREFIX = "securewatch_active_device_id_v2_";

export interface PiDevice {
  deviceId: string;
  name: string;
  url: string;
  token: string;
  addedAt: string;
  accessRole?: "primary" | "secondary";
  location?: string;
  deviceIp?: string;
  primaryEmail?: string;
}

export interface DeviceInfo {
  device_id: string;
  name: string;
  version: string;
}

export interface PairResponse {
  access_token: string;
  token_type: string;
  device_id: string;
  device_name: string;
}

const NGROK_HEADERS: HeadersInit = {
  "ngrok-skip-browser-warning": "true",
};

function authHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
    ...NGROK_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

function normalizeAccountId(accountId?: string): string {
  const normalized = (accountId ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : "guest";
}

function devicesKey(accountId?: string): string {
  return `${DEVICES_KEY_PREFIX}${normalizeAccountId(accountId)}`;
}

function activeKey(accountId?: string): string {
  return `${ACTIVE_KEY_PREFIX}${normalizeAccountId(accountId)}`;
}

async function migrateLegacyDevices(accountId?: string): Promise<PiDevice[]> {
  const legacyRaw = await AsyncStorage.getItem(LEGACY_DEVICES_KEY);
  if (!legacyRaw) return [];
  try {
    const legacyDevices = JSON.parse(legacyRaw) as PiDevice[];
    await AsyncStorage.setItem(devicesKey(accountId), legacyRaw);
    await AsyncStorage.removeItem(LEGACY_DEVICES_KEY);
    const legacyActive = await AsyncStorage.getItem(LEGACY_ACTIVE_KEY);
    if (legacyActive) {
      await AsyncStorage.setItem(activeKey(accountId), legacyActive);
      await AsyncStorage.removeItem(LEGACY_ACTIVE_KEY);
    }
    return legacyDevices;
  } catch {
    return [];
  }
}

export async function getDevices(accountId?: string): Promise<PiDevice[]> {
  const raw = await AsyncStorage.getItem(devicesKey(accountId));
  if (!raw) {
    return migrateLegacyDevices(accountId);
  }
  if (!raw) return [];
  return JSON.parse(raw) as PiDevice[];
}

export async function getActiveDevice(accountId?: string): Promise<PiDevice | null> {
  const devices = await getDevices(accountId);
  if (devices.length === 0) return null;
  const activeId = await AsyncStorage.getItem(activeKey(accountId));
  if (activeId) {
    const found = devices.find((d) => d.deviceId === activeId);
    if (found) return found;
  }
  return devices[0];
}

export async function setActiveDevice(deviceId: string, accountId?: string): Promise<void> {
  await AsyncStorage.setItem(activeKey(accountId), deviceId);
}

export async function addDevice(
  url: string,
  deviceIp: string,
  primaryEmail: string,
  accountId?: string,
): Promise<PiDevice> {
  const normalizedUrl = url.trim().replace(/\/$/, "");
  const trimmedIp = deviceIp.trim();
  const fallbackId = `SW-${trimmedIp.replace(/[^a-zA-Z0-9]/g, "-")}`;

  let info: DeviceInfo | null = null;
  try {
    const infoRes = await fetch(`${normalizedUrl}/api/device/info`, {
      headers: NGROK_HEADERS,
    });
    if (infoRes.ok) {
      info = (await infoRes.json()) as DeviceInfo;
    }
  } catch {
    info = null;
  }

  const device: PiDevice = {
    deviceId: info?.device_id ?? fallbackId,
    name: info?.name ?? `Device ${trimmedIp}`,
    url: normalizedUrl,
    token: "",
    addedAt: new Date().toISOString(),
    accessRole: "primary",
    deviceIp: trimmedIp,
    primaryEmail: primaryEmail.trim(),
  };

  const devices = await getDevices(accountId);
  const existing = devices.findIndex((d) => d.deviceId === device.deviceId);
  if (existing >= 0) {
    devices[existing] = device;
  } else {
    devices.push(device);
  }
  await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(devices));
  await setActiveDevice(device.deviceId, accountId);
  return device;
}

export async function removeDevice(deviceId: string, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  const filtered = devices.filter((d) => d.deviceId !== deviceId);
  await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(filtered));

  const activeId = await AsyncStorage.getItem(activeKey(accountId));
  if (activeId === deviceId) {
    if (filtered.length > 0) {
      await setActiveDevice(filtered[0].deviceId, accountId);
    } else {
      await AsyncStorage.removeItem(activeKey(accountId));
    }
  }
}

export async function piGet<T>(path: string, accountId?: string): Promise<T> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    headers: authHeaders(device.token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi GET ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPost<T>(path: string, body?: unknown, accountId?: string): Promise<T> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  return piPostToDevice(device, path, body);
}

async function updateDeviceToken(deviceId: string, token: string, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx] = { ...devices[idx], token };
    await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(devices));
  }
}

export async function ensureDeviceAuth(username: string, password: string, accountId?: string): Promise<void> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  if (device.token) return;

  const res = await fetch(`${device.url}/api/auth/login`, {
    method: "POST",
    headers: {
      ...NGROK_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username, password }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Device login failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  await updateDeviceToken(device.deviceId, data.access_token, accountId);
}

export async function piPostToDevice<T>(device: PiDevice, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${device.url}${path}`, {
    method: "POST",
    headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPostForm<T>(path: string, formData: FormData, accountId?: string): Promise<T> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "POST",
    headers: authHeaders(device.token),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPut<T>(path: string, body?: unknown, accountId?: string): Promise<T> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "PUT",
    headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi PUT ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piDelete<T>(path: string, accountId?: string): Promise<T | null> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "DELETE",
    headers: authHeaders(device.token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi DELETE ${path} failed (${res.status}): ${err}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function buildPiUrl(path: string, accountId?: string): Promise<string> {
  const device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  const sep = path.includes("?") ? "&" : "?";
  return device.token ? `${device.url}${path}${sep}token=${device.token}` : `${device.url}${path}`;
}

export async function hasDevices(accountId?: string): Promise<boolean> {
  const devices = await getDevices(accountId);
  return devices.length > 0;
}
