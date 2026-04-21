import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types/iris";
import { changeCentralPassword, loginCentralAccount, registerCentralAccount } from "./backend";
import { hasDevices, loginDeviceAccount, registerDeviceAccount, updateDeviceAccountPassword } from "./pi";

interface RuntimeAccount {
  username: string;
  email: string;
  password: string;
  role: string;
}

const LEGACY_ACCOUNTS_KEY = "securewatch_accounts_v1";
const LEGACY_SESSION_KEY = "securewatch_account_session_v1";

export async function purgeStoredAuthData(): Promise<void> {
  await AsyncStorage.multiRemove([LEGACY_ACCOUNTS_KEY, LEGACY_SESSION_KEY]);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateAccountInput(username: string, email: string, password: string) {
  if (username.trim().length < 3) {
    throw new Error("Username must be at least 3 characters");
  }
  if (!normalizeEmail(email).endsWith("@gmail.com")) {
    throw new Error("Use a Gmail address for this account");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
}

function looksLikeExistingUserError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("taken") ||
    normalized.includes("exists") ||
    normalized.includes("409")
  );
}

async function hasAnyConfiguredDevice(accountId?: string): Promise<boolean> {
  const scoped = await hasDevices(accountId);
  if (scoped) return true;
  return hasDevices();
}

async function syncAccountToDevices(account: RuntimeAccount, previousPassword?: string): Promise<void> {
  const deviceConfigured = await hasAnyConfiguredDevice(account.username);
  if (!deviceConfigured) return;

  try {
    await loginDeviceAccount(account.username, account.password, account.username);
    return;
  } catch {
    // Fall through to repair/register flows below.
  }

  if (previousPassword && previousPassword !== account.password) {
    try {
      await updateDeviceAccountPassword(account.username, previousPassword, account.password, account.username);
      await loginDeviceAccount(account.username, account.password, account.username);
      return;
    } catch {
      // Continue to register/login fallback below.
    }
  }

  try {
    await registerDeviceAccount(account.username, account.password, account.username);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!looksLikeExistingUserError(message)) {
      throw error;
    }
  }

  await loginDeviceAccount(account.username, account.password, account.username);
}

async function trySyncAccountToDevices(account: RuntimeAccount, previousPassword?: string): Promise<void> {
  try {
    await syncAccountToDevices(account, previousPassword);
  } catch (error) {
    console.warn("[IRIS Mobile] Device sync failed after central auth:", error);
  }
}

export async function registerAccount(username: string, email: string, password: string): Promise<AuthSession> {
  validateAccountInput(username, email, password);

  const trimmedUsername = username.trim();
  const normalizedEmail = normalizeEmail(email);

  await registerCentralAccount(trimmedUsername, password);
  const session = await loginCentralAccount(trimmedUsername, password, normalizedEmail);

  await trySyncAccountToDevices({
    username: session.username,
    email: normalizedEmail,
    password,
    role: session.role,
  });

  return {
    ...session,
    email: normalizedEmail,
  };
}

export async function authenticateAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const trimmedUsername = username.trim();
  const session = await loginCentralAccount(trimmedUsername, password);

  await trySyncAccountToDevices({
    username: session.username,
    email: session.email,
    password,
    role: session.role,
  });

  return session;
}

export async function changeAccountPassword(
  username: string,
  currentPassword: string,
  password: string,
): Promise<void> {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  await changeCentralPassword(username, currentPassword, password);

  try {
    await updateDeviceAccountPassword(username, currentPassword, password, username);
  } catch (error) {
    console.warn("[IRIS Mobile] Device password sync failed after central password change:", error);
  }
}
