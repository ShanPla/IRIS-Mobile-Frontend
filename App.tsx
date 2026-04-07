import { View, Text, LogBox } from "react-native";

LogBox.ignoreLogs(["The action 'GO_BACK' was not handled"]);
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";

import SetupScreen from "./src/screens/SetupScreen/SetupScreen";
import LoginScreen from "./src/screens/LoginScreen/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen/HomeScreen";
import LogsScreen from "./src/screens/LogsScreen/LogsScreen";
import EventDetailsScreen from "./src/screens/EventDetailsScreen/EventDetailsScreen";
import TrustedFacesScreen from "./src/screens/TrustedFacesScreen/TrustedFacesScreen";
import FacialRegistrationScreen from "./src/screens/FacialRegistrationScreen/FacialRegistrationScreen";
import SettingsScreen from "./src/screens/SettingsScreen/SettingsScreen";
import ProfileScreen from "./src/screens/ProfileScreen/ProfileScreen";
import AddCameraScreen from "./src/screens/AddCameraScreen/AddCameraScreen";
import LiveFeedScreen from "./src/screens/LiveFeedScreen/LiveFeedScreen";
import AdminScreen from "./src/screens/AdminScreen/AdminScreen";

export type RootStackParamList = {
  Setup: undefined;
  Login: undefined;
  Main: undefined;
  Logs: undefined;
  EventDetails: { event: import("./src/types/iris").SecurityEvent };
  FacialRegistration: undefined;
  AddCamera: undefined;
  LiveFeed: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  TrustedFaces: undefined;
  Settings: undefined;
  Profile: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1f2937",
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: "#22d3ee",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Home", tabBarIcon: () => <Text style={{ fontSize: 18 }}>🏠</Text> }}
      />
      <Tab.Screen
        name="TrustedFaces"
        component={TrustedFacesScreen}
        options={{ tabBarLabel: "Trusted", tabBarIcon: () => <Text style={{ fontSize: 18 }}>👥</Text> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: "Settings", tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚙️</Text> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile", tabBarIcon: () => <Text style={{ fontSize: 18 }}>👤</Text> }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminScreen}
          options={{ tabBarLabel: "Admin", tabBarIcon: () => <Text style={{ fontSize: 18 }}>🛡️</Text> }}
        />
      )}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, bootstrapping, hasPi } = useAuth();

  useEffect(() => {
    void NavigationBar.setVisibilityAsync("hidden");
    void NavigationBar.setBehaviorAsync("overlay-swipe");
    void NavigationBar.setBackgroundColorAsync("#111827");
  }, []);
  
  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: "#030712", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#22d3ee", fontSize: 22, fontWeight: "800", letterSpacing: 4 }}>IRIS</Text>
        <Text style={{ color: "#6b7280", marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={`${String(hasPi)}-${String(!!session)}`}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasPi ? (
          <Stack.Screen name="Setup" component={SetupScreen} />
        ) : !session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Setup" component={SetupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Logs" component={LogsScreen} />
            <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="FacialRegistration" component={FacialRegistrationScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="AddCamera" component={AddCameraScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="LiveFeed" component={LiveFeedScreen} options={{ animation: "slide_from_right" }} />
          </>
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
