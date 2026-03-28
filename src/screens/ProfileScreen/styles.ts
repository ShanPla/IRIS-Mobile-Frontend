import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  header: {
    backgroundColor: "#111827",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  content: {
    paddingBottom: 40,
  },

  // Hero section
  heroSection: {
    backgroundColor: "#111827",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
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
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#22d3ee",
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
    backgroundColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#111827",
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
    color: "#22d3ee",
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
    backgroundColor: "#22d3ee",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 4,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    fontSize: 11,
    color: "#6b7280",
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
    backgroundColor: "#22d3ee",
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
    borderColor: "#374151",
    marginTop: 10,
  },
  secondaryBtnText: {
    color: "#9ca3af",
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
    color: "#f87171",
    fontWeight: "600",
    fontSize: 15,
  },

  // Face profile card
  faceProfileCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
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
    borderColor: "#22d3ee",
  },
  faceAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1f2937",
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
    color: "#6b7280",
  },
  faceStatus: {
    fontSize: 12,
    color: "#4ade80",
    fontWeight: "500",
  },
  faceEditBtn: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  faceEditBtnText: {
    color: "#22d3ee",
    fontSize: 13,
    fontWeight: "600",
  },
  noFaceCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  noFaceText: {
    color: "#6b7280",
    fontSize: 14,
  },

  feedback: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
  },
  success: {
    color: "#4ade80",
    fontSize: 13,
  },
});