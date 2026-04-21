import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types/iris";
import { changeCentralPassword, loginCentralAccount, registerCentralAccount } from "./backend";
import { updateDeviceAccountPassword } from "./pi";

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

export async function registerAccount(username: string, email: string, password: string): Promise<AuthSession> {
  validateAccountInput(username, email, password);

  const trimmedUsername = username.trim();
  const normalizedEmail = normalizeEmail(email);

  await registerCentralAccount(trimmedUsername, password);
  const session = await loginCentralAccount(trimmedUsername, password, normalizedEmail);

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
  return loginCentralAccount(trimmedUsername, password);
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
