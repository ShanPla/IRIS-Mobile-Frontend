import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types/iris";
import { changeCentralPassword, loginCentralAccount, registerCentralAccount } from "./backend";
import { hasDevices, loginDeviceAccount, registerDeviceAccount, updateDeviceAccountPassword } from "./pi";

const ACCOUNTS_KEY = "securewatch_accounts_v1";
const SESSION_KEY = "securewatch_account_session_v1";

interface StoredAccount {
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
}

export interface StoredAccountRecovery {
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
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

async function getAccounts(): Promise<StoredAccount[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: StoredAccount[]) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function upsertAccount(nextAccount: StoredAccount): Promise<StoredAccount> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(nextAccount.username);
  const index = accounts.findIndex(
    (account) => normalizeUsername(account.username) === normalizedUsername,
  );

  if (index >= 0) {
    accounts[index] = {
      ...accounts[index],
      ...nextAccount,
      createdAt: accounts[index].createdAt,
    };
  } else {
    accounts.push(nextAccount);
  }

  await saveAccounts(accounts);
  return index >= 0 ? accounts[index] : nextAccount;
}

async function getAccountByUsername(username: string): Promise<StoredAccount | null> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(username);
  return accounts.find((account) => normalizeUsername(account.username) === normalizedUsername) ?? null;
}

async function hasAnyConfiguredDevice(accountId?: string): Promise<boolean> {
  const scoped = await hasDevices(accountId);
  if (scoped) return true;
  return hasDevices();
}

async function syncAccountToDevices(account: StoredAccount, previousPassword?: string): Promise<void> {
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

async function trySyncAccountToDevices(account: StoredAccount, previousPassword?: string): Promise<void> {
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

  const account = await upsertAccount({
    username: session.username,
    email: normalizedEmail,
    password,
    role: session.role,
    createdAt: new Date().toISOString(),
  });

  await trySyncAccountToDevices(account);
  return {
    ...session,
    email: account.email,
  };
}

export async function authenticateAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const cachedAccount = await getAccountByUsername(username);
  const trimmedUsername = username.trim();
  const cachedEmail = cachedAccount?.email ?? "";
  const previousPassword = cachedAccount?.password;

  const session = await loginCentralAccount(trimmedUsername, password, cachedEmail);

  const account = await upsertAccount({
    username: session.username,
    email: cachedEmail,
    password,
    role: session.role,
    createdAt: cachedAccount?.createdAt ?? new Date().toISOString(),
  });

  await trySyncAccountToDevices(account, previousPassword);
  return {
    ...session,
    email: account.email,
  };
}

export async function syncStoredAccountToDevice(username: string): Promise<AuthSession | null> {
  const account = await getAccountByUsername(username);
  if (!account) return null;

  const session = await loginCentralAccount(account.username, account.password, account.email);
  const syncedAccount = await upsertAccount({
    ...account,
    username: session.username,
    role: session.role,
  });

  await trySyncAccountToDevices(syncedAccount);
  return {
    ...session,
    email: syncedAccount.email,
  };
}

export async function getAccountPassword(username: string): Promise<string | null> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(username);
  const account = accounts.find((item) => normalizeUsername(item.username) === normalizedUsername);
  return account?.password ?? null;
}

export async function listStoredAccounts(): Promise<StoredAccountRecovery[]> {
  const accounts = await getAccounts();
  return [...accounts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((account) => ({
      username: account.username,
      email: account.email,
      password: account.password,
      role: account.role,
      createdAt: account.createdAt,
    }));
}

export async function updateStoredAccountPassword(
  username: string,
  currentPassword: string,
  password: string,
): Promise<StoredAccountRecovery> {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const account = await getAccountByUsername(username);
  if (!account) {
    throw new Error("Saved account not found on this phone");
  }

  await changeCentralPassword(account.username, currentPassword, password);

  try {
    await updateDeviceAccountPassword(account.username, currentPassword, password, account.username);
  } catch (error) {
    console.warn("[IRIS Mobile] Device password sync failed after central password change:", error);
  }

  const updated = await upsertAccount({
    ...account,
    password,
  });

  return {
    username: updated.username,
    email: updated.email,
    password: updated.password,
    role: updated.role,
    createdAt: updated.createdAt,
  };
}

export async function getStoredSession(): Promise<AuthSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function persistSession(session: AuthSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
