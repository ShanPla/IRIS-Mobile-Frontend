import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types/iris";
import {
  deriveGoogleSyncPassword,
  makeGoogleUsernameBase,
  parseGoogleIdentityFromIdToken,
  verifyGoogleIdentityToken,
} from "./google";
import { hasDevices, loginDeviceAccount, loginDeviceWithGoogle, registerDeviceAccount } from "./pi";

const ACCOUNTS_KEY = "securewatch_accounts_v1";
const SESSION_KEY = "securewatch_account_session_v1";

type StoredAccountProvider = "local" | "google";

interface StoredAccount {
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
  provider?: StoredAccountProvider;
  googleSubject?: string;
}

export interface StoredAccountRecovery {
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
  provider?: StoredAccountProvider;
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

function findGoogleAccount(accounts: StoredAccount[], googleSubject: string, email: string): StoredAccount | null {
  const normalizedSubject = googleSubject.trim();
  const normalizedEmail = normalizeEmail(email);

  return (
    accounts.find(
      (account) =>
        account.googleSubject === normalizedSubject ||
        (account.provider === "google" && normalizeEmail(account.email) === normalizedEmail),
    ) ?? null
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

function makeSession(account: StoredAccount, token: string): AuthSession {
  return {
    token,
    username: account.username,
    email: account.email,
    role: account.role,
  };
}

async function upsertAccount(nextAccount: StoredAccount): Promise<StoredAccount> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(nextAccount.username);
  const index = accounts.findIndex(
    (account) =>
      (nextAccount.googleSubject && account.googleSubject === nextAccount.googleSubject) ||
      normalizeUsername(account.username) === normalizedUsername,
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

async function buildUniqueGoogleUsername(email: string, googleSubject: string): Promise<string> {
  const accounts = await getAccounts();
  const base = makeGoogleUsernameBase(email, googleSubject);
  let candidate = base;
  let suffix = 2;

  while (accounts.some((account) => normalizeUsername(account.username) === normalizeUsername(candidate))) {
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, Math.max(3, 64 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

async function hasAnyConfiguredDevice(accountId?: string): Promise<boolean> {
  const scoped = await hasDevices(accountId);
  if (scoped) return true;
  return hasDevices();
}

export async function registerAccount(username: string, email: string, password: string): Promise<AuthSession> {
  validateAccountInput(username, email, password);

  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const duplicate = accounts.find(
    (account) =>
      normalizeUsername(account.username) === normalizedUsername ||
      normalizeEmail(account.email) === normalizedEmail,
  );

  if (duplicate) {
    throw new Error("That username or email is already registered");
  }

  const trimmedUsername = username.trim();
  const deviceConfigured = await hasAnyConfiguredDevice(trimmedUsername);

  if (!deviceConfigured) {
    const account = await upsertAccount({
      username: trimmedUsername,
      email: normalizedEmail,
      password,
      role: "homeowner_primary",
      createdAt: new Date().toISOString(),
      provider: "local",
    });

    return makeSession(account, "");
  }

  await registerDeviceAccount(trimmedUsername, password, trimmedUsername);
  const login = await loginDeviceAccount(trimmedUsername, password, trimmedUsername);

  const account = await upsertAccount({
    username: login.user.username,
    email: normalizedEmail,
    password,
    role: login.user.role,
    createdAt: new Date().toISOString(),
    provider: "local",
  });

  return makeSession(account, login.accessToken);
}

export async function authenticateAccount(
  username: string,
  password: string,
): Promise<AuthSession> {
  const cachedAccount = await getAccountByUsername(username);
  const trimmedUsername = username.trim();
  const deviceConfigured = await hasAnyConfiguredDevice(trimmedUsername);

  if (!deviceConfigured) {
    if (!cachedAccount || cachedAccount.password !== password) {
      throw new Error("Invalid username or password");
    }
    return makeSession(cachedAccount, "");
  }

  const login = await loginDeviceAccount(trimmedUsername, password, trimmedUsername);

  const account = await upsertAccount({
    username: login.user.username,
    email: cachedAccount?.email ?? "",
    password,
    role: login.user.role,
    createdAt: cachedAccount?.createdAt ?? new Date().toISOString(),
    provider: cachedAccount?.provider ?? "local",
    googleSubject: cachedAccount?.googleSubject,
  });

  return makeSession(account, login.accessToken);
}

export async function authenticateGoogleAccount(idToken: string, preferredAccountId?: string): Promise<AuthSession> {
  const deviceConfigured = await hasAnyConfiguredDevice(preferredAccountId);

  if (!deviceConfigured) {
    const identity = await verifyGoogleIdentityToken(idToken);
    const accounts = await getAccounts();
    const existing = findGoogleAccount(accounts, identity.sub, identity.email);
    const password = await deriveGoogleSyncPassword(identity.sub);
    const username = existing?.username ?? (await buildUniqueGoogleUsername(identity.email, identity.sub));

    const account = await upsertAccount({
      username,
      email: identity.email,
      password,
      role: existing?.role ?? "homeowner_primary",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      provider: "google",
      googleSubject: identity.sub,
    });

    return makeSession(account, "");
  }

  const identity = parseGoogleIdentityFromIdToken(idToken);
  const password = await deriveGoogleSyncPassword(identity.sub);
  const login = await loginDeviceWithGoogle(idToken, preferredAccountId);
  const existingAccount = findGoogleAccount(await getAccounts(), identity.sub, login.email);

  const account = await upsertAccount({
    username: login.username,
    email: login.email,
    password,
    role: login.role,
    createdAt: existingAccount?.createdAt ?? new Date().toISOString(),
    provider: "google",
    googleSubject: identity.sub,
  });

  return makeSession(account, login.accessToken);
}

export async function syncStoredAccountToDevice(username: string): Promise<AuthSession | null> {
  const account = await getAccountByUsername(username);
  if (!account) return null;

  const deviceConfigured = await hasAnyConfiguredDevice(account.username);
  if (!deviceConfigured) {
    return makeSession(account, "");
  }

  if (account.provider === "google") {
    return makeSession(account, "");
  }

  try {
    await registerDeviceAccount(account.username, account.password, account.username);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const looksLikeExistingUser =
      message.includes("already") ||
      message.includes("taken") ||
      message.includes("exists") ||
      message.includes("409");

    if (!looksLikeExistingUser) {
      throw error;
    }
  }

  const login = await loginDeviceAccount(account.username, account.password, account.username);
  const syncedAccount = await upsertAccount({
    ...account,
    username: login.user.username,
    role: login.user.role,
    provider: account.provider ?? "local",
    googleSubject: account.googleSubject,
  });

  return makeSession(syncedAccount, login.accessToken);
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
      provider: account.provider ?? "local",
    }));
}

export async function updateStoredAccountPassword(
  username: string,
  password: string,
): Promise<StoredAccountRecovery> {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const account = await getAccountByUsername(username);
  if (!account) {
    throw new Error("Saved account not found on this phone");
  }

  if (account.provider === "google") {
    throw new Error("Google accounts must use Google sign-in");
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
    provider: updated.provider ?? "local",
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
