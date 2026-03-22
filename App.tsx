import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { getStoredBackendUrl } from "./src/lib/api";

import SetupScreen from "./src/screens/SetupScreen/SetupScreen";
import LoginScreen from "./src/screens/LoginScreen/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen/HomeScreen";
import LogsScreen from "./src/screens/LogsScreen/LogsScreen";
import LiveFeedScreen from "./src/screens/LiveFeedScreen/LiveFeedScreen";
import ProfileScreen from "./src/screens/ProfileScreen/ProfileScreen";

export type RootStackParamList = {
  Setup: undefined;
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Logs: undefined;
  LiveFeed: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#111827", borderTopColor: "#1f2937" },
        tabBarActiveTintColor: "#22d3ee",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Home", tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsScreen}
        options={{ tabBarLabel: "Logs", tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tab.Screen
        name="LiveFeed"
        component={LiveFeedScreen}
        options={{ tabBarLabel: "Live Feed", tabBarIcon: () => <Text>📹</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile", tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, bootstrapping } = useAuth();
  const [hasBackend, setHasBackend] = useState<boolean | null>(null);

  useEffect(() => {
    void getStoredBackendUrl().then((url) => setHasBackend(!!url));
  }, [session]);

  const onSetupComplete = () => {
    void getStoredBackendUrl().then((url) => setHasBackend(!!url));
  };

  if (bootstrapping || hasBackend === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#22d3ee", fontSize: 22, fontWeight: "800", letterSpacing: 4 }}>IRIS</Text>
        <Text style={{ color: "#6b7280", marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasBackend ? (
          <Stack.Screen name="Setup">
            {(props) => <SetupScreen {...props} onSetupComplete={onSetupComplete} />}
          </Stack.Screen>
        ) : !session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Setup">
              {(props) => <SetupScreen {...props} onSetupComplete={onSetupComplete} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}