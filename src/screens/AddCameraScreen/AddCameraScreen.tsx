import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddCameraScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Camera</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.content}>
        <Text style={styles.desc}>To add a new Pi camera, go to the Setup screen and enter your Pi's URL and Device ID.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Setup")}>
          <Text style={styles.buttonText}>Go to Setup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backText: { color: "#22d3ee", fontSize: 15 },
  title: { color: "#e5e7eb", fontSize: 18, fontWeight: "700" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  desc: { color: "#9ca3af", fontSize: 15, textAlign: "center", marginBottom: 24 },
  button: { backgroundColor: "#22d3ee", borderRadius: 8, padding: 16, paddingHorizontal: 32, alignItems: "center" },
  buttonText: { color: "#030712", fontWeight: "700", fontSize: 16 },
});
