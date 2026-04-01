import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICES_KEY = "iris_pi_devices";
const ACTIVE_KEY = "iris_active_device_id";

export interface PiDevice {
  deviceId: string;
  name: string;
  url: string;
  token: string;
  addedAt: string;
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

export async function getDevices(): Promise<PiDevice[]> {
  const raw = await AsyncStorage.getItem(DEVICES_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as PiDevice[];
}

export async function getActiveDevice(): Promise<PiDevice | null> {
  const devices = await getDevices();
  if (devices.length === 0) return null;
  const activeId = await AsyncStorage.getItem(ACTIVE_KEY);
  if (activeId) {
    const found = devices.find((d) => d.deviceId === activeId);
    if (found) return found;
  }
  return devices[0];
}

export async function setActiveDevice(deviceId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, deviceId);
}

export async function addDevice(
  url: string,
  deviceId: string,
  username: string,
  password: string,
): Promise<PiDevice> {
  const normalizedUrl = url.trim().replace(/\/$/, "");

  // Step 1: Verify device ID
  const infoRes = await fetch(`${normalizedUrl}/api/device/info`, {
    headers: NGROK_HEADERS,
  });
  if (!infoRes.ok) throw new Error("Cannot reach Pi at that URL");
  const info = (await infoRes.json()) as DeviceInfo;
  if (info.device_id !== deviceId) {
    throw new Error(`Device ID mismatch: expected ${deviceId}, got ${info.device_id}`);
  }

  // Step 2: Pair (login or auto-register)
  const pairRes = await fetch(`${normalizedUrl}/api/device/pair`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, username, password }),
  });
  if (!pairRes.ok) {
    const err = (await pairRes.json().catch(() => ({ detail: "Pairing failed" }))) as { detail: string };
    throw new Error(err.detail);
  }
  const pair = (await pairRes.json()) as PairResponse;

  // Step 3: Store device
  const device: PiDevice = {
    deviceId: pair.device_id,
    name: pair.device_name,
    url: normalizedUrl,
    token: pair.access_token,
    addedAt: new Date().toISOString(),
  };

  const devices = await getDevices();
  const existing = devices.findIndex((d) => d.deviceId === device.deviceId);
  if (existing >= 0) {
    devices[existing] = device;
  } else {
    devices.push(device);
  }
  await AsyncStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  await setActiveDevice(device.deviceId);
  return device;
}

export async function removeDevice(deviceId: string): Promise<void> {
  const devices = await getDevices();
  const filtered = devices.filter((d) => d.deviceId !== deviceId);
  await AsyncStorage.setItem(DEVICES_KEY, JSON.stringify(filtered));

  const activeId = await AsyncStorage.getItem(ACTIVE_KEY);
  if (activeId === deviceId) {
    if (filtered.length > 0) {
      await setActiveDevice(filtered[0].deviceId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_KEY);
    }
  }
}

export async function piGet<T>(path: string): Promise<T> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    headers: {
      ...NGROK_HEADERS,
      Authorization: `Bearer ${device.token}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi GET ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPost<T>(path: string, body?: unknown): Promise<T> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "POST",
    headers: {
      ...NGROK_HEADERS,
      Authorization: `Bearer ${device.token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPostForm<T>(path: string, formData: FormData): Promise<T> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "POST",
    headers: {
      ...NGROK_HEADERS,
      Authorization: `Bearer ${device.token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPut<T>(path: string, body?: unknown): Promise<T> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "PUT",
    headers: {
      ...NGROK_HEADERS,
      Authorization: `Bearer ${device.token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi PUT ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piDelete<T>(path: string): Promise<T | null> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const res = await fetch(`${device.url}${path}`, {
    method: "DELETE",
    headers: {
      ...NGROK_HEADERS,
      Authorization: `Bearer ${device.token}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi DELETE ${path} failed (${res.status}): ${err}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function buildPiUrl(path: string): Promise<string> {
  const device = await getActiveDevice();
  if (!device) throw new Error("No active Pi device");
  const sep = path.includes("?") ? "&" : "?";
  return `${device.url}${path}${sep}token=${device.token}`;
}

export async function hasDevices(): Promise<boolean> {
  const devices = await getDevices();
  return devices.length > 0;
}
