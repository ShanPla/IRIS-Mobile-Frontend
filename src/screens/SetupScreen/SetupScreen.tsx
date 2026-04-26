import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { ArrowLeft, Mail, Plus, QrCode, Router, X } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { DEVICE_OFFLINE_MESSAGE, DEVICE_TUNNEL_MESSAGE, pairCentralDevice, resolveCentralDevice, type CentralDevice } from "../../lib/backend";
import { loginDeviceAccount, registerDeviceAccount, removeDevice, upsertRegistryDevice } from "../../lib/pi";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { getResponsiveMediaHeight, useScreenLayout } from "../../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList, "Setup">;

type SetupFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: "device" | "mail";
  keyboardType?: "default" | "email-address";
  editable?: boolean;
  onSubmitEditing?: () => void;
};

function SetupField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = "default",
  editable = true,
  onSubmitEditing,
}: SetupFieldProps) {
  const Icon = icon === "mail" ? Mail : Router;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, !editable && styles.inputShellLocked]}>
        <Icon size={18} color="#94a3b8" strokeWidth={2.2} />
        <TextInput
          style={[styles.input, !editable && styles.inputLocked]}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          returnKeyType={onSubmitEditing ? "done" : "next"}
          onSubmitEditing={onSubmitEditing}
        />
      </View>
    </View>
  );
}

function normalizeDeviceCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeDeviceUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function hostFromDeviceUrl(value: string): string | null {
  const normalizedUrl = normalizeDeviceUrl(value);
  if (!normalizedUrl) return null;
  try {
    return new URL(normalizedUrl).hostname || null;
  } catch {
    return null;
  }
}

function parseScannedDevice(value: string): { deviceCode: string; deviceUrl: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const decoded = JSON.parse(trimmed) as { device_id?: unknown; url?: unknown; device_url?: unknown };
    const deviceCode = normalizeDeviceCode(String(decoded.device_id ?? ""));
    const deviceUrl = normalizeDeviceUrl(String(decoded.url ?? decoded.device_url ?? ""));
    if (deviceCode && deviceUrl) return { deviceCode, deviceUrl };
  } catch {
    // Fall through to plain code/url handling.
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const deviceCode = normalizeDeviceCode(parsed.searchParams.get("device_id") ?? parsed.searchParams.get("device") ?? "");
      const deviceUrl = normalizeDeviceUrl(trimmed);
      return deviceCode && deviceUrl ? { deviceCode, deviceUrl } : null;
    } catch {
      return null;
    }
  }

  const normalized = trimmed.toUpperCase();
  return /^[A-Z0-9._-]{3,64}$/.test(normalized) ? { deviceCode: normalized, deviceUrl: "" } : null;
}

function normalizeGmail(value: string): string {
  return value.trim().toLowerCase();
}

function isGmail(value: string): boolean {
  return /^[^\s@]+@gmail\.com$/i.test(normalizeGmail(value));
}

async function resolveDirectDevice(deviceCode: string, deviceUrl: string): Promise<CentralDevice> {
  const normalizedUrl = normalizeDeviceUrl(deviceUrl);
  if (!normalizedUrl) throw new Error("Device URL is invalid.");

  const response = await fetch(`${normalizedUrl}/api/device/info`);
  if (!response.ok) throw new Error(DEVICE_OFFLINE_MESSAGE);

  const info = (await response.json()) as { device_id?: string; device_name?: string; name?: string };
  const resolvedCode = normalizeDeviceCode(info.device_id ?? "");
  if (!resolvedCode) throw new Error(DEVICE_OFFLINE_MESSAGE);
  if (resolvedCode !== deviceCode) throw new Error("The reached camera does not match that device code.");

  return {
    device_id: resolvedCode,
    device_name: info.device_name || info.name || resolvedCode,
    device_url: normalizedUrl,
    device_ip: hostFromDeviceUrl(normalizedUrl),
    primary_gmail: null,
    status: "online",
    last_heartbeat: new Date().toISOString(),
    access_role: "primary",
  };
}

function formatAddDeviceError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return "Failed to add device";

  const normalized = message.toLowerCase();
  if (
    normalized.includes("not online") ||
    normalized.includes("not found") ||
    normalized.includes("no reachable device route") ||
    normalized.includes("without device info") ||
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("couldn't reach")
  ) {
    return DEVICE_OFFLINE_MESSAGE;
  }
  if (normalized.includes("tunnel")) {
    return DEVICE_TUNNEL_MESSAGE;
  }
  return message;
}

export default function SetupScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshSession, session, sessionPassword } = useAuth();
  const layout = useScreenLayout({ bottom: "stack", centered: true });
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [deviceCode, setDeviceCode] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState(session?.email ?? "");
  const [directDeviceUrl, setDirectDeviceUrl] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (session?.email) {
      setPrimaryEmail(session.email);
    }
  }, [session?.email]);

  const openScanner = async () => {
    Keyboard.dismiss();
    setError("");

    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) {
      setError("Camera permission is needed to scan a device QR code.");
      return;
    }

    setScanLocked(false);
    setScannerVisible(true);
  };

  const handleQrScanned = (result: BarcodeScanningResult) => {
    if (scanLocked) return;

    const scannedDevice = parseScannedDevice(result.data);
    if (!scannedDevice) {
      setError("QR code must contain a device code or IRIS device link.");
      return;
    }

    setScanLocked(true);
    setDeviceCode(scannedDevice.deviceCode);
    setDirectDeviceUrl(scannedDevice.deviceUrl);
    setScannerVisible(false);
    setError("");
  };

  const handleAddDevice = async () => {
    if (!session?.username || !session.token) {
      setError("Sign in before adding a device.");
      return;
    }
    if (!sessionPassword) {
      setError("Sign in again before adding a device.");
      return;
    }
    if (!normalizeDeviceCode(deviceCode)) {
      setError("Device code is required");
      return;
    }
    const accountGmail = normalizeGmail(primaryEmail);
    if (!isGmail(accountGmail)) {
      setError("Primary Gmail is required for this device.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const normalizedDeviceCode = normalizeDeviceCode(deviceCode);
      const resolvedDevice = directDeviceUrl
        ? await resolveDirectDevice(normalizedDeviceCode, directDeviceUrl)
        : await resolveCentralDevice(normalizedDeviceCode, session.token);
      const deviceWithGmail = { ...resolvedDevice, primary_gmail: accountGmail };
      const newDevice = await upsertRegistryDevice(deviceWithGmail, accountGmail, session.username, { verify: true });

      let userAlreadyOnPi = false;
      try {
        try {
          await registerDeviceAccount(session.username, sessionPassword, accountGmail, session.username);
        } catch (err) {
          const msg = err instanceof Error ? err.message.toLowerCase() : "";
          const looksLikeExistingUser =
            msg.includes("already") || msg.includes("taken") || msg.includes("exists") || msg.includes("409");
          if (!looksLikeExistingUser) throw err;
          userAlreadyOnPi = true;
        }
        await loginDeviceAccount(session.username, sessionPassword, session.username);
        await pairCentralDevice(resolvedDevice.device_id, session.token, deviceWithGmail);
      } catch (err) {
        await removeDevice(newDevice.deviceId, session.username);
        const reason = err instanceof Error ? err.message : "Unknown error";
        if (userAlreadyOnPi && /incorrect|401|unauthor/i.test(reason)) {
          throw new Error(
            `A user named "${session.username}" already exists on this Pi with a different password. ` +
              `Pick a different username, or ask the Pi owner to reset that user's password.`,
          );
        }
        throw new Error(`Device added but sign-in failed: ${reason}`);
      }

      try {
        await refreshSession();
      } catch (refreshError) {
        console.warn("[IRIS Mobile] Device added, but session refresh failed:", refreshError);
      }
      navigation.navigate("DeviceList");
    } catch (e) {
      setError(formatAddDeviceError(e));
    } finally {
      setLoading(false);
    }
  };
  const scannerHeight = getResponsiveMediaHeight(layout.width, { min: 190, max: 240, ratio: 0.54 });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ReferenceBackdrop />
          <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, layout.contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("DeviceList")}>
              <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
              <Text style={styles.backButtonText}>Back to Devices</Text>
            </TouchableOpacity>

            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Plus size={32} color={referenceColors.primary} strokeWidth={2.6} />
              </View>
              <Text style={styles.brandTitle}>Add Device</Text>
              <Text style={styles.brandSubtitle}>Register a camera to this account</Text>
            </View>

            <View style={styles.card}>
              <SetupField
                label="Device Code"
                value={deviceCode}
                onChangeText={(value) => {
                  setDeviceCode(normalizeDeviceCode(value));
                  setDirectDeviceUrl("");
                }}
                placeholder="IRIS-A123"
                icon="device"
              />

              <TouchableOpacity
                style={[styles.scanButton, scannerVisible && styles.scanButtonActive]}
                onPress={() => void openScanner()}
                activeOpacity={0.86}
              >
                <QrCode size={18} color={referenceColors.primary} strokeWidth={2.4} />
                <Text style={styles.scanButtonText}>{scannerVisible ? "Scanning" : "Scan QR Code"}</Text>
              </TouchableOpacity>

              {scannerVisible ? (
                <View style={[styles.scannerCard, { height: scannerHeight }]}>
                  <CameraView
                    style={styles.scannerCamera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={!scanLocked ? handleQrScanned : undefined}
                  />
                  <View pointerEvents="none" style={styles.scannerFrame} />
                  <TouchableOpacity
                    style={styles.closeScannerButton}
                    onPress={() => {
                      setScannerVisible(false);
                      setScanLocked(false);
                    }}
                    activeOpacity={0.86}
                  >
                    <X size={18} color="#ffffff" strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <SetupField
                label="Primary Gmail"
                value={primaryEmail}
                onChangeText={(value) => setPrimaryEmail(normalizeGmail(value))}
                placeholder="owner@gmail.com"
                icon="mail"
                keyboardType="email-address"
                editable={!session?.email}
                onSubmitEditing={() => void handleAddDevice()}
              />

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{directDeviceUrl ? "Found through Pi QR" : "Found through IRIS registry"}</Text>
                <Text style={styles.infoText}>
                  {directDeviceUrl
                    ? "This phone will verify the camera directly before pairing it to your account."
                    : "The Pi reports its current tunnel and local IP to Neon under this device code."}
                </Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButtonWrap, loading && styles.buttonDisabled]}
                onPress={() => void handleAddDevice()}
                disabled={loading}
                activeOpacity={0.9}
              >
                <View style={styles.primaryButton}>
                  {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Add Device</Text>}
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 52,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  backButtonText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "600",
  },
  brand: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...buttonShadow,
  },
  brandTitle: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 28,
    padding: 22,
    ...cardShadow,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "rgba(248,250,252,0.88)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputShellLocked: {
    backgroundColor: "rgba(226,232,240,0.58)",
  },
  input: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  inputLocked: {
    color: referenceColors.textSoft,
  },
  scanButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "rgba(219,234,254,0.42)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
  },
  scanButtonActive: {
    backgroundColor: "rgba(219,234,254,0.7)",
  },
  scanButtonText: {
    color: referenceColors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  scannerCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0f172a",
    marginBottom: 14,
  },
  scannerCamera: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerFrame: {
    position: "absolute",
    left: "18%",
    right: "18%",
    top: "22%",
    bottom: "22%",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "transparent",
  },
  closeScannerButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(15,23,42,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    borderRadius: 20,
    backgroundColor: "rgba(219,234,254,0.65)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 16,
    marginTop: 4,
  },
  infoTitle: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  infoText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    textAlign: "center",
  },
  primaryButtonWrap: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 18,
    ...buttonShadow,
  },
  primaryButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
