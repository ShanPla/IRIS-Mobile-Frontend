import { useState } from "react";
import {
  ActivityIndicator,
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
import { DEVICE_OFFLINE_MESSAGE, DEVICE_TUNNEL_MESSAGE, pairCentralDevice, resolveCentralDevice } from "../../lib/backend";
import { loginDeviceAccount, registerDeviceAccount, removeDevice, upsertRegistryDevice } from "../../lib/pi";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

type Nav = NativeStackNavigationProp<RootStackParamList, "Setup">;

type SetupFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: "device" | "mail";
  keyboardType?: "default" | "email-address";
  onSubmitEditing?: () => void;
};

function SetupField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = "default",
  onSubmitEditing,
}: SetupFieldProps) {
  const Icon = icon === "mail" ? Mail : Router;

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon size={18} color="#94a3b8" strokeWidth={2.2} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
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

function normalizeScannedDeviceCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || /[/?#]/.test(trimmed)) return "";

  const normalized = trimmed.toUpperCase();
  return /^[A-Z0-9._-]{3,64}$/.test(normalized) ? normalized : "";
}

function formatAddDeviceError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return "Failed to add device";

  const normalized = message.toLowerCase();
  if (
    normalized.includes("not online") ||
    normalized.includes("not found") ||
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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [deviceCode, setDeviceCode] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState(session?.email ?? "");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    const scannedCode = normalizeScannedDeviceCode(result.data);
    if (!scannedCode) {
      setError("QR code must contain only the device code.");
      return;
    }

    setScanLocked(true);
    setDeviceCode(scannedCode);
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

    setLoading(true);
    setError("");
    try {
      const resolvedDevice = await resolveCentralDevice(normalizeDeviceCode(deviceCode), session.token);
      const newDevice = await upsertRegistryDevice(resolvedDevice, primaryEmail.trim(), session.username, { verify: true });

      let userAlreadyOnPi = false;
      try {
        try {
          await registerDeviceAccount(session.username, sessionPassword, session.username);
        } catch (err) {
          const msg = err instanceof Error ? err.message.toLowerCase() : "";
          const looksLikeExistingUser =
            msg.includes("already") || msg.includes("taken") || msg.includes("exists") || msg.includes("409");
          if (!looksLikeExistingUser) throw err;
          userAlreadyOnPi = true;
        }
        await loginDeviceAccount(session.username, sessionPassword, session.username);
        await pairCentralDevice(resolvedDevice.device_id, session.token);
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

      await refreshSession();
      navigation.navigate("DeviceList");
    } catch (e) {
      setError(formatAddDeviceError(e));
    } finally {
      setLoading(false);
    }
  };

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
            contentContainerStyle={styles.content}
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
                onChangeText={(value) => setDeviceCode(normalizeDeviceCode(value))}
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
                <View style={styles.scannerCard}>
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
                label="Primary Gmail (optional)"
                value={primaryEmail}
                onChangeText={setPrimaryEmail}
                placeholder="owner@gmail.com"
                icon="mail"
                keyboardType="email-address"
                onSubmitEditing={() => void handleAddDevice()}
              />

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Found through Render</Text>
                <Text style={styles.infoText}>
                  The Pi reports its current tunnel and local IP to Render under this device code.
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
                  {loading ? <ActivityIndicator color={referenceColors.primary} /> : <Text style={styles.primaryButtonText}>Add Device</Text>}
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
  input: {
    flex: 1,
    color: referenceColors.text,
    fontSize: 15,
    paddingVertical: 16,
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
    height: 220,
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
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: referenceColors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
