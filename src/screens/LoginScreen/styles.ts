import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#22d3ee",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#22d3ee",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#000",
  },
  input: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 10,
  },
  success: {
    color: "#4ade80",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#22d3ee",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  setupLink: {
    color: "#6b7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },
  tempNote: {
    color: "#4b5563",
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});