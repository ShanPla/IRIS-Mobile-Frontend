import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PermissionSet, UserResponse } from "../types/iris";
import { DEVICE_OFFLINE_MESSAGE, DEVICE_TUNNEL_MESSAGE, resolveCentralDevice, type CentralDevice } from "./backend";
import {
  buildLanBaseUrl,
  getBaseUrlCandidates,
  invalidateBaseUrlCache,
  normalizeBaseUrl,
  rememberBaseUrlResolution,
  resolveBaseUrl,
} from "./resolveBaseUrl";

// Resolve the best reachable base URL for a device. LAN-direct if reachable,
// tunnel otherwise. Cached per device; invalidate via `invalidateBaseUrlCache`
// on AppState foreground (see App.tsx).
async function deviceBaseUrl(device: PiDevice): Promise<string> {
  return resolveBaseUrl(device);
}

const LEGACY_DEVICES_KEY = "securewatch_devices_v1";
const LEGACY_ACTIVE_KEY = "securewatch_active_device_id_v1";
const DEVICES_KEY_PREFIX = "securewatch_devices_v2_";
const ACTIVE_KEY_PREFIX = "securewatch_active_device_id_v2_";
const runtimeDeviceTokens = new Map<string, string>();

export interface PiDevice {
  deviceId: string;
  name: string;
  url: string;
  token: string;
  addedAt: string;
  accessRole?: "primary" | "secondary";
  status?: string;
  lastHeartbeat?: string | null;
  pairedAt?: string | null;
  lastActive?: string | null;
  location?: string;
  deviceIp?: string | null;
  primaryEmail?: string;
}

export interface DeviceInfo {
  device_id: string;
  name: string;
  device_name?: string;
  version: string;
}

export interface DeviceConnectionResult {
  deviceId: string;
  online: boolean;
  baseUrl: string;
  source: "lan" | "tunnel" | "none";
  message: string;
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

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function authHeaders(token: string, extra?: HeadersInit): HeadersInit {
  return {
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

function deviceTokenKey(accountId: string | undefined, deviceId: string): string {
  return `${normalizeAccountId(accountId)}:${deviceId}`;
}

function cacheDeviceToken(deviceId: string, token: string, accountId?: string): void {
  if (!token) return;
  runtimeDeviceTokens.set(deviceTokenKey(accountId, deviceId), token);
}

function stripDeviceToken(device: PiDevice): PiDevice {
  return { ...device, token: "" };
}

function stripDeviceTokens(devices: PiDevice[]): PiDevice[] {
  return devices.map(stripDeviceToken);
}

function withRuntimeToken(device: PiDevice, accountId?: string): PiDevice {
  return {
    ...stripDeviceToken(device),
    token: runtimeDeviceTokens.get(deviceTokenKey(accountId, device.deviceId)) ?? "",
  };
}

async function saveDevices(accountId: string | undefined, devices: PiDevice[]): Promise<void> {
  await AsyncStorage.setItem(devicesKey(accountId), JSON.stringify(stripDeviceTokens(devices)));
}

function fromCentralDevice(device: CentralDevice, existing?: PiDevice): PiDevice {
  return {
    deviceId: device.device_id,
    name: device.device_name || existing?.name || device.device_id,
    url: normalizeConnectionUrl(device.device_url || existing?.url || ""),
    token: existing?.token ?? "",
    addedAt: existing?.addedAt ?? device.paired_at ?? new Date().toISOString(),
    accessRole: device.access_role ?? existing?.accessRole ?? "primary",
    status: device.status,
    lastHeartbeat: device.last_heartbeat ?? null,
    pairedAt: device.paired_at ?? existing?.pairedAt ?? null,
    lastActive: device.last_active ?? existing?.lastActive ?? null,
    location: existing?.location,
    deviceIp: device.device_ip ?? existing?.deviceIp ?? "",
    primaryEmail: (device.primary_gmail ?? existing?.primaryEmail ?? "").trim(),
  };
}

function normalizeConnectionUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    for (const device of legacyDevices) {
      cacheDeviceToken(device.deviceId, device.token, accountId);
    }
    await saveDevices(accountId, legacyDevices);
    await AsyncStorage.removeItem(LEGACY_DEVICES_KEY);
    const legacyActive = await AsyncStorage.getItem(LEGACY_ACTIVE_KEY);
    if (legacyActive) {
      await AsyncStorage.setItem(activeKey(accountId), legacyActive);
      await AsyncStorage.removeItem(LEGACY_ACTIVE_KEY);
    }
    return legacyDevices.map((device) => withRuntimeToken(device, accountId));
  } catch {
    return [];
  }
}

export function isLegacyDeviceInviteCode(inviteCode: string): boolean {
  const parts = inviteCode.trim().split(".");
  return parts.length === 3 && parts.every(Boolean);
}

export function extractTrustedUserInvite(value: string): { inviteCode: string; deviceId: string } {
  const trimmed = value.trim();
  const inviteMatch = trimmed.match(/invite code:\s*([A-Za-z0-9._-]{6,512})/i);
  const inviteCode = inviteMatch?.[1] ?? trimmed;
  const deviceMatch = trimmed.match(/device code:\s*([A-Za-z0-9._-]{3,64})/i);

  if (deviceMatch?.[1]) {
    return {
      inviteCode,
      deviceId: deviceMatch[1].trim().toUpperCase(),
    };
  }

  const decoded = parseDeviceInviteCode(inviteCode);

  return {
    inviteCode,
    deviceId: decoded.device_id.trim().toUpperCase(),
  };
}

export async function getDevices(accountId?: string): Promise<PiDevice[]> {
  const raw = await AsyncStorage.getItem(devicesKey(accountId));
  if (!raw) {
    return migrateLegacyDevices(accountId);
  }
  if (!raw) return [];
  const devices = JSON.parse(raw) as PiDevice[];
  if (devices.some((device) => device.token)) {
    for (const device of devices) {
      cacheDeviceToken(device.deviceId, device.token, accountId);
    }
    await saveDevices(accountId, devices);
  }
  return devices.map((device) => withRuntimeToken(device, accountId));
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

export async function removeDevice(deviceId: string, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  const filtered = devices.filter((d) => d.deviceId !== deviceId);
  runtimeDeviceTokens.delete(deviceTokenKey(accountId, deviceId));
  invalidateBaseUrlCache(deviceId);
  await saveDevices(accountId, filtered);

  const activeId = await AsyncStorage.getItem(activeKey(accountId));
  if (activeId === deviceId) {
    if (filtered.length > 0) {
      await setActiveDevice(filtered[0].deviceId, accountId);
    } else {
      await AsyncStorage.removeItem(activeKey(accountId));
    }
  }
}

export async function upsertRegistryDevice(
  device: CentralDevice,
  primaryEmail = "",
  accountId?: string,
  options: { verify?: boolean; setActive?: boolean } = {},
): Promise<PiDevice> {
  const nextDevice: PiDevice = {
    deviceId: device.device_id,
    name: device.device_name || device.device_id,
    url: normalizeConnectionUrl(device.device_url || ""),
    token: "",
    addedAt: new Date().toISOString(),
    accessRole: device.access_role ?? "primary",
    deviceIp: device.device_ip ?? "",
    primaryEmail: primaryEmail.trim(),
  };

  if (!nextDevice.url && !nextDevice.deviceIp) {
    throw new Error(DEVICE_TUNNEL_MESSAGE);
  }

  if (options.verify) {
    const result = await verifyDeviceConnection(nextDevice, { refresh: true });
    if (!result.online) {
      throw new Error(result.message || DEVICE_OFFLINE_MESSAGE);
    }
  }

  await upsertDevice(nextDevice, accountId);
  if (options.setActive !== false) {
    await setActiveDevice(nextDevice.deviceId, accountId);
  }
  return nextDevice;
}

export async function syncRegistryDevices(devices: CentralDevice[], accountId?: string): Promise<PiDevice[]> {
  const existingDevices = await getDevices(accountId);
  const existingById = new Map(existingDevices.map((device) => [device.deviceId, device]));
  const synced = devices.map((device) => fromCentralDevice(device, existingById.get(device.device_id)));

  for (const device of synced) {
    const previous = existingById.get(device.deviceId);
    if (!previous || previous.url !== device.url || previous.deviceIp !== device.deviceIp) {
      invalidateBaseUrlCache(device.deviceId);
    }
  }
  for (const existing of existingDevices) {
    if (!synced.some((device) => device.deviceId === existing.deviceId)) {
      invalidateBaseUrlCache(existing.deviceId);
    }
  }

  await saveDevices(accountId, synced);

  const activeId = await AsyncStorage.getItem(activeKey(accountId));
  if (synced.length === 0) {
    await AsyncStorage.removeItem(activeKey(accountId));
  } else if (!activeId || !synced.some((device) => device.deviceId === activeId)) {
    await setActiveDevice(synced[0].deviceId, accountId);
  }

  return synced.map((device) => withRuntimeToken(device, accountId));
}

async function fetchDeviceInfo(baseUrl: string, timeoutMs: number = 2200): Promise<DeviceInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/device/info`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Device route responded without device info (${response.status})`);
    }
    return (await response.json()) as DeviceInfo;
  } finally {
    clearTimeout(timer);
  }
}

function isLanBaseUrl(baseUrl: string, device: Pick<PiDevice, "deviceIp">): boolean {
  const lanBaseUrl = buildLanBaseUrl(device.deviceIp);
  if (!lanBaseUrl) return false;
  return normalizeBaseUrl(baseUrl) === normalizeBaseUrl(lanBaseUrl);
}

function formatDeviceConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return DEVICE_OFFLINE_MESSAGE;

  const normalized = message.toLowerCase();
  if (normalized.includes("different camera")) {
    return "Reached a different camera for this device code.";
  }
  if (
    normalized.includes("without device info") ||
    normalized.includes("device info failed") ||
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("aborted") ||
    normalized.includes("timed out") ||
    normalized.includes("only absolute urls are supported") ||
    normalized.includes("no reachable device route")
  ) {
    return DEVICE_OFFLINE_MESSAGE;
  }

  return message;
}

export async function verifyDeviceConnection(
  device: PiDevice,
  options: { refresh?: boolean } = {},
): Promise<DeviceConnectionResult> {
  if (!device.url && !device.deviceIp) {
    return {
      deviceId: device.deviceId,
      online: false,
      baseUrl: "",
      source: "none",
      message: "No tunnel or LAN address has been reported yet.",
    };
  }

  if (options.refresh) {
    invalidateBaseUrlCache(device.deviceId);
  }

  const candidates = getBaseUrlCandidates(device);
  if (candidates.length === 0) {
    return {
      deviceId: device.deviceId,
      online: false,
      baseUrl: "",
      source: "none",
      message: "No reachable device route is available.",
    };
  }

  let lastError: unknown = new Error(DEVICE_OFFLINE_MESSAGE);
  let lastBaseUrl = normalizeConnectionUrl(device.url);

  for (const candidate of candidates) {
    lastBaseUrl = candidate;

    try {
      const info = await fetchDeviceInfo(candidate);
      if (info.device_id !== device.deviceId) {
        lastError = new Error("Reached a different camera for this device code.");
        continue;
      }

      const lan = isLanBaseUrl(candidate, device);
      rememberBaseUrlResolution(device.deviceId, candidate, lan);
      return {
        deviceId: device.deviceId,
        online: true,
        baseUrl: candidate,
        source: lan ? "lan" : "tunnel",
        message: lan ? "Connected on LAN" : "Connected through tunnel",
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    deviceId: device.deviceId,
    online: false,
    baseUrl: lastBaseUrl,
    source: "none",
    message: formatDeviceConnectionError(lastError),
  };
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
  centralToken: string,
  accountId?: string,
): Promise<PiDevice> {
  const normalizedDeviceId = deviceId.trim().toUpperCase();
  const trimmedInviteCode = inviteCode.trim();
  const trimmedUsername = username.trim();
  let redeemBaseUrl = "";
  let legacyInviteDeviceIp: string | null | undefined;

  if (isLegacyDeviceInviteCode(trimmedInviteCode)) {
    const decoded = parseDeviceInviteCode(trimmedInviteCode);

    if (!decoded.device_url) {
      throw new Error("Invite code is missing device connection details");
    }
    if (decoded.device_id !== normalizedDeviceId) {
      throw new Error("Device code does not match this invite code");
    }
    if (decoded.invited_username.toLowerCase() !== trimmedUsername.toLowerCase()) {
      throw new Error("Invite code was created for a different username");
    }

    redeemBaseUrl = normalizeConnectionUrl(decoded.device_url);
    legacyInviteDeviceIp = decoded.device_ip ?? "";
  } else {
    const resolvedDevice = await resolveCentralDevice(normalizedDeviceId, centralToken);
    const candidate: PiDevice = {
      deviceId: resolvedDevice.device_id,
      name: resolvedDevice.device_name || normalizedDeviceId,
      url: normalizeConnectionUrl(resolvedDevice.device_url || ""),
      token: "",
      addedAt: new Date().toISOString(),
      accessRole: "secondary",
      deviceIp: resolvedDevice.device_ip ?? "",
      primaryEmail: "",
    };
    const verification = await verifyDeviceConnection(candidate, { refresh: true });
    if (!verification.online) {
      throw new Error(verification.message || DEVICE_OFFLINE_MESSAGE);
    }
    redeemBaseUrl = verification.baseUrl;
    legacyInviteDeviceIp = resolvedDevice.device_ip ?? "";
  }

  const response = await fetch(`${redeemBaseUrl}/api/auth/device-invites/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_id: normalizedDeviceId,
      invite_code: trimmedInviteCode,
      username: trimmedUsername,
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
    url: normalizeConnectionUrl(data.device_url || redeemBaseUrl),
    token: data.access_token,
    addedAt: new Date().toISOString(),
    accessRole: "secondary",
    deviceIp: data.device_ip ?? legacyInviteDeviceIp ?? "",
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
    const base = await deviceBaseUrl(device);
    return fetch(`${base}${path}`, { headers: authHeaders(device.token) });
  };

  let res = await doGet();
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
    const base = await deviceBaseUrl(device);
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await attempt();
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pi POST ${path} failed (${res.status}): ${err}`);
  }
  return (await res.json()) as T;
}

async function updateDeviceToken(deviceId: string, token: string, accountId?: string): Promise<void> {
  cacheDeviceToken(deviceId, token, accountId);
  const devices = await getDevices(accountId);
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx >= 0) {
    await saveDevices(accountId, devices);
  }
}

async function upsertDevice(device: PiDevice, accountId?: string): Promise<void> {
  cacheDeviceToken(device.deviceId, device.token, accountId);
  const devices = await getDevices(accountId);
  const index = devices.findIndex((existing) => existing.deviceId === device.deviceId);
  if (index >= 0) {
    const previous = devices[index];
    if (previous.url !== device.url || previous.deviceIp !== device.deviceIp) {
      invalidateBaseUrlCache(device.deviceId);
    }
    devices[index] = {
      ...devices[index],
      ...device,
    };
  } else {
    invalidateBaseUrlCache(device.deviceId);
    devices.push(device);
  }

  await saveDevices(accountId, devices);
}

export async function registerDeviceAccount(
  username: string,
  password: string,
  gmail: string,
  preferredAccountId?: string,
): Promise<void> {
  const candidates = await getCandidateDevices(preferredAccountId, username, undefined);
  if (candidates.length === 0) {
    throw new Error("Add a device on the Setup screen before creating an account.");
  }

  let lastError = "Unable to create the account on any configured device.";

  for (const candidate of candidates) {
    try {
      const base = await deviceBaseUrl(candidate.device);
      const res = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, gmail, password }),
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
      const base = await deviceBaseUrl(candidate.device);
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: {
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

      const meRes = await fetch(`${base}/api/auth/me`, {
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
        device: { ...candidate.device, token: data.access_token },
        accountId: candidate.accountId,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}

export async function loginAllDeviceAccounts(username: string, password: string, accountId?: string): Promise<void> {
  const devices = await getDevices(accountId);
  if (devices.length === 0) return;

  const failures: string[] = [];
  const seen = new Set<string>();

  for (const device of devices) {
    if (seen.has(device.deviceId)) continue;
    seen.add(device.deviceId);

    try {
      const base = await deviceBaseUrl(device);
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password }).toString(),
      });

      if (!loginRes.ok) {
        throw new Error(await parseErrorMessage(loginRes, `Device login failed (${loginRes.status}).`));
      }

      const data = (await loginRes.json()) as { access_token?: string };
      if (!data.access_token) {
        throw new Error("Device login did not return a token.");
      }

      const meRes = await fetch(`${base}/api/auth/me`, {
        headers: authHeaders(data.access_token),
      });
      if (!meRes.ok) {
        throw new Error(await parseErrorMessage(meRes, `Failed to verify device token (${meRes.status}).`));
      }

      await updateDeviceToken(device.deviceId, data.access_token, accountId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown device login error";
      failures.push(`${device.name}: ${reason}`);
    }
  }

  if (failures.length > 0) {
    console.warn("[IRIS Mobile] Some paired devices could not be authenticated:", failures.join(" | "));
  }
}

export async function updateDeviceAccountPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
  preferredAccountId?: string,
): Promise<void> {
  const candidates = await getCandidateDevices(preferredAccountId, username, undefined);
  if (candidates.length === 0) return;

  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      const base = await deviceBaseUrl(candidate.device);
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ username, password: currentPassword }).toString(),
      });

      if (!loginRes.ok) {
        throw new Error(await parseErrorMessage(loginRes, `Device login failed (${loginRes.status}).`));
      }

      const data = (await loginRes.json()) as { access_token: string };
      await updateDeviceToken(candidate.device.deviceId, data.access_token, candidate.accountId);

      const changeRes = await fetch(`${base}/api/auth/me/password`, {
        method: "PUT",
        headers: authHeaders(data.access_token, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!changeRes.ok) {
        throw new Error(await parseErrorMessage(changeRes, `Device password change failed (${changeRes.status}).`));
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown device password update error";
      failures.push(`${candidate.device.name}: ${reason}`);
    }
  }

  if (failures.length === candidates.length) {
    throw new Error(`Could not update password on any configured device. ${failures[0]}`);
  }

  if (failures.length > 0) {
    throw new Error(`Password updated in the account registry, but some devices still need re-sync. ${failures.join(" | ")}`);
  }
}

export async function transferDevices(fromAccountId: string | undefined, toAccountId: string | undefined): Promise<void> {
  if (normalizeAccountId(fromAccountId) === normalizeAccountId(toAccountId)) return;

  const sourceDevices = await getDevices(fromAccountId);
  if (sourceDevices.length === 0) return;

  const destinationDevices = await getDevices(toAccountId);
  const merged = new Map(destinationDevices.map((device) => [device.deviceId, device]));

  for (const device of sourceDevices) {
    const existing = merged.get(device.deviceId);
    cacheDeviceToken(device.deviceId, device.token, toAccountId);
    merged.set(device.deviceId, { ...existing, ...device });
  }

  await saveDevices(toAccountId, [...merged.values()]);

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

  const base = await deviceBaseUrl(device);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
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
  const base = await deviceBaseUrl(device);
  const res = await fetch(`${base}${path}`, {
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
    const base = await deviceBaseUrl(device);
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: authHeaders(device.token),
      body: formData,
    });
  };

  let res = await attempt();
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
    const base = await deviceBaseUrl(device);
    return fetch(`${base}${path}`, {
      method: "PUT",
      headers: authHeaders(device.token, body !== undefined ? { "Content-Type": "application/json" } : undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await attempt();
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
    const base = await deviceBaseUrl(device);
    return fetch(`${base}${path}`, {
      method: "DELETE",
      headers: authHeaders(device.token),
    });
  };

  let res = await attempt();
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
  const base = await deviceBaseUrl(device);
  const sep = path.includes("?") ? "&" : "?";
  return device.token ? `${base}${path}${sep}token=${device.token}` : `${base}${path}`;
}

export async function hasDevices(accountId?: string): Promise<boolean> {
  const devices = await getDevices(accountId);
  return devices.length > 0;
}
