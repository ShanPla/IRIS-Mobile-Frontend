import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_TOKEN_KEY = "iris_token";
const STORAGE_URL_KEY = "iris_backend_url";

export async function getStoredBackendUrl(): Promise<string | null> {
  return await AsyncStorage.getItem(STORAGE_URL_KEY);
}

export async function setStoredBackendUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_URL_KEY, url);
  apiClient.defaults.baseURL = url;
}

export async function getStoredToken(): Promise<string | null> {
  return await AsyncStorage.getItem(STORAGE_TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(STORAGE_TOKEN_KEY, token);
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
    delete apiClient.defaults.headers.common.Authorization;
  }
}

export async function clearStorage(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
  await AsyncStorage.removeItem(STORAGE_URL_KEY);
}

export async function buildApiUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = await getStoredBackendUrl();
  if (!base) return undefined;
  const token = await getStoredToken();
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${path}${token ? `${sep}token=${token}` : ""}`;
}

export async function probeBackend(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const normalized = url.trim().replace(/\/$/, "");
    const withProtocol = /^https?:\/\//i.test(normalized)
      ? normalized
      : `http://${normalized}`;
    const response = await fetch(`${withProtocol}/health`, { method: "GET" });
    if (!response.ok) return { ok: false, message: "Backend unreachable" };
    const data = await response.json() as { status?: string };
    if (data.status !== "ok") return { ok: false, message: "Health check failed" };
    await setStoredBackendUrl(withProtocol);
    return { ok: true, message: "Connected!" };
  } catch {
    return { ok: false, message: "Cannot connect to that address" };
  }
}

export const apiClient = axios.create({
  timeout: 15000,
});