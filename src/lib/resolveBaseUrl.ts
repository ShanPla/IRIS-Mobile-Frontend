// LAN-direct URL resolution with tunnel fallback.
//
// Problem it solves: every request the app makes goes through the tunnel
// (~300-500ms RTT) even when the phone is on the same Wi-Fi as the Pi
// (~40ms on LAN). For camera frames polled at ~6 Hz this is the difference
// between 1-2 FPS and 10-15 FPS in practice.
//
// Strategy: per (deviceId, url, deviceIp) we probe http://<deviceIp>:8000
// once. If it answers within LAN_PROBE_TIMEOUT_MS, cache it as the preferred
// base URL. Otherwise cache the tunnel URL. On app foreground we invalidate
// the cache so a network change (Wi-Fi ↔ cellular ↔ different LAN) re-probes.

import type { PiDevice } from "./pi";

export const LAN_PORT = 8000;
export const LAN_PROBE_TIMEOUT_MS = 1000;
export const LAN_PROBE_PATH = "/api/device/info";

interface CacheEntry {
  baseUrl: string;
  isLan: boolean;
  resolvedAt: number;
}

// Module-level cache. Keyed on deviceId — the same device can have different
// LAN IPs across networks, but the key is stable.
const cache = new Map<string, CacheEntry>();

/**
 * Normalizes a base URL: trims trailing slash, lowercases scheme+host.
 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Build the LAN base URL from a device's stored IP. Returns null if the IP
 * is missing or looks invalid (empty, has a space, etc.).
 */
export function buildLanBaseUrl(deviceIp: string | undefined | null, port: number = LAN_PORT): string | null {
  if (!deviceIp) return null;
  const trimmed = deviceIp.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  // Accept IPv4, IPv4-with-port, or hostname. Reject anything that looks unsafe.
  return `http://${trimmed.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/")[0]}:${port}`;
}

/**
 * Fetch with an abortable timeout. Resolves to the Response or throws.
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes a LAN base URL for liveness. Returns true if `/api/device/info`
 * responds with 2xx within the timeout.
 */
export async function probeLan(
  lanBaseUrl: string,
  timeoutMs: number = LAN_PROBE_TIMEOUT_MS,
  fetchImpl: (u: string, t: number) => Promise<Response> = fetchWithTimeout,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${lanBaseUrl}${LAN_PROBE_PATH}`, timeoutMs);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the best base URL for a device. Uses cache if present; otherwise
 * probes LAN with a short timeout and falls back to the stored tunnel URL.
 *
 * Pure-ish: the `probe` argument is injectable so tests don't need real network.
 */
export async function resolveBaseUrl(
  device: Pick<PiDevice, "deviceId" | "url" | "deviceIp">,
  probe: (lanUrl: string) => Promise<boolean> = (u) => probeLan(u),
): Promise<string> {
  const cached = cache.get(device.deviceId);
  if (cached) return cached.baseUrl;

  const lan = buildLanBaseUrl(device.deviceIp);
  const tunnel = normalizeBaseUrl(device.url);

  if (lan && (await probe(lan))) {
    cache.set(device.deviceId, { baseUrl: lan, isLan: true, resolvedAt: Date.now() });
    return lan;
  }

  cache.set(device.deviceId, { baseUrl: tunnel, isLan: false, resolvedAt: Date.now() });
  return tunnel;
}

/**
 * Invalidate the cache. Call on AppState foreground or when the user
 * explicitly retries. An optional deviceId limits invalidation to one device.
 */
export function invalidateBaseUrlCache(deviceId?: string): void {
  if (deviceId) cache.delete(deviceId);
  else cache.clear();
}

/**
 * Introspection: tells callers whether the last resolution for a device
 * landed on LAN or tunnel. Useful for surfacing a badge in the UI.
 */
export function getCachedResolution(deviceId: string): CacheEntry | null {
  return cache.get(deviceId) ?? null;
}
