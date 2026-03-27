import { createContext, useContext, useEffect, useState } from "react";
import { apiClient, getStoredBackendUrl, getStoredToken, setStoredToken, clearStorage } from "../lib/api";
import type { AuthSession } from "../types/iris";

interface AuthContextType {
  session: AuthSession | null;
  bootstrapping: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const TEMP_ACCOUNTS = [
  { username: "testuser", password: "test1234" },
];

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    void restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const backendUrl = await getStoredBackendUrl();
      if (!backendUrl) { setBootstrapping(false); return; }
      apiClient.defaults.baseURL = backendUrl;

      const token = await getStoredToken();
      if (!token || token === "temp_token") { setBootstrapping(false); return; }
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;

      const response = await apiClient.get<{ id: number; username: string; role: string }>("/api/auth/me");
      setSession({ token, username: response.data.username, role: response.data.role });
    } catch {
      await clearStorage();
      setSession(null);
    } finally {
      setBootstrapping(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    // Check temp accounts first
    const tempMatch = TEMP_ACCOUNTS.find(
      (a) => a.username === username.trim() && a.password === password
    );
    if (tempMatch) {
      const fakeSession: AuthSession = {
        token: "temp_token",
        username: tempMatch.username,
        role: "homeowner_primary",
      };
      setSession(fakeSession);
      return true;
    }

    // Real backend login
    try {
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);

      const response = await apiClient.post<{ access_token: string }>(
        "/api/auth/login",
        form.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const token = response.data.access_token;
      await setStoredToken(token);

      const me = await apiClient.get<{ id: number; username: string; role: string }>("/api/auth/me");
      setSession({ token, username: me.data.username, role: me.data.role });
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    await clearStorage();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, bootstrapping, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}