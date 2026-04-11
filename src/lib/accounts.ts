import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthSession } from "../types/iris";

const ACCOUNTS_KEY = "securewatch_accounts_v1";
const SESSION_KEY = "securewatch_account_session_v1";

interface StoredAccount {
  username: string;
  email: string;
  password: string;
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

function makeSession(account: StoredAccount): AuthSession {
  return {
    token: "local-account-session",
    username: account.username,
    email: account.email,
    role: "homeowner_primary",
  };
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

  const account: StoredAccount = {
    username: username.trim(),
    email: normalizedEmail,
    password,
    createdAt: new Date().toISOString(),
  };

  await saveAccounts([...accounts, account]);
  return makeSession(account);
}

export async function authenticateAccount(
  username: string,
  password: string,
): Promise<AuthSession | null> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(username);
  const account = accounts.find(
    (item) =>
      normalizeUsername(item.username) === normalizedUsername &&
      item.password === password,
  );

  return account ? makeSession(account) : null;
}

export async function getAccountPassword(username: string): Promise<string | null> {
  const accounts = await getAccounts();
  const normalizedUsername = normalizeUsername(username);
  const account = accounts.find((item) => normalizeUsername(item.username) === normalizedUsername);
  return account?.password ?? null;
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
