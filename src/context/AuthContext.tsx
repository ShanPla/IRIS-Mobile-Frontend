import { createContext, useContext, useEffect, useState } from "react";
import {
  getActiveDevice,
  getDevices,
  setActiveDevice as persistActiveDevice,
} from "../lib/pi";
import {
  authenticateAccount,
  changeAccountPassword,
  purgeStoredAuthData,
  registerAccount,
} from "../lib/accounts";
import { getCentralCurrentUser } from "../lib/backend";
import type { AuthSession } from "../types/iris";
import type { PiDevice } from "../lib/pi";

interface AuthContextType {
  session: AuthSession | null;
  sessionPassword: string | null;
  bootstrapping: boolean;
  hasPi: boolean;
  activeDevice: PiDevice | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  selectDevice: (deviceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionPassword, setSessionPassword] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [hasPi, setHasPi] = useState(false);
  const [activeDevice, setActiveDevice] = useState<PiDevice | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  const refreshDeviceState = async (accountId?: string) => {
    const devices = await getDevices(accountId);
    setHasPi(devices.length > 0);
    const device = await getActiveDevice(accountId);
    setActiveDevice(device);
  };

  const restoreSession = async () => {
    try {
      await purgeStoredAuthData();
      setSession(null);
      setSessionPassword(null);
      await refreshDeviceState();
    } catch {
      // Keep authentication independent from Pi availability.
      setSession(null);
      setSessionPassword(null);
    } finally {
      setBootstrapping(false);
    }
  };

  const login = async (username: string, password: string): Promise<void> => {
    const nextSession = await authenticateAccount(username, password);
    setSession(nextSession);
    setSessionPassword(password);
    await refreshDeviceState(nextSession.username);
  };

  const register = async (username: string, email: string, password: string) => {
    const nextSession = await registerAccount(username, email, password);
    setSession(nextSession);
    setSessionPassword(password);
    await refreshDeviceState(nextSession.username);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!session?.username) {
      throw new Error("Sign in again before changing your password.");
    }

    await changeAccountPassword(session.username, currentPassword, newPassword);
    setSessionPassword(newPassword);
  };

  const logout = async () => {
    setSession(null);
    setSessionPassword(null);
    setActiveDevice(null);
    setHasPi(false);
  };

  const refreshSession = async () => {
    if (session?.token) {
      const currentUser = await getCentralCurrentUser(session.token);
      setSession((current) => (
        current
          ? {
              ...current,
              username: currentUser.username,
              email: currentUser.gmail ?? current.email,
              role: currentUser.role,
              permissions: currentUser.permissions ?? null,
            }
          : current
      ));
    }
    await refreshDeviceState(session?.username);
  };

  const refreshDevices = async () => {
    await refreshDeviceState(session?.username);
  };

  const selectDevice = async (deviceId: string) => {
    const accountId = session?.username;
    await persistActiveDevice(deviceId, accountId);
    const devices = await getDevices(accountId);
    const nextDevice = devices.find((device) => device.deviceId === deviceId) ?? null;
    setActiveDevice(nextDevice);
    setHasPi(devices.length > 0);
  };

  return (
    <AuthContext.Provider value={{ session, sessionPassword, bootstrapping, hasPi, activeDevice, login, register, changePassword, logout, refreshSession, refreshDevices, selectDevice }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
