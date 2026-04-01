import { createContext, useContext, useEffect, useState } from "react";
import {
  getActiveDevice,
  getDevices,
  piGet,
} from "../lib/pi";
import type { AuthSession, UserResponse } from "../types/iris";
import type { PiDevice } from "../lib/pi";

interface AuthContextType {
  session: AuthSession | null;
  bootstrapping: boolean;
  hasPi: boolean;
  activeDevice: PiDevice | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [hasPi, setHasPi] = useState(false);
  const [activeDevice, setActiveDevice] = useState<PiDevice | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const devices = await getDevices();
      setHasPi(devices.length > 0);

      const device = await getActiveDevice();
      setActiveDevice(device);
      if (!device) {
        setBootstrapping(false);
        return;
      }

      // Validate token by calling /api/auth/me
      const me = await piGet<UserResponse>("/api/auth/me");
      setSession({
        token: device.token,
        username: me.username,
        role: me.role,
      });
    } catch {
      // Token invalid or Pi unreachable — clear session but keep devices
      setSession(null);
    } finally {
      setBootstrapping(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const device = await getActiveDevice();
    if (!device) return false;

    try {
      // Use form-urlencoded login (FastAPI OAuth2)
      const res = await fetch(`${device.url}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "ngrok-skip-browser-warning": "true",
        },
        body: new URLSearchParams({ username, password }).toString(),
      });

      if (!res.ok) return false;
      const data = (await res.json()) as { access_token: string };

      // Update device token in storage
      const devices = await getDevices();
      const idx = devices.findIndex((d) => d.deviceId === device.deviceId);
      if (idx >= 0) {
        devices[idx] = { ...devices[idx], token: data.access_token };
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.setItem("iris_pi_devices", JSON.stringify(devices));
      }

      // Fetch user info
      const meRes = await fetch(`${device.url}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!meRes.ok) return false;
      const me = (await meRes.json()) as UserResponse;

      setSession({ token: data.access_token, username: me.username, role: me.role });
      setActiveDevice({ ...device, token: data.access_token });
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    setSession(null);
  };

  const refreshSession = async () => {
    await restoreSession();
  };

  return (
    <AuthContext.Provider value={{ session, bootstrapping, hasPi, activeDevice, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
