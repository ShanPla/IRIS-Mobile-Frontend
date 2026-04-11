import { createContext, useContext, useEffect, useState } from "react";
import {
  getActiveDevice,
  getDevices,
  setActiveDevice as persistActiveDevice,
} from "../lib/pi";
import {
  authenticateAccount,
  clearStoredSession,
  getStoredSession,
  persistSession,
  registerAccount,
} from "../lib/accounts";
import type { AuthSession } from "../types/iris";
import type { PiDevice } from "../lib/pi";

interface AuthContextType {
  session: AuthSession | null;
  bootstrapping: boolean;
  hasPi: boolean;
  activeDevice: PiDevice | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
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
      const storedSession = await getStoredSession();
      setSession(storedSession);
    } catch {
      // Keep authentication independent from Pi availability.
      setSession(null);
    } finally {
      setBootstrapping(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    const nextSession = await authenticateAccount(username, password);
    if (!nextSession) return false;
    setSession(nextSession);
    await persistSession(nextSession);
    return true;
  };

  const register = async (username: string, email: string, password: string) => {
    const nextSession = await registerAccount(username, email, password);
    setSession(nextSession);
    await persistSession(nextSession);
  };

  const logout = async () => {
    setSession(null);
    await clearStoredSession();
  };

  const refreshSession = async () => {
    await restoreSession();
  };

  const selectDevice = async (deviceId: string) => {
    await persistActiveDevice(deviceId);
    const devices = await getDevices();
    const nextDevice = devices.find((device) => device.deviceId === deviceId) ?? null;
    setActiveDevice(nextDevice);
    setHasPi(devices.length > 0);
  };

  return (
    <AuthContext.Provider value={{ session, bootstrapping, hasPi, activeDevice, login, register, logout, refreshSession, selectDevice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
