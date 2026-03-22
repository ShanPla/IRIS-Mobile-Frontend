import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
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
    fontSize: 28,
    fontWeight: "800",
    color: "#22d3ee",
    letterSpacing: 6,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e5e7eb",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
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
  hint: {
    color: "#4b5563",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
});