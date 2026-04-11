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
    padding: 20,
    gap: 16,
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
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
    borderTopColor: "#e2e8f0",
  },
  settingLabel: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "500",
  },
  chevron: {
    color: "#64748b",
    fontSize: 18,
  },
  versionText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
});