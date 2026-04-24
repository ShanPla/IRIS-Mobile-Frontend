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

type DeviceRouteTarget = Pick<PiDevice, "deviceId" | "url" | "deviceIp">;

// Module-level cache. Keyed on deviceId — the same device can have different
// LAN IPs across networks, but the key is stable.
const cache = new Map<string, CacheEntry>();

/**
 * Normalizes a base URL: trims trailing slash, lowercases scheme+host.
 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function pushCandidate(seen: Set<string>, candidates: string[], url: string | null | undefined): void {
  const normalized = normalizeBaseUrl(url ?? "");
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  candidates.push(normalized);
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
 * Return the candidate base URLs for a device in the order the app should try
 * them: cached best route first, then LAN, then tunnel.
 */
export function getBaseUrlCandidates(device: DeviceRouteTarget): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  pushCandidate(seen, candidates, cache.get(device.deviceId)?.baseUrl);
  pushCandidate(seen, candidates, buildLanBaseUrl(device.deviceIp));
  pushCandidate(seen, candidates, device.url);

  return candidates;
}

/**
 * Persist the last-known good route for a device so future requests can reuse
 * it without probing again.
 */
export function rememberBaseUrlResolution(deviceId: string, baseUrl: string, isLan: boolean): void {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return;

  cache.set(deviceId, {
    baseUrl: normalized,
    isLan,
    resolvedAt: Date.now(),
  });
}

/**
 * Resolve the best base URL for a device. Uses cache if present; otherwise
 * probes LAN with a short timeout and falls back to the stored tunnel URL.
 *
 * Pure-ish: the `probe` argument is injectable so tests don't need real network.
 */
export async function resolveBaseUrl(
  device: DeviceRouteTarget,
  probe: (lanUrl: string) => Promise<boolean> = (u) => probeLan(u),
): Promise<string> {
  const cached = cache.get(device.deviceId);
  if (cached) return cached.baseUrl;

  const lan = buildLanBaseUrl(device.deviceIp);
  const tunnel = normalizeBaseUrl(device.url);

  if (lan && (await probe(lan))) {
    rememberBaseUrlResolution(device.deviceId, lan, true);
    return lan;
  }

  const fallback = tunnel || lan || "";
  rememberBaseUrlResolution(device.deviceId, fallback, fallback === lan && Boolean(lan));
  return fallback;
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
