/**
 * Legacy API module — kept for backwards compatibility.
 * New code should use ../lib/pi.ts instead.
 */
export {
  getActiveDevice as getStoredBackendUrl,
  piGet,
  piPost,
  piDelete,
  buildPiUrl as buildApiUrl,
} from "./pi";

import { getActiveDevice } from "./pi";

export async function getStoredToken(): Promise<string | null> {
  const device = await getActiveDevice();
  return device?.token ?? null;
}

export async function probeBackend(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const normalized = url.trim().replace(/\/$/, "");
    const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    const response = await fetch(`${withProtocol}/health`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    if (!response.ok) return { ok: false, message: "Backend unreachable" };
    const data = (await response.json()) as { status?: string };
    if (data.status !== "ok") return { ok: false, message: "Health check failed" };
    return { ok: true, message: "Connected!" };
  } catch {
    return { ok: false, message: "Cannot connect to that address" };
  }
}
