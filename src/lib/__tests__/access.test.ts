import { getEffectivePermissions, getSessionAccess } from "../access";
import type { AuthSession } from "../../types/iris";

function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    token: "token",
    username: "user",
    email: "user@gmail.com",
    role: "homeowner_primary",
    permissions: null,
    ...overrides,
  };
}

describe("getEffectivePermissions", () => {
  it("grants all app permissions to primary homeowners", () => {
    expect(getEffectivePermissions(makeSession())).toEqual({
      can_view_events: true,
      can_silence_alarm: true,
      can_change_mode: true,
      can_manage_profiles: true,
    });
  });

  it("uses the stored invited-user permissions", () => {
    expect(
      getEffectivePermissions(
        makeSession({
          role: "homeowner_invited",
          permissions: {
            can_view_events: true,
            can_silence_alarm: false,
            can_change_mode: true,
            can_manage_profiles: false,
          },
        }),
      ),
    ).toEqual({
      can_view_events: true,
      can_silence_alarm: false,
      can_change_mode: true,
      can_manage_profiles: false,
    });
  });
});

describe("getSessionAccess", () => {
  it("keeps invited users away from primary-only pages", () => {
    const access = getSessionAccess(
      makeSession({
        role: "homeowner_invited",
        permissions: {
          can_view_events: true,
          can_silence_alarm: false,
          can_change_mode: false,
          can_manage_profiles: false,
        },
      }),
    );

    expect(access.canOpenHome).toBe(true);
    expect(access.canOpenEvents).toBe(true);
    expect(access.canOpenLive).toBe(true);
    expect(access.canOpenFaces).toBe(false);
    expect(access.canOpenSettings).toBe(false);
    expect(access.canOpenSharedUsers).toBe(false);
    expect(access.canAddDevice).toBe(false);
    expect(access.canOpenAdmin).toBe(false);
  });

  it("allows invited users to see settings only when they have shared controls", () => {
    const access = getSessionAccess(
      makeSession({
        role: "homeowner_invited",
        permissions: {
          can_view_events: false,
          can_silence_alarm: true,
          can_change_mode: false,
          can_manage_profiles: false,
        },
      }),
    );

    expect(access.canOpenHome).toBe(false);
    expect(access.canOpenSettings).toBe(true);
    expect(access.hasAnyMainAccess).toBe(true);
  });

  it("falls back to a no-access state when nothing is granted", () => {
    const access = getSessionAccess(
      makeSession({
        role: "homeowner_invited",
        permissions: {
          can_view_events: false,
          can_silence_alarm: false,
          can_change_mode: false,
          can_manage_profiles: false,
        },
      }),
    );

    expect(access.hasAnyMainAccess).toBe(false);
    expect(access.canOpenHome).toBe(false);
    expect(access.canOpenSettings).toBe(false);
    expect(access.canOpenFaces).toBe(false);
  });
});
