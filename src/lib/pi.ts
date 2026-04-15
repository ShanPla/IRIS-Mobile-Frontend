import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PermissionSet, UserResponse } from "../types/iris";

const LEGACY_DEVICES_KEY = "securewatch_devices_v1";
const LEGACY_ACTIVE_KEY = "securewatch_active_device_id_v1";
const DEVICES_KEY_PREFIX = "securewatch_devices_v2_";
const ACTIVE_KEY_PREFIX = "securewatch_active_device_id_v2_";
const ACCOUNTS_STORAGE_KEY = "securewatch_accounts_v1";

interface StoredAccountShape {
  username: string;
  password: string;
  provider?: string;
}

async function recoverActiveDeviceToken(accountId?: string): Promise<boolean> {
  const normalized = (accountId ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const raw = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
  if (!raw) return false;

  let accounts: StoredAccountShape[] = [];
  try {
    accounts = JSON.parse(raw) as StoredAccountShape[];
  } catch {
    return false;
  }

  const account = accounts.find((a) => a.username.trim().toLowerCase() === normalized);
  if (!account?.password) return false;

  try {
    await loginDeviceAccount(account.username, account.password, accountId);
    return true;
  } catch {
    try {
      await registerDeviceAccount(account.username, account.password, accountId);
      await loginDeviceAccount(account.username, account.password, accountId);
      return true;
    } catch {
      return false;
    }
  }
}

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

interface DeviceAuthResult {
  accessToken: string;
  user: UserResponse;
  device: PiDevice;
  accountId?: string;
}

interface GoogleDeviceAuthResponse {
  access_token: string;
  token_type: string;
  username: string;
  email: string;
  role: string;
}

interface GoogleDeviceAuthResult {
  accessToken: string;
  username: string;
  email: string;
  role: string;
  device: PiDevice;
  accountId?: string;
}

export interface DeviceInviteResult {
  invite_code: string;
  device_id: string;
  device_name: string;
  expires_at: string;
  permissions: PermissionSet;
}

interface DecodedDeviceInvite {
  device_id: string;
  device_name?: string;
  device_url: string;
  device_ip?: string | null;
  invited_username: string;
  exp?: number;
}

interface RedeemDeviceInviteResult {
  access_token: string;
  token_type: string;
  device_id: string;
  device_name: string;
  device_url: string;
  device_ip?: string | null;
  access_role: "secondary";
}

const NGROK_HEADERS: HeadersInit = {
  "ngrok-skip-browser-warning": "true",
};

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const char of padded) {
    if (char === "=") {
      break;
    }

    const index = BASE64_CHARS.indexOf(char);
    if (index < 0) {
      continue;
    }

    buffer = (buffer << 6) | index;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

export function parseDeviceInviteCode(inviteCode: string): DecodedDeviceInvite {
  const parts = inviteCode.trim().split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Invalid invite code");
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as DecodedDeviceInvite;
  } catch {
    throw new Error("Invite code could not be read");
  }
}

function buildScopeList(...accountIds: Array<string | undefined>): Array<string | undefined> {
  const seen = new Set<string>();
  const scopes: Array<string | undefined> = [];

  for (const accountId of accountIds) {
    const normalized = normalizeAccountId(accountId);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    scopes.push(accountId);
  }

  return scopes;
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { detail?: string };
      if (data.detail) return data.detail;
    }

    const text = (await res.text()).trim();
    if (text) return text;
  } catch {
    // Ignore parsing failures and use the fallback.
  }

  return fallback;
}

async function getCandidateDevices(...accountIds: Array<string | undefined>): Promise<Array<{ accountId?: string; device: PiDevice }>> {
  const seen = new Set<string>();
  const candidates: Array<{ accountId?: string; device: PiDevice }> = [];

  for (const accountId of buildScopeList(...accountIds)) {
    const devices = await getDevices(accountId);
    if (devices.length === 0) continue;

    const activeId = await AsyncStorage.getItem(activeKey(accountId));
    const ordered = activeId
      ? [
          ...devices.filter((device) => device.deviceId === activeId),
          ...devices.filter((device) => device.deviceId !== activeId),
        ]
      : devices;

    for (const device of ordered) {
      const key = `${normalizeAccountId(accountId)}:${device.deviceId}:${device.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ accountId, device });
    }
  }

  return candidates;
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

  if (!info?.device_id) {
    throw new Error("Couldn't reach the camera at that URL. Check the URL and that the device is online.");
  }

  const devices = await getDevices(accountId);
  if (devices.some((d) => d.deviceId === info!.device_id)) {
    throw new Error("This camera is already added to your account.");
  }

  const device: PiDevice = {
    deviceId: info.device_id,
    name: info.name ?? `Device ${trimmedIp}`,
    url: normalizedUrl,
    token: "",
    addedAt: new Date().toISOString(),
    accessRole: "primary",
    deviceIp: trimmedIp,
    primaryEmail: primaryEmail.trim(),
  };

  devices.push(device);
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

export async function createTrustedUserInvite(
  username: string,
  permissions: PermissionSet,
  accountId?: string,
): Promise<DeviceInviteResult> {
  return piPost<DeviceInviteResult>(
    "/api/auth/device-invites",
    {
      username,
      ...permissions,
    },
    accountId,
  );
}

export async function redeemTrustedUserInvite(
  deviceId: string,
  inviteCode: string,
  username: string,
  password: string,
  accountId?: string,
): Promise<PiDevice> {
  const decoded = parseDeviceInviteCode(inviteCode);

  if (!decoded.device_url) {
    throw new Error("Invite code is missing device connection details");
  }
  if (decoded.device_id !== deviceId.trim()) {
    throw new Error("Device code does not match this invite code");
  }
  if (decoded.invited_username.toLowerCase() !== username.trim().toLowerCase()) {
    throw new Error("Invite code was created for a different username");
  }

  const response = await fetch(`${decoded.device_url}/api/auth/device-invites/redeem`, {
    method: "POST",
    headers: {
      ...NGROK_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_id: deviceId.trim(),
      invite_code: inviteCode.trim(),
      username: username.trim(),
      password,
    }),
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response, `Invite redemption failed (${response.status}).`);
    throw new Error(message);
  }

  const data = (await response.json()) as RedeemDeviceInviteResult;
  const sharedDevice: PiDevice = {
    deviceId: data.device_id,
    name: data.device_name,
    url: data.device_url,
    token: data.access_token,
    addedAt: new Date().toISOString(),
    accessRole: "secondary",
    deviceIp: data.device_ip ?? decoded.device_ip ?? "",
    primaryEmail: "",
  };

  await upsertDevice(sharedDevice, accountId);
  await setActiveDevice(sharedDevice.deviceId, accountId);
  return sharedDevice;
}

export async function piGet<T>(path: string, accountId?: string): Promise<T> {
  const doGet = async (): Promise<Response> => {
    const device = await getActiveDevice(accountId);
    if (!device) throw new Error("No active Pi device");
    return fetch(`${device.url}${path}`, { headers: authHeaders(device.token) });
  };

  let res = await doGet();
  if (res.status === 401 && (await recoverActiveDeviceToken(accountId))) {
    res = await doGet();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi GET ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPost<T>(path: string, body?: unknown, accountId?: string): Promise<T> {
  const attempt = async (): Promise<Response> => {
    const device = await getActiveDevice(accountId);
    if (!device) throw new Error("No active Pi device");
    return fetch(`${device.url}${path}`, {
      method: "POST",
      headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await attempt();
  if (res.status === 401 && (await recoverActiveDeviceToken(accountId))) {
    res = await attempt();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

async function updateDeviceToken(deviceId: string, token: string, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    devices[idx] = { ...devices[idx], token };
    await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(devices));
  }
}

async function upsertDevice(device: PiDevice, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  const index = devices.findIndex((existing) => existing.deviceId === device.deviceId);
  if (index >= 0) {
    devices[index] = {
      ...devices[index],
      ...device,
    };
  } else {
    devices.push(device);
  }

  await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(devices));
}

export async function registerDeviceAccount(
  username: string,
  password: string,
  preferredAccountId?: string,
): Promise<void> {
  const candidates = await getCandidateDevices(preferredAccountId, username, undefined);
  if (candidates.length === 0) {
    throw new Error("Add a device on the Setup screen before creating an account.");
  }

  let lastError = "Unable to create the account on any configured device.";

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${candidate.device.url}/api/auth/register`, {
        method: "POST",
        headers: {
          ...NGROK_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) return;

      lastError = await parseErrorMessage(res, `Registration failed (${res.status}).`);
      if (res.status < 500) {
        throw new Error(lastError);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

export async function loginDeviceAccount(
  username: string,
  password: string,
  preferredAccountId?: string,
): Promise<DeviceAuthResult> {
  const candidates = await getCandidateDevices(preferredAccountId, username, undefined);
  if (candidates.length === 0) {
    throw new Error("Add a device on the Setup screen before signing in.");
  }

  let lastError = "Invalid username or password";

  for (const candidate of candidates) {
    try {
      const loginRes = await fetch(`${candidate.device.url}/api/auth/login`, {
        method: "POST",
        headers: {
          ...NGROK_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password }).toString(),
      });

      if (!loginRes.ok) {
        lastError = await parseErrorMessage(loginRes, `Device login failed (${loginRes.status}).`);
        if (loginRes.status === 401 || loginRes.status === 400) {
          continue;
        }
        throw new Error(lastError);
      }

      const data = (await loginRes.json()) as { access_token: string };
      await updateDeviceToken(candidate.device.deviceId, data.access_token, candidate.accountId);

      const meRes = await fetch(`${candidate.device.url}/api/auth/me`, {
        headers: authHeaders(data.access_token),
      });
      if (!meRes.ok) {
        lastError = await parseErrorMessage(meRes, `Failed to load account details (${meRes.status}).`);
        throw new Error(lastError);
      }

      const user = (await meRes.json()) as UserResponse;
      return {
        accessToken: data.access_token,
        user,
        device: candidate.device,
        accountId: candidate.accountId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

export async function loginDeviceWithGoogle(
  idToken: string,
  preferredAccountId?: string,
): Promise<GoogleDeviceAuthResult> {
  const candidates = await getCandidateDevices(preferredAccountId, undefined);
  if (candidates.length === 0) {
    throw new Error("Add a device on the Setup screen before using Google sign in.");
  }

  let lastError = "Google sign-in failed";

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate.device.url}/api/auth/google`, {
        method: "POST",
        headers: {
          ...NGROK_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id_token: idToken.trim() }),
      });

      if (!response.ok) {
        lastError = await parseErrorMessage(response, `Google sign-in failed (${response.status}).`);
        continue;
      }

      const data = (await response.json()) as GoogleDeviceAuthResponse;
      await updateDeviceToken(candidate.device.deviceId, data.access_token, candidate.accountId);

      return {
        accessToken: data.access_token,
        username: data.username,
        email: data.email,
        role: data.role,
        device: candidate.device,
        accountId: candidate.accountId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

export async function transferDevices(fromAccountId: string | undefined, toAccountId: string | undefined): Promise<void> {
  if (normalizeAccountId(fromAccountId) === normalizeAccountId(toAccountId)) return;

  const sourceDevices = await getDevices(fromAccountId);
  if (sourceDevices.length === 0) return;

  const destinationDevices = await getDevices(toAccountId);
  const merged = new Map(destinationDevices.map((device) => [device.deviceId, device]));

  for (const device of sourceDevices) {
    const existing = merged.get(device.deviceId);
    merged.set(device.deviceId, { ...existing, ...device });
  }

  await AsyncStorage.setItem(devicesKey(toAccountId), JSON.stringify([...merged.values()]));

  const sourceActive = await AsyncStorage.getItem(activeKey(fromAccountId));
  if (sourceActive) {
    await AsyncStorage.setItem(activeKey(toAccountId), sourceActive);
  }

  await AsyncStorage.removeItem(devicesKey(fromAccountId));
  await AsyncStorage.removeItem(activeKey(fromAccountId));
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
  const attempt = async (): Promise<Response> => {
    const device = await getActiveDevice(accountId);
    if (!device) throw new Error("No active Pi device");
    return fetch(`${device.url}${path}`, {
      method: "POST",
      headers: authHeaders(device.token),
      body: formData,
    });
  };

  let res = await attempt();
  if (res.status === 401 && (await recoverActiveDeviceToken(accountId))) {
    res = await attempt();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piPut<T>(path: string, body?: unknown, accountId?: string): Promise<T> {
  const attempt = async (): Promise<Response> => {
    const device = await getActiveDevice(accountId);
    if (!device) throw new Error("No active Pi device");
    return fetch(`${device.url}${path}`, {
      method: "PUT",
      headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await attempt();
  if (res.status === 401 && (await recoverActiveDeviceToken(accountId))) {
    res = await attempt();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi PUT ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

export async function piDelete<T>(path: string, accountId?: string): Promise<T | null> {
  const attempt = async (): Promise<Response> => {
    const device = await getActiveDevice(accountId);
    if (!device) throw new Error("No active Pi device");
    return fetch(`${device.url}${path}`, {
      method: "DELETE",
      headers: authHeaders(device.token),
    });
  };

  let res = await attempt();
  if (res.status === 401 && (await recoverActiveDeviceToken(accountId))) {
    res = await attempt();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi DELETE ${path} failed (${res.status}): ${err}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

export async function buildPiUrl(path: string, accountId?: string): Promise<string> {
  let device = await getActiveDevice(accountId);
  if (!device) throw new Error("No active Pi device");
  if (!device.token && (await recoverActiveDeviceToken(accountId))) {
    device = (await getActiveDevice(accountId)) ?? device;
  }
  const sep = path.includes("?") ? "&" : "?";
  return device.token ? `${device.url}${path}${sep}token=${device.token}` : `${device.url}${path}`;
}

export async function hasDevices(accountId?: string): Promise<boolean> {
  const devices = await getDevices(accountId);
  return devices.length > 0;
}
