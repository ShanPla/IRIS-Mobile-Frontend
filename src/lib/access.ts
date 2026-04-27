import type { AuthSession, PermissionSet } from "../types/iris";

const NO_PERMISSIONS: PermissionSet = {
  can_view_events: false,
  can_silence_alarm: false,
  can_change_mode: false,
  can_manage_profiles: false,
};

export interface SessionAccess {
  isAdmin: boolean;
  isPrimary: boolean;
  isInvited: boolean;
  permissions: PermissionSet;
  canViewEvents: boolean;
  canSilenceAlarm: boolean;
  canChangeMode: boolean;
  canManageProfiles: boolean;
  canOpenHome: boolean;
  canOpenEvents: boolean;
  canOpenLive: boolean;
  canOpenFaces: boolean;
  canOpenSettings: boolean;
  canOpenSharedUsers: boolean;
  canAddDevice: boolean;
  canJoinSharedDevices: boolean;
  canOpenAdmin: boolean;
  hasAnyMainAccess: boolean;
}

export function getEffectivePermissions(
  session: AuthSession | null | undefined,
): PermissionSet {
  const role = session?.role ?? "";
  if (role === "admin" || role === "homeowner_primary") {
    return {
      can_view_events: true,
      can_silence_alarm: true,
      can_change_mode: true,
      can_manage_profiles: true,
    };
  }

  return session?.permissions ?? NO_PERMISSIONS;
}

export function getSessionAccess(
  session: AuthSession | null | undefined,
): SessionAccess {
  const role = session?.role ?? "";
  const permissions = getEffectivePermissions(session);
  const isAdmin = role === "admin";
  const isPrimary = role === "homeowner_primary";
  const isInvited = role === "homeowner_invited";
  const canViewEvents = permissions.can_view_events;
  const canSilenceAlarm = permissions.can_silence_alarm;
  const canChangeMode = permissions.can_change_mode;
  const canManageProfiles = permissions.can_manage_profiles;
  const canOpenSettings =
    isAdmin || isPrimary || canChangeMode || canSilenceAlarm;
  const canOpenSharedUsers = isAdmin || isPrimary;
  const canAddDevice = isAdmin || isPrimary || isInvited;
  // Home is accessible whenever the user has at least one usable feature
  const hasAnyFeatureAccess =
    canViewEvents || canManageProfiles || canChangeMode || canSilenceAlarm;
  const canOpenHome = isAdmin || isPrimary || hasAnyFeatureAccess;

  return {
    isAdmin,
    isPrimary,
    isInvited,
    permissions,
    canViewEvents,
    canSilenceAlarm,
    canChangeMode,
    canManageProfiles,
    canOpenHome,
    canOpenEvents: canViewEvents,
    canOpenLive: canViewEvents,
    canOpenFaces: canManageProfiles,
    canOpenSettings,
    canOpenSharedUsers,
    canAddDevice,
    canJoinSharedDevices: true,
    canOpenAdmin: isAdmin,
    hasAnyMainAccess: canOpenHome,
  };
}
