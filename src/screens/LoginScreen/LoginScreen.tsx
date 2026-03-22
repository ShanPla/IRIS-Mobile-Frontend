import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";
import { styles } from "./styles";

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, "Login"> };

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { setError("Username and password are required."); return; }
    setLoading(true);
    setError("");
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      navigation.replace("Main");
    } else {
      setError("Login failed. Check your credentials.");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>IRIS</Text>
        <Text style={styles.subtitle}>Integrated Recognition for Intrusion System</Text>
        <Text style={styles.label}>Homeowner Access</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={() => void handleLogin()} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.replace("Setup")}>
          <Text style={styles.setupLink}>Change backend URL</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}