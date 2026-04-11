import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { useAuth } from "../../context/AuthContext";
import { getDevices, piPostToDevice, removeDevice } from "../../lib/pi";
import type { PiDevice } from "../../lib/pi";

type Nav = NativeStackNavigationProp<RootStackParamList, "DeviceList">;
type DeviceAccess = "primary" | "secondary";
type SecureAction = "remove" | "factoryReset";

function resolveAccessRole(device: PiDevice, index: number): DeviceAccess {
  if (device.accessRole === "secondary") return "secondary";
  if (device.accessRole === "primary") return "primary";
  return index === 0 ? "primary" : "secondary";
}

export default function DeviceListScreen() {
  const navigation = useNavigation<Nav>();
  const { session, activeDevice, selectDevice } = useAuth();
  const [devices, setDevices] = useState<PiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ device: PiDevice; action: SecureAction; access: DeviceAccess } | null>(null);
  const [gmailCode, setGmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [secureActionLoading, setSecureActionLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    const storedDevices = await getDevices();
    setDevices(storedDevices);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadDevices();
    }, [loadDevices])
  );

  const openDevice = async (device: PiDevice) => {
    await selectDevice(device.deviceId);
    navigation.navigate("Main");
  };

  const startSecureAction = (device: PiDevice, action: SecureAction, access: DeviceAccess) => {
    if (access !== "primary") {
      Alert.alert("Primary Only", "Only the Primary User can do this.");
      return;
    }
    setPendingAction({ device, action, access });
    setGmailCode("");
    setCodeSent(false);
  };

  const sendGmailCode = async () => {
    if (!pendingAction) return;
    const gmail = pendingAction.device.primaryEmail || session?.email;
    if (!gmail) {
      Alert.alert("Missing Gmail", "This primary device has no Gmail attached.");
      return;
    }
    setSecureActionLoading(true);
    try {
      await piPostToDevice(pendingAction.device, "/api/admin/action-verification", {
        gmail,
        action: pendingAction.action === "remove" ? "remove_device" : "factory_reset",
      });
      setCodeSent(true);
      Alert.alert("Verification Sent", `A verification code was sent to ${gmail}.`);
    } catch (e) {
      Alert.alert(
        "Verification Not Sent",
        e instanceof Error ? e.message : "The device could not send the Gmail code.",
      );
    } finally {
      setSecureActionLoading(false);
    }
  };

  const cancelSecureAction = () => {
    setPendingAction(null);
    setGmailCode("");
    setCodeSent(false);
    setSecureActionLoading(false);
  };

  const confirmSecureAction = async () => {
    if (!pendingAction) return;
    if (pendingAction.access !== "primary") {
      Alert.alert("Primary Only", "Only the Primary User can do this.");
      return;
    }
    if (!codeSent) {
      Alert.alert("Verification Required", "Send the Gmail code before confirming.");
      return;
    }
    if (gmailCode.trim().length !== 6) {
      Alert.alert("Verification Required", "Enter the 6-digit code sent to the Primary User Gmail.");
      return;
    }
    const gmail = pendingAction.device.primaryEmail || session?.email;
    if (!gmail) {
      Alert.alert("Missing Gmail", "This primary device has no Gmail attached.");
      return;
    }

    setSecureActionLoading(true);

    try {
      if (pendingAction.action === "remove") {
        await piPostToDevice(pendingAction.device, "/api/admin/action-verification/verify", {
          gmail,
          action: "remove_device",
          code: gmailCode.trim(),
        });
        await removeDevice(pendingAction.device.deviceId);
        await loadDevices();
        Alert.alert("Device Removed", `${pendingAction.device.name} was removed from this account.`);
        return;
      }

      await selectDevice(pendingAction.device.deviceId);
      await piPostToDevice(pendingAction.device, "/api/admin/factory-reset/verified", {
        gmail,
        action: "factory_reset",
        code: gmailCode.trim(),
      });
      Alert.alert("Factory Reset Started", `${pendingAction.device.name} accepted the reset request.`);
    } catch (e) {
      Alert.alert(
        "Action Not Completed",
        e instanceof Error ? e.message : "The verification code could not be confirmed.",
      );
    } finally {
      cancelSecureAction();
    }
  };

  const primaryDevices = devices.filter((device, index) => resolveAccessRole(device, index) === "primary");
  const secondaryDevices = devices.filter((device, index) => resolveAccessRole(device, index) === "secondary");
  const initials = (session?.username ?? "SW").slice(0, 2).toUpperCase();

  const renderDeviceCard = (device: PiDevice, access: DeviceAccess) => {
    const isActive = activeDevice?.deviceId === device.deviceId;
    const badgeStyle = access === "primary" ? styles.primaryBadge : styles.secondaryBadge;
    const badgeTextStyle = access === "primary" ? styles.primaryBadgeText : styles.secondaryBadgeText;

    return (
      <View key={device.deviceId} style={styles.deviceCard}>
        <TouchableOpacity onPress={() => void openDevice(device)} activeOpacity={0.82}>
          <View style={styles.deviceCardTop}>
            <View style={styles.deviceIcon}>
              <Text style={styles.deviceIconText}>CM</Text>
            </View>
            <View style={styles.deviceCopy}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceMeta}>{device.location ?? device.url}</Text>
            </View>
            <Text style={styles.chevron}>{">"}</Text>
          </View>

          <View style={styles.deviceFooter}>
            <View style={[styles.roleBadge, badgeStyle]}>
              <Text style={[styles.roleBadgeText, badgeTextStyle]}>
                {access === "primary" ? "Primary User" : "Secondary Access"}
              </Text>
            </View>
            <Text style={[styles.statusText, isActive && styles.statusTextActive]}>
              {isActive ? "Active" : "Ready"}
            </Text>
          </View>
        </TouchableOpacity>

        {access === "primary" ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.removeButton} onPress={() => startSecureAction(device, "remove", access)}>
              <Text style={styles.removeText}>Remove Device</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetButton} onPress={() => startSecureAction(device, "factoryReset", access)}>
              <Text style={styles.resetText}>Factory Reset</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.secondaryHint}>Primary user approval required for removal or reset.</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadDevices();
          }}
          tintColor="#2563eb"
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SecureWatch</Text>
          <Text style={styles.subtitle}>Choose a device to monitor</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.profileButtonText}>{initials}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("Setup")}>
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Primary Devices</Text>
        <Text style={styles.sectionSubtitle}>Full control and sharing permissions</Text>
        {primaryDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No primary devices yet</Text>
            <Text style={styles.emptyText}>Add a device to become its Primary User.</Text>
          </View>
        ) : (
          primaryDevices.map((device) => renderDeviceCard(device, "primary"))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Secondary Devices</Text>
        <Text style={styles.sectionSubtitle}>Shared access from another Primary User</Text>
        {secondaryDevices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No secondary devices</Text>
            <Text style={styles.emptyText}>Shared devices will appear here after you accept an invite.</Text>
          </View>
        ) : (
          secondaryDevices.map((device) => renderDeviceCard(device, "secondary"))
        )}
      </View>

      {pendingAction ? (
        <View style={styles.verificationCard}>
          <Text style={styles.verificationTitle}>
            {pendingAction.action === "remove" ? "Remove Device" : "Factory Reset"}
          </Text>
          <Text style={styles.verificationText}>
            Only the Primary User can continue. Send a 6-digit code to {pendingAction.device.primaryEmail || session?.email || "the primary Gmail"}.
          </Text>
          <TouchableOpacity
            style={[styles.sendCodeButton, secureActionLoading && styles.actionDisabled]}
            onPress={() => void sendGmailCode()}
            disabled={secureActionLoading}
          >
            <Text style={styles.sendCodeText}>
              {secureActionLoading ? "Working..." : codeSent ? "Resend Gmail Code" : "Send Gmail Code"}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={styles.codeInput}
            placeholder="6-digit code"
            placeholderTextColor="#94a3b8"
            value={gmailCode}
            onChangeText={setGmailCode}
            keyboardType="number-pad"
            maxLength={6}
            editable={!secureActionLoading}
          />
          <View style={styles.verificationActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelSecureAction} disabled={secureActionLoading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmDangerButton, secureActionLoading && styles.actionDisabled]}
              onPress={() => void confirmSecureAction()}
              disabled={secureActionLoading}
            >
              <Text style={styles.confirmDangerText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { color: "#0f172a", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 14, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  profileButtonText: { color: "#2563eb", fontSize: 15, fontWeight: "900" },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  addText: { color: "#ffffff", fontSize: 28, fontWeight: "600", marginTop: -2 },
  section: { marginHorizontal: 20, marginBottom: 22 },
  sectionTitle: { color: "#0f172a", fontSize: 20, fontWeight: "800" },
  sectionSubtitle: { color: "#64748b", fontSize: 13, marginTop: 3, marginBottom: 12 },
  deviceCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "rgba(255,255,255,0.94)",
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  deviceCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  deviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceIconText: { color: "#2563eb", fontSize: 13, fontWeight: "900" },
  deviceCopy: { flex: 1 },
  deviceName: { color: "#0f172a", fontSize: 17, fontWeight: "800" },
  deviceMeta: { color: "#64748b", fontSize: 12, marginTop: 4 },
  chevron: { color: "#94a3b8", fontSize: 20, fontWeight: "800" },
  deviceFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roleBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "800" },
  primaryBadge: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe" },
  primaryBadgeText: { color: "#2563eb" },
  secondaryBadge: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
  secondaryBadgeText: { color: "#16a34a" },
  statusText: { color: "#64748b", fontSize: 12, fontWeight: "800" },
  statusTextActive: { color: "#16a34a" },
  ownerActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  removeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    backgroundColor: "#fff1f2",
  },
  removeText: { color: "#dc2626", fontSize: 12, fontWeight: "800" },
  resetButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fdba74",
    alignItems: "center",
    backgroundColor: "#ffedd5",
  },
  resetText: { color: "#ea580c", fontSize: 12, fontWeight: "800" },
  secondaryHint: { color: "#64748b", fontSize: 12, marginTop: 12 },
  verificationCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    padding: 18,
  },
  verificationTitle: { color: "#b91c1c", fontSize: 18, fontWeight: "900" },
  verificationText: { color: "#475569", fontSize: 13, lineHeight: 19, marginTop: 8 },
  sendCodeButton: {
    marginTop: 16,
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  sendCodeText: { color: "#dc2626", fontSize: 13, fontWeight: "800" },
  actionDisabled: { opacity: 0.6 },
  codeInput: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
    color: "#0f172a",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    textAlign: "center",
    fontWeight: "800",
  },
  verificationActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cancelText: { color: "#64748b", fontWeight: "800" },
  confirmDangerButton: {
    flex: 1,
    borderRadius: 8,
    padding: 13,
    alignItems: "center",
    backgroundColor: "#dc2626",
  },
  confirmDangerText: { color: "#ffffff", fontWeight: "800" },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 18,
  },
  emptyTitle: { color: "#0f172a", fontSize: 15, fontWeight: "800" },
  emptyText: { color: "#64748b", fontSize: 13, marginTop: 4, lineHeight: 18 },
});
