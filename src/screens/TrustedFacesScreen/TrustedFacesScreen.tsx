import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";

const PERMISSION_LABELS: Array<{ key: keyof PermissionSet; label: string }> = [
  { key: "can_view_events", label: "View Events" },
  { key: "can_silence_alarm", label: "Silence Alarm" },
  { key: "can_change_mode", label: "Change Mode" },
  { key: "can_manage_profiles", label: "Manage Profiles" },
];

export default function TrustedFacesScreen() {
  const { session } = useAuth();
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
  const [latestInvite, setLatestInvite] = useState<DeviceInviteResult | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const data = await piGet<InvitedUser[]>("/api/auth/invited", session?.username);
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
    }, [fetchUsers])
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
    setInvitePermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const generateInviteCode = async () => {
    if (!inviteUsername.trim()) {
      setInviteError("Username is required");
      return;
    }

    setCreatingInvite(true);
    setInviteError("");
    try {
      const invite = await createTrustedUserInvite(
        inviteUsername.trim(),
        invitePermissions,
        session?.username,
      );
      setLatestInvite(invite);
      Alert.alert(
        "Invite Code Ready",
        `${invite.device_id}\n\nShare the device code and invite code with ${inviteUsername.trim()}.`,
      );
    } catch (e) {
      setLatestInvite(null);
      setInviteError(e instanceof Error ? e.message : "Failed to generate invite code");
    } finally {
      setCreatingInvite(false);
    }
  };

  const savePermissions = async () => {
    if (!selected || !selected.permissions) return;
    setSaving(true);
    try {
      await piPut(`/api/auth/invite/${selected.username}/permissions`, selected.permissions, session?.username);
      setUsers((prev) => prev.map((user) => (user.id === selected.id ? { ...user, permissions: selected.permissions } : user)));
      Alert.alert("Saved", "Permissions updated");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
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
    <View style={styles.container}>
      <ReferenceBackdrop />
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Trusted Users</Text>
            <Text style={styles.subtitle}>Users paired with your devices</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Add Trusted User</Text>
          <Text style={styles.inviteSubtitle}>
            Enter the username, choose their access, then share the device code and invite code.
          </Text>

          <TextInput
            style={styles.inviteInput}
            placeholder="Username to invite"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            value={inviteUsername}
            onChangeText={setInviteUsername}
          />

          <View style={styles.invitePermissionsCard}>
            {PERMISSION_LABELS.map(({ key, label }) => (
              <View key={key} style={styles.permissionRow}>
                <Text style={styles.permissionLabel}>{label}</Text>
                <Switch
                  value={invitePermissions[key]}
                  onValueChange={() => toggleInvitePermission(key)}
                  trackColor={{ true: referenceColors.primary, false: "#cbd5e1" }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>

          {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}

          <TouchableOpacity
            style={[styles.generateButton, creatingInvite && styles.buttonDisabled]}
            onPress={() => void generateInviteCode()}
            disabled={creatingInvite}
          >
            {creatingInvite ? (
              <ActivityIndicator color={referenceColors.primary} />
            ) : (
              <Text style={styles.generateButtonText}>Generate Invite Code</Text>
            )}
          </TouchableOpacity>

          {latestInvite ? (
            <View style={styles.generatedCodeCard}>
              <Text style={styles.generatedCodeTitle}>Share These Codes</Text>
              <View style={styles.generatedCodeRow}>
                <Text style={styles.generatedCodeLabel}>Device Code</Text>
                <Text style={styles.generatedCodeValue}>{latestInvite.device_id}</Text>
              </View>
              <View style={styles.generatedCodeBlock}>
                <Text style={styles.generatedCodeLabel}>Invite Code</Text>
                <Text style={styles.generatedInviteCode}>{latestInvite.invite_code}</Text>
              </View>
              <Text style={styles.generatedCodeHint}>
                {inviteUsername.trim()} must join with this device code and invite code before {new Date(latestInvite.expires_at).toLocaleString()}.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Users size={20} color={referenceColors.primary} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.summaryValue}>{users.length}</Text>
            <Text style={styles.summaryLabel}>Total Users</Text>
          </View>
        </View>

        {users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No invited users. Invite homeowners from the admin panel.</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={users}
              keyExtractor={(item) => String(item.id)}
              style={styles.userList}
              contentContainerStyle={styles.userListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.userCard, selected?.id === item.id && styles.userCardSelected]}
                  onPress={() => setSelected(item)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
                  </View>
                  <View style={styles.userCopy}>
                    <Text style={styles.userName}>{item.username}</Text>
                    <View style={styles.userBadge}>
                      <Shield size={12} color={referenceColors.primary} strokeWidth={2.2} />
                      <Text style={styles.userBadgeText}>{item.role}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />

            <View style={styles.permissionsCard}>
              {selected && selected.permissions ? (
                <>
                  <Text style={styles.permissionsTitle}>Permissions for {selected.username}</Text>
                  {PERMISSION_LABELS.map(({ key, label }) => (
                    <View key={key} style={styles.permissionRow}>
                      <Text style={styles.permissionLabel}>{label}</Text>
                      <Switch
                        value={selected.permissions![key]}
                        onValueChange={() => togglePermission(key)}
                        trackColor={{ true: referenceColors.primary, false: "#cbd5e1" }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  ))}

                  <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={() => void savePermissions()} disabled={saving}>
                    {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.selectHint}>Select a user to manage permissions</Text>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  content: {
    flex: 1,
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
  },
  generatedCodeHint: {
    color: referenceColors.textSoft,
    fontSize: 12,
    lineHeight: 17,
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
  userList: {
    maxHeight: 300,
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
    flex: 1,
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
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  permissionLabel: {
    color: referenceColors.text,
    fontSize: 14,
    fontWeight: "600",
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
