import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { styles } from "./styles";

const SECTIONS = [
  {
    title: "Security & Privacy",
    items: ["Security", "Privacy", "Data Usage & Sharing"],
  },
  {
    title: "User Control & Permission",
    items: ["Account Management", "Camera & Permission", "Notification"],
  },
  {
    title: "User Agreement",
    items: ["Terms of Services", "Privacy Policy"],
  },
];

export default function SettingsScreen() {
  const { logout } = useAuth();

  const handleItemPress = (item: string) => {
    Alert.alert(item, "This section is coming soon.");
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => void logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.settingRow}
                onPress={() => handleItemPress(item)}
              >
                <Text style={styles.settingLabel}>{item}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Logout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => void handleLogout()}>
            <Text style={[styles.settingLabel, { color: "#f87171" }]}>Logout</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>IRIS v1.0.0 — Integrated Recognition for Intrusion System</Text>
      </ScrollView>
    </View>
  );
}