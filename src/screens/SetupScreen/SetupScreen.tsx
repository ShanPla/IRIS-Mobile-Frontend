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
import { ArrowLeft, Link2, Mail, Plus, Router } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { addDevice } from "../../lib/pi";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

type Nav = NativeStackNavigationProp<RootStackParamList, "Setup">;

type SetupFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: "url" | "device" | "mail";
  keyboardType?: "default" | "numbers-and-punctuation" | "email-address";
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
  const Icon = icon === "mail" ? Mail : icon === "device" ? Router : Link2;

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

export default function SetupScreen() {
  const navigation = useNavigation<Nav>();
  const { refreshSession, session } = useAuth();
  const [url, setUrl] = useState("");
  const [deviceIp, setDeviceIp] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState(session?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddDevice = async () => {
    if (!url.trim() || !deviceIp.trim()) {
      setError("Ngrok URL and Device IP are required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const normalized = url.trim().replace(/\/$/, "");
      const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
      await addDevice(withProtocol, deviceIp.trim(), primaryEmail.trim(), session?.username);
      await refreshSession();
      navigation.navigate(session ? "DeviceList" : "Login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add device");
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
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate(session ? "DeviceList" : "Login")}>
              <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
              <Text style={styles.backButtonText}>{session ? "Back to Devices" : "Back to Sign In"}</Text>
            </TouchableOpacity>

            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Plus size={32} color={referenceColors.primary} strokeWidth={2.6} />
              </View>
              <Text style={styles.brandTitle}>Add Device</Text>
              <Text style={styles.brandSubtitle}>
                {session ? "Register a camera to this account" : "Connect your IRIS device before signing in"}
              </Text>
            </View>

            <View style={styles.card}>
              <SetupField
                label="Ngrok URL"
                value={url}
                onChangeText={setUrl}
                placeholder="https://xyz.ngrok-free.dev"
                icon="url"
              />
              <SetupField
                label="Device IP"
                value={deviceIp}
                onChangeText={setDeviceIp}
                placeholder="192.168.254.100"
                icon="device"
                keyboardType="numbers-and-punctuation"
              />
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
                <Text style={styles.infoTitle}>Saved on this phone</Text>
                <Text style={styles.infoText}>
                  This device becomes part of your mobile app and will be used for IRIS sign-in.
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
