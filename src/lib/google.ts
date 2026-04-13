import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const GOOGLE_SYNC_PASSWORD_SALT = "iris-google-sync-v1";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
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

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfiguredGoogleClientIds(): string[] {
  return [
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim(),
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim(),
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim(),
  ].filter((value): value is string => Boolean(value));
}

export function getPlatformGoogleClientId(): string | null {
  const candidate =
    Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
      : Platform.OS === "ios"
        ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
        : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  return candidate?.trim() || null;
}

export function parseGoogleIdentityFromIdToken(idToken: string): GoogleIdentity {
  const parts = idToken.trim().split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Google sign-in returned an invalid ID token");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    throw new Error("Google sign-in payload could not be read");
  }

  const sub = String(payload.sub ?? "").trim();
  const email = normalizeEmail(String(payload.email ?? ""));
  if (!sub || !email) {
    throw new Error("Google sign-in is missing account details");
  }

  return {
    sub,
    email,
    emailVerified: truthy(payload.email_verified),
  };
}

export async function verifyGoogleIdentityToken(idToken: string): Promise<GoogleIdentity> {
  const allowedAudiences = getConfiguredGoogleClientIds();
  if (allowedAudiences.length === 0) {
    throw new Error("Google sign-in is missing the client ID configuration for this app");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`,
  );

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Google sign-in could not verify your account");
  }

  if (!response.ok) {
    throw new Error(String(payload.error_description ?? payload.error ?? "Google sign-in failed"));
  }

  const aud = String(payload.aud ?? "").trim();
  if (!allowedAudiences.includes(aud)) {
    throw new Error("Google sign-in was issued for a different client");
  }

  const identity = {
    sub: String(payload.sub ?? "").trim(),
    email: normalizeEmail(String(payload.email ?? "")),
    emailVerified: truthy(payload.email_verified),
  };

  if (!identity.sub || !identity.email) {
    throw new Error("Google sign-in is missing account details");
  }

  if (!identity.emailVerified) {
    throw new Error("Google account email is not verified");
  }

  return identity;
}

export async function deriveGoogleSyncPassword(googleSub: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${GOOGLE_SYNC_PASSWORD_SALT}:${googleSub}`,
  );
  return `google_${digest.slice(0, 40)}`;
}

export function makeGoogleUsernameBase(email: string, googleSub: string): string {
  const localPart = normalizeEmail(email).split("@", 1)[0] ?? "";
  const candidate = localPart.replace(/[^a-z0-9._-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
  if (candidate.length >= 3) {
    return candidate.slice(0, 32);
  }

  return `user_${googleSub.slice(-6).toLowerCase()}`;
}
