import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { probeBackend } from "../../lib/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Setup"> };

export default function SetupScreen({ navigation }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!url.trim()) { setError("Please enter the backend URL or Pi IP."); return; }
    setLoading(true);
    setError("");
    const result = await probeBackend(url);
    setLoading(false);
    if (!result.ok) { setError(result.message); return; }
    navigation.replace("Login");
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>IRIS</Text>
        <Text style={styles.title}>Connect to Backend</Text>
        <Text style={styles.desc}>
          Enter the IP address of the Raspberry Pi or backend URL.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 192.168.1.100:8000"
          placeholderTextColor="#6b7280"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void handleConnect()}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={() => void handleConnect()} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>Connect & Continue</Text>
          }
        </TouchableOpacity>
        <Text style={styles.hint}>For local testing: 127.0.0.1:8000</Text>
      </View>
    </KeyboardAvoidingView>
  );
}