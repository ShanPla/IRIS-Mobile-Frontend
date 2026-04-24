import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Shield, Users } from "lucide-react-native";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { useAuth } from "../../context/AuthContext";
import { createTrustedUserInvite, piGet, piPut } from "../../lib/pi";
import type { DeviceInviteResult } from "../../lib/pi";
import type { InvitedUser, PermissionSet } from "../../types/iris";
import {
  buttonShadow,
  cardShadow,
  referenceColors,
} from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

const PERMISSION_LABELS: Array<{ key: keyof PermissionSet; label: string }> = [
  { key: "can_view_events", label: "View Events" },
  { key: "can_silence_alarm", label: "Silence Alarm" },
  { key: "can_change_mode", label: "Change Mode" },
  { key: "can_manage_profiles", label: "Manage Profiles" },
];

type GeneratedInvite = {
  invite: DeviceInviteResult;
  username: string;
  permissionLabels: string[];
};

function buildInviteShareMessage(generatedInvite: GeneratedInvite): string {
  return [
    `IRIS invite for ${generatedInvite.username}`,
    "",
    `Device code: ${generatedInvite.invite.device_id}`,
    `Invite code: ${generatedInvite.invite.invite_code}`,
    `Permissions: ${generatedInvite.permissionLabels.join(", ") || "Basic access only"}`,
    `Expires: ${new Date(generatedInvite.invite.expires_at).toLocaleString()}`,
    "",
    `Join using the invited username: ${generatedInvite.username}`,
  ].join("\n");
}

export default function TrustedFacesScreen() {
  const { session } = useAuth();
  const layout = useScreenLayout({ bottom: "stack" });
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [selected, setSelected] = useState<InvitedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<PermissionSet>({
    can_view_events: true,
    can_silence_alarm: false,
    can_change_mode: false,
    can_manage_profiles: false,
  });
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [latestInvite, setLatestInvite] = useState<GeneratedInvite | null>(
    null,
  );

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const data = await piGet<InvitedUser[]>(
        "/api/auth/invited",
        session?.username,
      );
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [session?.username]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchUsers();
    }, [fetchUsers]),
  );

  const togglePermission = (key: keyof PermissionSet) => {
    if (!selected || !selected.permissions) return;
    setSelected({
      ...selected,
      permissions: {
        ...selected.permissions,
        [key]: !selected.permissions[key],
      },
    });
  };

  const toggleInvitePermission = (key: keyof PermissionSet) => {
    setInviteError("");
    setInvitePermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const generateInviteCode = async () => {
    const trimmedUsername = inviteUsername.trim();
    if (!trimmedUsername) {
      setInviteError("Username is required");
      return;
    }

    setCreatingInvite(true);
    setInviteError("");
    setLatestInvite(null);
    try {
      const permissionLabels = PERMISSION_LABELS.filter(
        ({ key }) => invitePermissions[key],
      ).map(({ label }) => label);
      const invite = await createTrustedUserInvite(
        trimmedUsername,
        invitePermissions,
        session?.username,
      );
      setLatestInvite({
        invite,
        username: trimmedUsername,
        permissionLabels,
      });
    } catch (e) {
      setLatestInvite(null);
      setInviteError(
        e instanceof Error ? e.message : "Failed to generate invite code",
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const savePermissions = async () => {
    if (!selected || !selected.permissions) return;
    setSaving(true);
    try {
      await piPut(
        `/api/auth/invite/${selected.username}/permissions`,
        selected.permissions,
        session?.username,
      );
      setUsers((prev) =>
        prev.map((user) =>
          user.id === selected.id
            ? { ...user, permissions: selected.permissions }
            : user,
        ),
      );
      Alert.alert("Saved", "Permissions updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const shareInvite = async () => {
    if (!latestInvite) return;

    try {
      await Share.share({
        message: buildInviteShareMessage(latestInvite),
      });
    } catch (e) {
      Alert.alert(
        "Share Failed",
        e instanceof Error ? e.message : "Could not open the share sheet.",
      );
    }
  };

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

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
      <View style={styles.container}>
        <ReferenceBackdrop />
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, layout.contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Trusted Users</Text>
              <Text style={styles.subtitle}>
                Invite and manage shared device access
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>Add Trusted User</Text>
            <Text style={styles.inviteSubtitle}>
              Enter the username, choose their access, then generate one
              shareable invite package for them.
            </Text>

            <TextInput
              style={styles.inviteInput}
              placeholder="Username to invite"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              value={inviteUsername}
              onChangeText={(value) => {
                setInviteUsername(value);
                setInviteError("");
              }}
            />

            <View style={styles.invitePermissionsCard}>
              {PERMISSION_LABELS.map(({ key, label }) => (
                <View key={key} style={styles.permissionRow}>
                  <Text style={styles.permissionLabel}>{label}</Text>
                  <Switch
                    value={invitePermissions[key]}
                    onValueChange={() => toggleInvitePermission(key)}
                    trackColor={{
                      true: referenceColors.primary,
                      false: "#cbd5e1",
                    }}
                    thumbColor="#ffffff"
                  />
                </View>
              ))}
            </View>

            {inviteError ? (
              <Text style={styles.error}>{inviteError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.generateButton,
                creatingInvite && styles.buttonDisabled,
              ]}
              onPress={() => void generateInviteCode()}
              disabled={creatingInvite}
            >
              {creatingInvite ? (
                <ActivityIndicator color={referenceColors.primary} />
              ) : (
                <Text style={styles.generateButtonText}>
                  Generate Invite Code
                </Text>
              )}
            </TouchableOpacity>

            {latestInvite ? (
              <View style={styles.generatedCodeCard}>
                <Text style={styles.generatedCodeTitle}>
                  Invite Ready for {latestInvite.username}
                </Text>
                <Text style={styles.generatedCodeHint}>
                  Share both codes below. {latestInvite.username} must join
                  before{" "}
                  {new Date(latestInvite.invite.expires_at).toLocaleString()}.
                </Text>
                <View style={styles.generatedSteps}>
                  <View style={styles.generatedStep}>
                    <Text style={styles.generatedStepNumber}>1</Text>
                    <Text style={styles.generatedStepText}>
                      Send the device code.
                    </Text>
                  </View>
                  <View style={styles.generatedStep}>
                    <Text style={styles.generatedStepNumber}>2</Text>
                    <Text style={styles.generatedStepText}>
                      Send the invite code.
                    </Text>
                  </View>
                  <View style={styles.generatedStep}>
                    <Text style={styles.generatedStepNumber}>3</Text>
                    <Text style={styles.generatedStepText}>
                      They sign in as {latestInvite.username}.
                    </Text>
                  </View>
                </View>
                <View style={styles.generatedCodeRow}>
                  <Text style={styles.generatedCodeLabel}>Device Code</Text>
                  <Text selectable style={styles.generatedCodeValue}>
                    {latestInvite.invite.device_id}
                  </Text>
                </View>
                <View style={styles.generatedCodeBlock}>
                  <Text style={styles.generatedCodeLabel}>Invite Code</Text>
                  <Text selectable style={styles.generatedInviteCode}>
                    {latestInvite.invite.invite_code}
                  </Text>
                </View>
                <View style={styles.generatedPermissionList}>
                  {latestInvite.permissionLabels.map((label) => (
                    <View key={label} style={styles.generatedPermissionChip}>
                      <Text style={styles.generatedPermissionText}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.shareInviteButton}
                  onPress={() => void shareInvite()}
                  activeOpacity={0.9}
                >
                  <Text style={styles.shareInviteButtonText}>Share Invite</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Users
                size={20}
                color={referenceColors.primary}
                strokeWidth={2.2}
              />
            </View>
            <View>
              <Text style={styles.summaryValue}>{users.length}</Text>
              <Text style={styles.summaryLabel}>Total Users</Text>
            </View>
          </View>

          {users.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No invited users yet. Enter a username above to create an
                invite.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.userListContent}>
                {users.map((item) => (
                  <TouchableOpacity
                    key={String(item.id)}
                    style={[
                      styles.userCard,
                      selected?.id === item.id && styles.userCardSelected,
                    ]}
                    onPress={() => setSelected(item)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {getInitials(item.username)}
                      </Text>
                    </View>
                    <View style={styles.userCopy}>
                      <Text style={styles.userName}>{item.username}</Text>
                      <View style={styles.userBadge}>
                        <Shield
                          size={12}
                          color={referenceColors.primary}
                          strokeWidth={2.2}
                        />
                        <Text style={styles.userBadgeText}>{item.role}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.permissionsCard}>
                {selected && selected.permissions ? (
                  <>
                    <Text style={styles.permissionsTitle}>
                      Permissions for {selected.username}
                    </Text>
                    {PERMISSION_LABELS.map(({ key, label }) => (
                      <View key={key} style={styles.permissionRow}>
                        <Text style={styles.permissionLabel}>{label}</Text>
                        <Switch
                          value={selected.permissions![key]}
                          onValueChange={() => togglePermission(key)}
                          trackColor={{
                            true: referenceColors.primary,
                            false: "#cbd5e1",
                          }}
                          thumbColor="#ffffff"
                        />
                      </View>
                    ))}

                    <TouchableOpacity
                      style={[
                        styles.saveButton,
                        saving && styles.buttonDisabled,
                      ]}
                      onPress={() => void savePermissions()}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.saveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.selectHint}>
                    Select a user to manage permissions
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
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
    flexGrow: 1,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
  error: {
    color: referenceColors.danger,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
  },
  inviteCard: {
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 18,
    marginBottom: 18,
    ...cardShadow,
  },
  inviteTitle: {
    color: referenceColors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  inviteSubtitle: {
    color: referenceColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
  },
  inviteInput: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    color: referenceColors.text,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  invitePermissionsCard: {
    borderRadius: 18,
    backgroundColor: "rgba(248,250,252,0.84)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    marginTop: 14,
  },
  generateButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    ...buttonShadow,
  },
  generateButtonText: {
    color: referenceColors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  generatedCodeCard: {
    borderRadius: 18,
    backgroundColor: "rgba(239,246,255,0.78)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  generatedCodeTitle: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  generatedSteps: {
    gap: 8,
  },
  generatedStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  generatedStepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    color: referenceColors.primary,
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "#dbeafe",
    lineHeight: 22,
  },
  generatedStepText: {
    flex: 1,
    color: referenceColors.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  generatedCodeRow: {
    gap: 6,
  },
  generatedCodeBlock: {
    gap: 6,
  },
  generatedCodeLabel: {
    color: referenceColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  generatedCodeValue: {
    color: referenceColors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  generatedInviteCode: {
    color: referenceColors.primary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    flexShrink: 1,
  },
  generatedCodeHint: {
    color: referenceColors.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  generatedPermissionList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  generatedPermissionChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  generatedPermissionText: {
    color: referenceColors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  shareInviteButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  shareInviteButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: "rgba(238,246,255,0.84)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 20,
    marginBottom: 18,
    ...cardShadow,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    color: referenceColors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: referenceColors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 22,
    ...cardShadow,
  },
  emptyText: {
    color: referenceColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  userListContent: {
    paddingBottom: 8,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  userCardSelected: {
    backgroundColor: "rgba(219,234,254,0.84)",
    borderColor: "#bfdbfe",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: referenceColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: referenceColors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  userBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  userBadgeText: {
    color: referenceColors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  permissionsCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 18,
    marginTop: 10,
    ...cardShadow,
  },
  permissionsTitle: {
    color: referenceColors.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
  },
  permissionRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  permissionLabel: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    minWidth: 0,
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    ...buttonShadow,
  },
  saveText: {
    color: referenceColors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  selectHint: {
    color: referenceColors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginTop: 28,
  },
});
