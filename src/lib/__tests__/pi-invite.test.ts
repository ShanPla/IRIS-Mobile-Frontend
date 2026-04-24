jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import { extractTrustedUserInvite, isLegacyDeviceInviteCode } from "../pi";

function toBase64Url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("invite helpers", () => {
  it("detects legacy JWT invite codes", () => {
    expect(isLegacyDeviceInviteCode("aaa.bbb.ccc")).toBe(true);
    expect(isLegacyDeviceInviteCode("ABCDE-12345")).toBe(false);
  });

  it("extracts a short invite and device code from the shared message", () => {
    expect(
      extractTrustedUserInvite(
        [
          "IRIS invite for guest",
          "Device code: IRIS-A123",
          "Invite code: ABCDE-12345",
        ].join("\n"),
      ),
    ).toEqual({
      inviteCode: "ABCDE-12345",
      deviceId: "IRIS-A123",
    });
  });

  it("falls back to the legacy invite payload when no device code line exists", () => {
    const payload = toBase64Url({
      device_id: "IRIS-B234",
      device_url: "https://device.example.com",
      invited_username: "guest",
    });
    const inviteCode = `header.${payload}.sig`;

    expect(extractTrustedUserInvite(inviteCode)).toEqual({
      inviteCode,
      deviceId: "IRIS-B234",
    });
  });
});
