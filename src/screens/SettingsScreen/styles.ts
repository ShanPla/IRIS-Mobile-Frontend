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
    padding: 20,
    gap: 16,
  },
  section: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22d3ee",
    padding: 16,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  settingLabel: {
    fontSize: 15,
    color: "#e5e7eb",
    fontWeight: "500",
  },
  chevron: {
    color: "#6b7280",
    fontSize: 18,
  },
  versionText: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
});