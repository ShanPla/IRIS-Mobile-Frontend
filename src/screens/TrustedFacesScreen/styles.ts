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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },
  content: {
    padding: 20,
  },
  userList: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
    overflow: "hidden",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  userRowSelected: {
    backgroundColor: "#dbeafe",
  },
  userRowLast: {
    borderBottomWidth: 0,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: "#475569",
    fontSize: 18,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#0f172a",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selectedSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 16,
  },
  selectedLabel: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 4,
  },
  selectedUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  permissionLabel: {
    fontSize: 14,
    color: "#0f172a",
  },
  saveBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendText: {
    color: "#64748b",
    fontSize: 12,
  },
  empty: {
    color: "#64748b",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    marginBottom: 12,
  },
});