import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  content: {
    paddingBottom: 40,
  },

  // Hero section
  heroSection: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#2563eb",
  },
  avatarIcon: {
    fontSize: 40,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f9fafb",
    letterSpacing: 0.3,
  },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34,211,238,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.3)",
  },
  roleText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "600",
    textTransform: "capitalize",
  },

  // Sections
  sectionWrapper: {
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionDot: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#2563eb",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 4,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldInput: {
    color: "#f9fafb",
    fontSize: 15,
    paddingVertical: 2,
  },

  // Action buttons
  actionRow: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginTop: 10,
  },
  secondaryBtnText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 15,
  },
  dangerBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    marginTop: 10,
  },
  dangerBtnText: {
    color: "#dc2626",
    fontWeight: "600",
    fontSize: 15,
  },

  // Face profile card
  faceProfileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  faceAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  faceAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  faceInfo: {
    flex: 1,
    gap: 3,
  },
  faceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f9fafb",
  },
  faceDate: {
    fontSize: 12,
    color: "#64748b",
  },
  faceStatus: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "500",
  },
  faceEditBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  faceEditBtnText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },
  noFaceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  noFaceText: {
    color: "#64748b",
    fontSize: 14,
  },

  feedback: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
  },
  success: {
    color: "#16a34a",
    fontSize: 13,
  },
});