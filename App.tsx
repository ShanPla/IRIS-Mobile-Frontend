import { View, Text, LogBox, StyleSheet, TouchableOpacity } from "react-native";

LogBox.ignoreLogs(["The action 'GO_BACK' was not handled"]);
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";
import * as Notifications from "expo-notifications";

import SetupScreen from "./src/screens/SetupScreen/SetupScreen";
import LoginScreen from "./src/screens/LoginScreen/LoginScreen";
import DeviceListScreen from "./src/screens/DeviceListScreen/DeviceListScreen";
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
  DeviceList: undefined;
  Main: undefined;
  Logs: undefined;
  EventDetails: { event: import("./src/types/iris").SecurityEvent };
  FacialRegistration: undefined;
  AddCamera: undefined;
  LiveFeed: undefined;
  Profile: undefined;
  Admin: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Events: undefined;
  Live: undefined;
  Faces: undefined;
  Settings: undefined;
  SharedUsers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const renderTabIcon = (label: string) => ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, { color }]}>{label}</Text>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity style={styles.headerPill} onPress={() => rootNavigation.navigate("DeviceList")}>
            <Text style={styles.headerPillText}>{"< Devices"}</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity style={styles.headerPill} onPress={() => rootNavigation.navigate("Profile")}>
            <Text style={styles.headerPillText}>Profile</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 16,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: "rgba(255,255,255,0.94)",
          borderTopWidth: 0,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#dbe3ef",
          elevation: 12,
          shadowColor: "#2563eb",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
        },
        tabBarItemStyle: {
          borderRadius: 18,
        },
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: { fontSize: 11, marginTop: 2, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: "Home", tabBarIcon: renderTabIcon("H") }}
      />
      <Tab.Screen
        name="Events"
        component={LogsScreen}
        options={{ tabBarLabel: "Events", tabBarIcon: renderTabIcon("E") }}
      />
      <Tab.Screen
        name="Live"
        component={LiveFeedScreen}
        options={{ tabBarLabel: "Live", tabBarIcon: renderTabIcon("L") }}
      />
      <Tab.Screen
        name="Faces"
        component={FacialRegistrationScreen}
        options={{ tabBarLabel: "Faces", tabBarIcon: renderTabIcon("F") }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: "Settings", tabBarIcon: renderTabIcon("S") }}
      />
      <Tab.Screen
        name="SharedUsers"
        component={TrustedFacesScreen}
        options={{ tabBarLabel: "Shared", tabBarIcon: renderTabIcon("U") }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, bootstrapping, hasPi } = useAuth();

  useEffect(() => {
    void NavigationBar.setVisibilityAsync("hidden");
    void NavigationBar.setBehaviorAsync("overlay-swipe");
    void NavigationBar.setBackgroundColorAsync("#f8fafc");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);
  
  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#2563eb", fontSize: 22, fontWeight: "800" }}>SecureWatch</Text>
        <Text style={{ color: "#64748b", marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={`${String(hasPi)}-${String(!!session)}`}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Setup" component={SetupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="DeviceList" component={DeviceListScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Logs" component={LogsScreen} />
            <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="FacialRegistration" component={FacialRegistrationScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="AddCamera" component={AddCameraScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="LiveFeed" component={LiveFeedScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Setup" component={SetupScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ animation: "slide_from_right" }} />
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

const styles = StyleSheet.create({
  tabIcon: {
    width: 28,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: {
    backgroundColor: "#dbeafe",
  },
  tabIconText: {
    fontSize: 11,
    fontWeight: "800",
  },
  headerPill: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerPillText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
  },
});
