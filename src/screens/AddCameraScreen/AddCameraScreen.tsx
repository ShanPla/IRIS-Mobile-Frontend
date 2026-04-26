import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, Camera, ChevronRight } from "lucide-react-native";
import type { RootStackParamList } from "../../../App";
import ReferenceBackdrop from "../../components/ReferenceBackdrop";
import { buttonShadow, cardShadow, referenceColors } from "../../theme/reference";
import { useScreenLayout } from "../../theme/layout";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddCameraScreen() {
  const navigation = useNavigation<Nav>();
  const layout = useScreenLayout({ bottom: "stack", centered: true });

  return (
    <View style={styles.container}>
      <ReferenceBackdrop />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, layout.contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={referenceColors.textSoft} strokeWidth={2.2} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Add Camera</Text>
          <Text style={styles.subtitle}>Pair another IRIS device to this phone</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Camera size={22} color={referenceColors.primary} strokeWidth={2.2} />
          </View>
          <Text style={styles.desc}>To add a new Pi camera, go to the Setup screen and enter its device code.</Text>

          <TouchableOpacity style={styles.buttonWrap} onPress={() => navigation.navigate("Setup")} activeOpacity={0.9}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>Go to Setup</Text>
              <ChevronRight size={18} color="#ffffff" strokeWidth={2.2} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: referenceColors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  backText: {
    color: referenceColors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: referenceColors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: referenceColors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: referenceColors.border,
    padding: 24,
    alignItems: "center",
    ...cardShadow,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  desc: {
    color: referenceColors.textSoft,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  buttonWrap: {
    borderRadius: 18,
    marginTop: 24,
    width: "100%",
    ...buttonShadow,
  },
  button: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: referenceColors.primary,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
