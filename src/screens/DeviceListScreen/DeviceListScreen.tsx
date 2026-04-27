import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ChevronRight,
  Crown,
  Plus,
  Shield,
  User,
  Users,
} from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { getSessionAccess } from "../../lib/access";
import { listCentralDevices, unpairCentralDevice } from "../../lib/backend";
import {
  extractTrustedUserInvite,
  getDevices,
  loginAllDeviceAccounts,
  loginDeviceAccount,
  redeemTrustedUserInvite,
  removeDevice,
  syncRegistryDevices,
  verifyDeviceConnection,
} from "../../lib/pi";
import type { PiDevice } from "../../lib/pi";
import {
  buttonShadow,
  cardShadow,
  referenceColors,
} from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList, "DeviceList">;
type DeviceAccess = "primary" | "secondary";
type DeviceConnectionState = {
  state: "checking" | "online" | "offline" | "unknown";
  source?: "lan" | "tunnel" | "none";
  message?: string;
};

function resolveAccessRole(device: PiDevice, index: number): DeviceAccess {
  if (device.accessRole === "secondary") return "secondary";
  if (device.accessRole === "primary") return "primary";
  return index === 0 ? "primary" : "secondary";
}

export default function DeviceListScreen() {
  const navigation = useNavigation<Nav>();
  const {
    session,
    sessionPassword,
    activeDevice,
    selectDevice,
    refreshSession,
  } = useAuth();
  const access = getSessionAccess(session);
  const layout = useScreenLayout({ bottom: "stack" });
  const [devices, setDevices] = useState<PiDevice[]>([]);
  const [connectionById, setConnectionById] = useState<
    Record<string, DeviceConnectionState>
  >({});
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [joinDeviceCode, setJoinDeviceCode] = useState("");
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [deviceSyncError, setDeviceSyncError] = useState("");

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

  const refreshConnections = useCallback(async (devicesToCheck: PiDevice[]) => {
    if (devicesToCheck.length === 0) {
      setConnectionById({});
      return;
    }

    setConnectionById(() => {
      const next: Record<string, DeviceConnectionState> = {};
      for (const device of devicesToCheck) {
        next[device.deviceId] =
          device.url || device.deviceIp
            ? { state: "checking", message: "Checking current route..." }
            : {
                state: "offline",
                source: "none",
                message: "Waiting for the Pi to report a tunnel or LAN IP.",
              };
      }
      return next;
    });

    const results = await Promise.all(
      devicesToCheck.map((device) =>
        verifyDeviceConnection(device, { refresh: true }),
      ),
    );

    setConnectionById(() => {
      const next: Record<string, DeviceConnectionState> = {};
      for (const result of results) {
        next[result.deviceId] = {
          state: result.online ? "online" : "offline",
          source: result.source,
          message: result.message,
        };
      }
      return next;
    });
  }, []);

  const loadDevices = useCallback(async () => {
    let nextSyncError = "";
    let nextDevices: PiDevice[] = [];
    let registryLoaded = false;
    const accountId = session?.username;

    if (session?.token && accountId) {
      try {
        const centralDevices = await listCentralDevices(session.token);
        nextDevices = await syncRegistryDevices(centralDevices, accountId);
        registryLoaded = true;
      } catch (error) {
        nextSyncError =
          error instanceof Error
            ? error.message
            : "Could not refresh devices from Neon.";
        console.warn("[IRIS Mobile] Device list Neon refresh failed:", error);
      }
    }

    if (!registryLoaded) {
      try {
        nextDevices = await getDevices(accountId);
      } catch (error) {
        nextSyncError =
          error instanceof Error
            ? error.message
            : "Could not load devices on this phone.";
        nextDevices = [];
      }
    }

    setDevices(nextDevices);
    setDeviceSyncError(nextSyncError);
    setLoading(false);
    setRefreshing(false);
    void refreshConnections(nextDevices);

    if (
      accountId &&
      sessionPassword &&
      nextDevices.some((device) => device.url || device.deviceIp)
    ) {
      void loginAllDeviceAccounts(accountId, sessionPassword, accountId)
        .then(async () => setDevices(await getDevices(accountId)))
        .catch((error) =>
          console.warn("[IRIS Mobile] Background device login failed:", error),
        );
    }
  }, [refreshConnections, session?.token, session?.username, sessionPassword]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadDevices();
    }, [loadDevices]),
  );

  const openDevice = async (device: PiDevice) => {
    if (!device.url && !device.deviceIp) {
      Alert.alert(
        "Device Not Reachable",
        "This device is paired in Neon, but the Pi has not reported a tunnel or LAN IP yet.",
      );
      return;
    }

    setConnectingDeviceId(device.deviceId);
    try {
      await selectDevice(device.deviceId);
      if (session?.username && sessionPassword) {
        await loginDeviceAccount(
          session.username,
          sessionPassword,
          session.username,
        );
        await selectDevice(device.deviceId);
      }
      navigation.navigate("Main");
    } catch (error) {
      Alert.alert(
        "Connection Failed",
        error instanceof Error
          ? error.message
          : "Could not connect to this device.",
      );
      void refreshConnections([device]);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const startRemoveDevice = (device: PiDevice) => {
    Alert.alert(
      "Remove Device",
      `Remove ${device.name} from this account? You can re-add it later on the Setup screen.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (session?.token) {
                await unpairCentralDevice(device.deviceId, session.token);
              }
              await removeDevice(device.deviceId, session?.username);
              await loadDevices();
            } catch (err) {
              Alert.alert(
                "Remove Failed",
                err instanceof Error
                  ? err.message
                  : "Could not remove the device.",
              );
            }
          },
        },
      ],
    );
  };

  const openInvitePlaceholder = () => {
    setJoiningInvite(true);
    setJoinError("");
  };

  const cancelJoinInvite = () => {
    setJoiningInvite(false);
    setJoinDeviceCode("");
    setJoinInviteCode("");
    setJoinError("");
    setJoinLoading(false);
  };

  const handleJoinInviteCodeChange = (value: string) => {
    setJoinError("");

    try {
      const extracted = extractTrustedUserInvite(value);
      setJoinInviteCode(extracted.inviteCode);
      setJoinDeviceCode(extracted.deviceId);
    } catch {
      setJoinInviteCode(value);
      // Ignore partial invite codes while the user is still typing or pasting.
    }
  };

  const joinSharedDevice = async () => {
    if (!session?.username) {
      setJoinError("Sign in again before joining a shared device.");
      return;
    }
    if (!joinDeviceCode.trim() || !joinInviteCode.trim()) {
      setJoinError("Device code and invite code are required.");
      return;
    }

    if (!sessionPassword) {
      setJoinError("Sign in again before joining a shared device.");
      return;
    }

    const normalizedJoinCode = joinDeviceCode.trim().toUpperCase();
    const alreadyPrimary = devices.find(
      (d, i) => d.deviceId.toUpperCase() === normalizedJoinCode && resolveAccessRole(d, i) === "primary",
    );
    if (alreadyPrimary) {
      setJoinError("You already own this device as a Primary User. A device cannot be both primary and secondary.");
      return;
    }
    const alreadySecondary = devices.find(
      (d, i) => d.deviceId.toUpperCase() === normalizedJoinCode && resolveAccessRole(d, i) === "secondary",
    );
    if (alreadySecondary) {
      setJoinError("You already have secondary access to this device.");
      return;
    }

    setJoinLoading(true);
    setJoinError("");
    try {
      const sharedDevice = await redeemTrustedUserInvite(
        joinDeviceCode.trim(),
        joinInviteCode.trim(),
        session.username,
        sessionPassword,
        session.token,
        session.username,
      );
      await refreshSession();
      await loadDevices();
      await selectDevice(sharedDevice.deviceId);
      Alert.alert(
        "Shared Device Added",
        `${sharedDevice.name} is now available on this phone.`,
      );
      cancelJoinInvite();
    } catch (e) {
      setJoinError(
        e instanceof Error ? e.message : "Unable to join this shared device.",
      );
      setJoinLoading(false);
    }
  };

  const primaryDevices = devices.filter(
    (device, index) => resolveAccessRole(device, index) === "primary",
  );
  const secondaryDevices = devices.filter(
    (device, index) => resolveAccessRole(device, index) === "secondary",
  );
  const initials = (session?.username ?? "SW").slice(0, 2).toUpperCase();

  const renderDeviceCard = (device: PiDevice, access: DeviceAccess) => {
    const isActive = activeDevice?.deviceId === device.deviceId;
    const isPrimary = access === "primary";
    const connection = connectionById[device.deviceId] ?? {
      state: device.status === "online" ? "unknown" : "offline",
      source: "none",
      message:
        device.status === "online"
          ? "Waiting for route check."
          : "Device is offline in Neon.",
    };
    const isConnecting = connectingDeviceId === device.deviceId;
    const routeLabel =
      connection.source === "lan"
        ? "LAN"
        : connection.source === "tunnel"
          ? "Tunnel"
          : "";
    const connectionLabel =
      connection.state === "checking"
        ? "Checking"
        : connection.state === "online"
          ? routeLabel
            ? `Online \u2022 ${routeLabel}`
            : "Online"
          : "Offline";
    const statusLabel = isConnecting
      ? "Connecting"
      : isActive
        ? `Active \u2022 ${connectionLabel}`
        : connectionLabel;
    const deviceRoute = device.deviceIp || device.url
      ? "Connection details configured"
      : "Waiting for heartbeat from Pi";

    return (
      <View key={device.deviceId} style={styles.deviceCard}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => void openDevice(device)}
          disabled={isConnecting}
        >
          <View style={styles.deviceRow}>
            <View
              style={[
                styles.deviceIconWrap,
                isPrimary
                  ? styles.deviceIconPrimary
                  : styles.deviceIconSecondary,
              ]}
            >
              <Shield
                size={20}
                color={
                  isPrimary ? referenceColors.primary : referenceColors.success
                }
                strokeWidth={2.2}
              />
            </View>
            <View style={styles.deviceCopy}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceMeta}>
                {device.location ?? deviceRoute}
              </Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" strokeWidth={2.2} />
          </View>

          <View style={styles.deviceFooter}>
            <View
              style={[
                styles.roleBadge,
                isPrimary ? styles.roleBadgePrimary : styles.roleBadgeSecondary,
              ]}
            >
              <Text
                style={[
                  styles.roleBadgeText,
                  isPrimary
                    ? styles.roleBadgePrimaryText
                    : styles.roleBadgeSecondaryText,
                ]}
              >
                {isPrimary ? "Primary User" : "Secondary Access"}
              </Text>
            </View>
            <Text
              style={[
                styles.statusText,
                connection.state === "online" && styles.statusTextOnline,
                connection.state === "offline" && styles.statusTextOffline,
                isActive && styles.statusTextActive,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </TouchableOpacity>

        {isPrimary ? (
          <View style={styles.inlineActions}>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => startRemoveDevice(device)}
            >
              <Text style={styles.secondaryActionText}>Remove Device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.secondaryHint}>
            Primary user approval is required for removal.
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ReferenceBackdrop />
        <ActivityIndicator color={referenceColors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <ReferenceBackdrop />
          <Animated.ScrollView
            style={[
              styles.container,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
            contentContainerStyle={[styles.content, layout.contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void loadDevices();
                }}
                tintColor={referenceColors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>My Devices</Text>
                <Text style={styles.subtitle}>Select a device to monitor</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => navigation.navigate("Profile")}
                >
                  <User
                    size={18}
                    color={referenceColors.textSoft}
                    strokeWidth={2.2}
                  />
                  <Text style={styles.profileButtonText}>{initials}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {deviceSyncError ? (
              <View style={styles.syncErrorCard}>
                <Text style={styles.syncErrorTitle}>Neon refresh failed</Text>
                <Text style={styles.syncErrorText}>{deviceSyncError}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrap}>
                  <View style={styles.sectionIconPrimary}>
                    <Crown
                      size={18}
                      color={referenceColors.primary}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Primary Devices</Text>
                    <Text style={styles.sectionSubtitle}>
                      Full control and sharing permissions
                    </Text>
                  </View>
                </View>
                <Text style={styles.sectionCount}>{primaryDevices.length}</Text>
              </View>

              {primaryDevices.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No primary devices yet</Text>
                  <Text style={styles.emptyText}>
                    Add a device to become its Primary User.
                  </Text>
                </View>
              ) : (
                primaryDevices.map((device) =>
                  renderDeviceCard(device, "primary"),
                )
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrap}>
                  <View style={styles.sectionIconSecondary}>
                    <Users
                      size={18}
                      color={referenceColors.success}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Secondary Devices</Text>
                    <Text style={styles.sectionSubtitle}>
                      Shared access from another Primary User
                    </Text>
                  </View>
                </View>
                <Text style={styles.sectionCount}>
                  {secondaryDevices.length}
                </Text>
              </View>

              {secondaryDevices.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No secondary devices</Text>
                  <Text style={styles.emptyText}>
                    Shared devices will appear here after you accept an invite.
                  </Text>
                </View>
              ) : (
                secondaryDevices.map((device) =>
                  renderDeviceCard(device, "secondary"),
                )
              )}
            </View>

            {access.canAddDevice ? (
              <TouchableOpacity
                style={styles.primaryCTAWrap}
                onPress={() => navigation.navigate("Setup")}
                activeOpacity={0.9}
              >
                <View style={styles.primaryCTA}>
                  <Plus
                    size={18}
                    color="#ffffff"
                    strokeWidth={2.6}
                  />
                  <Text style={styles.primaryCTAText}>Add New Device</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {access.canJoinSharedDevices ? (
              <TouchableOpacity
                style={styles.secondaryCTA}
                onPress={openInvitePlaceholder}
              >
                <Text style={styles.secondaryCTAText}>
                  Join with Invite Code
                </Text>
              </TouchableOpacity>
            ) : null}

            {joiningInvite ? (
              <View style={styles.joinCard}>
                <Text style={styles.joinTitle}>Join Shared Device</Text>
                <Text style={styles.joinText}>
                  Paste the invite code from the primary user and we will fill
                  the device code when it is included.
                </Text>

                <TextInput
                  style={styles.joinInput}
                  placeholder="Device code"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={joinDeviceCode}
                  onChangeText={(value) => {
                    setJoinDeviceCode(value.trim().toUpperCase());
                    setJoinError("");
                  }}
                  editable={!joinLoading}
                />

                <TextInput
                  style={[styles.joinInput, styles.joinInviteInput]}
                  placeholder="Invite code"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  value={joinInviteCode}
                  onChangeText={handleJoinInviteCodeChange}
                  editable={!joinLoading}
                />

                {joinError ? (
                  <Text style={styles.joinError}>{joinError}</Text>
                ) : null}

                <View style={styles.joinActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelJoinInvite}
                    disabled={joinLoading}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.joinConfirmButton,
                      joinLoading && styles.buttonDisabled,
                    ]}
                    onPress={() => void joinSharedDevice()}
                    disabled={joinLoading}
                  >
                    {joinLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.joinConfirmText}>Join Device</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </Animated.ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncErrorCard: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  syncErrorTitle: {
    color: referenceColors.danger,
    fontSize: 13,
    fontWeight: "800",
  },
  syncErrorText: {
    color: referenceColors.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  profileButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileButtonText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  sectionIconPrimary: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionIconSecondary: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
    marginTop: 3,
    flexShrink: 1,
  },
  sectionCount: {
    color: referenceColors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 24,
    padding: 18,
    ...cardShadow,
  },
  emptyTitle: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  deviceCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deviceIconPrimary: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  deviceIconSecondary: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  deviceCopy: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  deviceMeta: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 4,
    flexShrink: 1,
  },
  deviceFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleBadgePrimary: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },
  roleBadgeSecondary: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  roleBadgePrimaryText: {
    color: referenceColors.primary,
  },
  roleBadgeSecondaryText: {
    color: referenceColors.success,
  },
  statusText: {
    color: referenceColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  statusTextOnline: {
    color: referenceColors.success,
  },
  statusTextOffline: {
    color: referenceColors.danger,
  },
  statusTextActive: {
    color: referenceColors.success,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: referenceColors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  warningAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "#ffedd5",
    alignItems: "center",
    justifyContent: "center",
  },
  warningActionText: {
    color: referenceColors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryHint: {
    color: referenceColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  primaryCTAWrap: {
    borderRadius: 20,
    marginTop: 4,
    ...buttonShadow,
  },
  primaryCTA: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: referenceColors.primary,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryCTAText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryCTA: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 18,
    ...cardShadow,
  },
  secondaryCTAText: {
    color: referenceColors.textSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  joinCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    ...cardShadow,
  },
  joinTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  joinText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 14,
  },
  joinInput: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: referenceColors.text,
    paddingHorizontal: 16,
    fontSize: 14,
    marginBottom: 12,
  },
  joinInviteInput: {
    minHeight: 90,
    textAlignVertical: "top",
    paddingTop: 14,
    paddingBottom: 14,
  },
  joinError: {
    color: referenceColors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  joinActions: {
    flexDirection: "row",
    gap: 10,
  },
  joinConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...buttonShadow,
  },
  joinConfirmText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: referenceColors.border,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: referenceColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
