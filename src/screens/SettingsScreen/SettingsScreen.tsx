import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AlertTriangle,
  Bell,
  Camera,
  ChevronRight,
  Gauge,
  LogOut,
  Shield,
  Siren,
  User,
  Users,
} from "lucide-react-native";
import type { MainTabParamList, RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { getSessionAccess } from "../../lib/access";
import { unpairCentralDevice } from "../../lib/backend";
import { piGet, piPost, piPut, removeDevice } from "../../lib/pi";
import type { SystemConfig, SystemStatus } from "../../types/iris";
import {
  buttonShadow,
  cardShadow,
  referenceColors,
} from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Settings">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface ResetResult {
  events_deleted: number;
  faces_deleted: number;
  users_deleted: number;
  pairings_deleted?: number;
  snapshots_cleared: boolean;
  config_reset: boolean;
}

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { logout, session, activeDevice, refreshDevices } = useAuth();
  const access = getSessionAccess(session);
  const layout = useScreenLayout({ bottom: "tab" });
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canViewFullSettings = access.isAdmin || access.isPrimary;

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

  const fetchConfig = useCallback(async () => {
    try {
      if (canViewFullSettings) {
        const [configData, statusData] = await Promise.all([
          piGet<SystemConfig>("/api/system/config", session?.username),
          piGet<SystemStatus>("/api/system/status", session?.username),
        ]);
        setConfig(configData);
        setStatus(statusData);
      } else {
        const statusData = await piGet<SystemStatus>(
          "/api/system/status",
          session?.username,
        );
        setConfig(null);
        setStatus(statusData);
      }
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to load settings",
      );
    } finally {
      setLoading(false);
    }
  }, [canViewFullSettings, session?.username]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchConfig();
    }, [fetchConfig]),
  );

  const updateField = <K extends keyof SystemConfig>(
    key: K,
    value: SystemConfig[K],
  ) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config || !canViewFullSettings) return;
    setSaving(true);
    try {
      await piPut("/api/system/config", config, session?.username);
      setDirty(false);
      Alert.alert("Saved", "Settings updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (newMode: "home" | "away") => {
    if (
      !status ||
      status.mode === newMode ||
      !(canViewFullSettings || access.canChangeMode)
    )
      return;
    try {
      await piPut("/api/system/mode", { mode: newMode }, session?.username);
      setStatus({ ...status, mode: newMode });
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to change mode",
      );
    }
  };

  const handleSilenceAlarm = async () => {
    if (
      !status ||
      !status.alarm_active ||
      !(canViewFullSettings || access.canSilenceAlarm)
    )
      return;
    try {
      const nextStatus = await piPut<SystemStatus>(
        "/api/system/alarm",
        { active: false },
        session?.username,
      );
      setStatus(nextStatus);
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Failed to silence alarm",
      );
    }
  };

  const handleFactoryReset = () => {
    Alert.alert(
      "Factory Reset",
      "This will permanently delete this Pi's events and faces, reset its configuration, and unlink paired users. User accounts will not be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: confirmReset,
        },
      ],
    );
  };

  const confirmReset = () => {
    Alert.alert(
      "Are you absolutely sure?",
      "Events, faces, local pairing links, and system settings for this Pi will be reset.",
      [
        { text: "No, go back", style: "cancel" },
        {
          text: "Yes, factory reset",
          style: "destructive",
          onPress: executeReset,
        },
      ],
    );
  };

  const executeReset = async () => {
    setResetting(true);
    try {
      const result = await piPost<ResetResult>(
        "/api/admin/factory-reset",
        undefined,
        session?.username,
      );
      if (activeDevice) {
        if (session?.token) {
          await unpairCentralDevice(activeDevice.deviceId, session.token).catch(
            (error) => {
              console.warn(
                "[IRIS Mobile] Could not remove reset device from registry:",
                error,
              );
            },
          );
        }
        await removeDevice(activeDevice.deviceId, session?.username);
        await refreshDevices();
      }
      Alert.alert(
        "Factory Reset Complete",
        `Cleared ${result.events_deleted} events and ${result.faces_deleted} faces, then unlinked ${result.pairings_deleted ?? 0} user pairing(s). The reset device was removed from this phone. Add it again from Setup when you want to pair it fresh.`,
        [{ text: "OK", onPress: () => navigation.navigate("DeviceList") }],
      );
    } catch (e) {
      Alert.alert(
        "Reset Failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setResetting(false);
    }
  };

  if (loading || (canViewFullSettings && !config)) {
    return (
      <View style={styles.centered}>
        <ReferenceBackdrop />
        <ActivityIndicator color={referenceColors.primary} />
      </View>
    );
  }

  const initials = (session?.username ?? "SW").slice(0, 2).toUpperCase();
  const role = session?.role?.replace(/_/g, " ") ?? "Admin";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
    >
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
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>
              Configure your security system
            </Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initials}</Text>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName}>
                {session?.username ?? "I.R.I.S User"}
              </Text>
              <Text style={styles.profileMeta}>
                {role} | {activeDevice?.name ?? "Front Door Camera"}
              </Text>
            </View>
          </View>

          {canViewFullSettings ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.groupCard}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconBlue]}>
                        <Bell
                          size={18}
                          color={referenceColors.primary}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>
                          Push Notifications
                        </Text>
                        <Text style={styles.settingDesc}>
                          Receive alerts on your device
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={config!.notifications_enabled}
                      onValueChange={(value) =>
                        updateField("notifications_enabled", value)
                      }
                      trackColor={{
                        true: referenceColors.primary,
                        false: "#cbd5e1",
                      }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={[styles.settingRow, styles.rowLast]}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconOrange]}>
                        <Camera
                          size={18}
                          color={referenceColors.warning}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>
                          Include Snapshot
                        </Text>
                        <Text style={styles.settingDesc}>
                          Attach images to alarms
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={config!.include_snapshot_in_alerts}
                      onValueChange={(value) =>
                        updateField("include_snapshot_in_alerts", value)
                      }
                      trackColor={{
                        true: referenceColors.primary,
                        false: "#cbd5e1",
                      }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Detection</Text>
                <View style={styles.groupCard}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconBlue]}>
                        <Gauge
                          size={18}
                          color={referenceColors.primary}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>
                          Motion Detection
                        </Text>
                        <Text style={styles.settingDesc}>Area threshold</Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="numeric"
                      value={String(config!.motion_area_threshold)}
                      onChangeText={(value) =>
                        updateField("motion_area_threshold", Number(value) || 0)
                      }
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconSlate]}>
                        <Shield
                          size={18}
                          color={referenceColors.textSoft}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>Cooldown</Text>
                        <Text style={styles.settingDesc}>
                          Seconds between detections
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="numeric"
                      value={String(config!.detection_cooldown_seconds)}
                      onChangeText={(value) =>
                        updateField(
                          "detection_cooldown_seconds",
                          Number(value) || 0,
                        )
                      }
                    />
                  </View>

                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconPurple]}>
                        <User size={18} color={referenceColors.purple} strokeWidth={2.2} />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>
                          Face Recognition Tolerance
                        </Text>
                        <Text style={styles.settingDesc}>
                          Match accuracy threshold
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="decimal-pad"
                      value={String(config!.face_recognition_tolerance)}
                      onChangeText={(value) =>
                        updateField(
                          "face_recognition_tolerance",
                          parseFloat(value) || 0,
                        )
                      }
                    />
                  </View>

                  <View style={[styles.settingRow, styles.rowLast]}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconRed]}>
                        <Siren
                          size={18}
                          color={referenceColors.danger}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>Alarm Delay</Text>
                        <Text style={styles.settingDesc}>
                          Escalation delay in seconds
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      style={styles.numInput}
                      keyboardType="numeric"
                      value={String(config!.alarm_escalation_delay)}
                      onChangeText={(value) =>
                        updateField(
                          "alarm_escalation_delay",
                          Number(value) || 0,
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shared Access</Text>
              <View style={styles.groupCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIcon, styles.iconBlue]}>
                      <Shield
                        size={18}
                        color={referenceColors.primary}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.settingCopy}>
                      <Text style={styles.settingLabel}>Current Mode</Text>
                      <Text style={styles.settingDesc}>
                        {status?.mode === "home"
                          ? "Home mode logs silently"
                          : "Away mode can trigger alarms"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.settingValue}>
                    {status?.mode === "away" ? "Away" : "Home"}
                  </Text>
                </View>

                {access.canChangeMode ? (
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconSlate]}>
                        <Gauge
                          size={18}
                          color={referenceColors.textSoft}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>Security Mode</Text>
                        <Text style={styles.settingDesc}>
                          Switch between Home and Away
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modeToggle}>
                      <TouchableOpacity
                        style={[
                          styles.modeButton,
                          status?.mode === "home" && styles.modeButtonActive,
                        ]}
                        onPress={() => void handleModeChange("home")}
                      >
                        <Text
                          style={[
                            styles.modeText,
                            status?.mode === "home" && styles.modeTextActive,
                          ]}
                        >
                          Home
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.modeButton,
                          status?.mode === "away" && styles.modeButtonActive,
                        ]}
                        onPress={() => void handleModeChange("away")}
                      >
                        <Text
                          style={[
                            styles.modeText,
                            status?.mode === "away" && styles.modeTextActive,
                          ]}
                        >
                          Away
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {access.canSilenceAlarm ? (
                  <View style={[styles.settingRow, styles.rowLast]}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconRed]}>
                        <Siren
                          size={18}
                          color={referenceColors.danger}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>Alarm Control</Text>
                        <Text style={styles.settingDesc}>
                          {status?.alarm_active
                            ? "The alarm is active on this device."
                            : "The alarm is currently silent."}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.inlineActionButton,
                        !status?.alarm_active &&
                          styles.inlineActionButtonDisabled,
                      ]}
                      onPress={() => void handleSilenceAlarm()}
                      disabled={!status?.alarm_active}
                    >
                      <Text style={styles.inlineActionButtonText}>Silence</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.settingRow, styles.rowLast]}>
                    <View style={styles.settingInfo}>
                      <View style={[styles.settingIcon, styles.iconGreen]}>
                        <Shield
                          size={18}
                          color={referenceColors.success}
                          strokeWidth={2.2}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingLabel}>
                          Shared Access Scope
                        </Text>
                        <Text style={styles.settingDesc}>
                          You can only use the controls granted by the primary
                          user.
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {canViewFullSettings ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System</Text>
              <View style={styles.groupCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIcon, styles.iconSlate]}>
                      <Shield
                        size={18}
                        color={referenceColors.textSoft}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.settingCopy}>
                      <Text style={styles.settingLabel}>Security Mode</Text>
                      <Text style={styles.settingDesc}>
                        {status?.mode === "home"
                          ? "Home mode logs silently"
                          : "Away mode triggers alarms"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modeToggle}>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        status?.mode === "home" && styles.modeButtonActive,
                      ]}
                      onPress={() => void handleModeChange("home")}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          status?.mode === "home" && styles.modeTextActive,
                        ]}
                      >
                        Home
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modeButton,
                        status?.mode === "away" && styles.modeButtonActive,
                      ]}
                      onPress={() => void handleModeChange("away")}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          status?.mode === "away" && styles.modeTextActive,
                        ]}
                      >
                        Away
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.settingRow, styles.rowLast]}>
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIcon, styles.iconGreen]}>
                      <Siren
                        size={18}
                        color={referenceColors.success}
                        strokeWidth={2.2}
                      />
                    </View>
                    <View style={styles.settingCopy}>
                      <Text style={styles.settingLabel}>Buzzer Enabled</Text>
                      <Text style={styles.settingDesc}>Local alarm sound</Text>
                    </View>
                  </View>
                  <Switch
                    value={config!.buzzer_enabled}
                    onValueChange={(value) =>
                      updateField("buzzer_enabled", value)
                    }
                    trackColor={{
                      true: referenceColors.primary,
                      false: "#cbd5e1",
                    }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            </View>
          ) : null}

          {canViewFullSettings && dirty ? (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.groupCard}>
              <TouchableOpacity
                style={[styles.settingRow, styles.rowLast]}
                onPress={logout}
              >
                <View style={styles.settingInfo}>
                  <View style={[styles.settingIcon, styles.iconRed]}>
                    <LogOut
                      size={18}
                      color={referenceColors.danger}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View style={styles.settingCopy}>
                    <Text style={styles.logoutLabel}>Log Out</Text>
                    <Text style={styles.settingDesc}>
                      Sign out of your account
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {access.canOpenSharedUsers ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Users & Sharing</Text>
              <View style={styles.groupCard}>
                <TouchableOpacity
                  style={[styles.settingRow, styles.rowLast]}
                  onPress={() => navigation.navigate("Users")}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingInfo}>
                    <View style={[styles.settingIcon, styles.iconPurple]}>
                      <Users size={18} color={referenceColors.purple} strokeWidth={2.2} />
                    </View>
                    <View style={styles.settingCopy}>
                      <Text style={styles.settingLabel}>Manage Users</Text>
                      <Text style={styles.settingDesc}>
                        Invite users and manage shared access
                      </Text>
                    </View>
                  </View>
                  <ChevronRight
                    size={18}
                    color={referenceColors.textMuted}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {canViewFullSettings ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Management</Text>
              <TouchableOpacity
                style={styles.dangerCard}
                onPress={handleFactoryReset}
                disabled={resetting}
              >
                <View style={[styles.settingIcon, styles.iconRed]}>
                  {resetting ? (
                    <ActivityIndicator color={referenceColors.danger} />
                  ) : (
                    <AlertTriangle
                      size={18}
                      color={referenceColors.danger}
                      strokeWidth={2.2}
                    />
                  )}
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.dangerTitle}>Factory Reset</Text>
                  <Text style={styles.settingDesc}>
                    Permanently erase this device and unlink users
                  </Text>
                </View>
                <ChevronRight
                  size={16}
                  color={referenceColors.danger}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>I.R.I.S v2.1.0</Text>
            <Text style={styles.versionText}>2026 Security Systems</Text>
          </View>
        </Animated.ScrollView>
      </View>
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
    paddingBottom: 118,
  },
  centered: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: 18,
  },
  pageTitle: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 20,
    marginBottom: 20,
    ...cardShadow,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: referenceColors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  profileMeta: {
    color: referenceColors.textSoft,
    fontSize: 13,
    marginTop: 4,
    textTransform: "capitalize",
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  groupCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    overflow: "hidden",
    ...cardShadow,
  },
  settingRow: {
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBlue: {
    backgroundColor: "#dbeafe",
  },
  iconOrange: {
    backgroundColor: "#ffedd5",
  },
  iconSlate: {
    backgroundColor: "#f1f5f9",
  },
  iconPurple: {
    backgroundColor: referenceColors.purpleSoft,
  },
  iconRed: {
    backgroundColor: "#fee2e2",
  },
  iconGreen: {
    backgroundColor: "#dcfce7",
  },
  settingLabel: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  settingDesc: {
    color: referenceColors.textMuted,
    fontSize: 12,
    marginTop: 4,
    flexShrink: 1,
  },
  settingValue: {
    color: referenceColors.textSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  numInput: {
    minWidth: 82,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: referenceColors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: "right",
    fontSize: 14,
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 3,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: referenceColors.primary,
  },
  modeText: {
    color: referenceColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#ffffff",
  },
  inlineActionButton: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  inlineActionButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  inlineActionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    ...buttonShadow,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  logoutLabel: {
    color: referenceColors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
  dangerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,241,242,0.88)",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 18,
    ...cardShadow,
  },
  dangerTitle: {
    color: referenceColors.danger,
    fontSize: 15,
    fontWeight: "800",
  },
  versionInfo: {
    alignItems: "center",
    marginTop: 26,
    gap: 4,
  },
  versionText: {
    color: "#94a3b8",
    fontSize: 12,
  },
});
