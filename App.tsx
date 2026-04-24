import {
  Platform,
  View,
  Text,
  LogBox,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

LogBox.ignoreLogs(["The action 'GO_BACK' was not handled"]);
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";
import * as Notifications from "expo-notifications";
import {
  Activity,
  Home,
  ScanFace,
  Settings,
  Shield,
  Video,
} from "lucide-react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
import { getSessionAccess } from "./src/lib/access";
import { referenceColors } from "./src/theme/reference";
import { getFloatingTabBarMetrics } from "./src/theme/layout";

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
  Users: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Events: undefined;
  Live: undefined;
  Faces: undefined;
  Settings: undefined;
  // SharedUsers removed — Users management is now accessed from Settings
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function NoAccessScreen() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No shared access yet</Text>
      <Text style={styles.emptyStateText}>
        Ask the primary user to enable permissions for this device. The app will
        only show pages you are allowed to use.
      </Text>
    </View>
  );
}

function MainTabs() {
  const { session } = useAuth();
  const access = getSessionAccess(session);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBar = getFloatingTabBarMetrics(insets, width);
  const showLabels = !tabBar.compact;
  const initialRouteName: keyof MainTabParamList = access.canOpenHome
    ? "Home"
    : access.canOpenEvents
      ? "Events"
      : access.canOpenLive
        ? "Live"
        : access.canOpenFaces
          ? "Faces"
          : access.canOpenSettings
            ? "Settings"
            : "Home";

  const renderTabIcon =
    (Icon: typeof Home) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <View
        style={[
          styles.tabIcon,
          tabBar.compact && styles.tabIconCompact,
          focused && styles.tabIconActive,
        ]}
      >
        <Icon size={showLabels ? 18 : 20} color={color} strokeWidth={2.2} />
      </View>
    );

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: tabBar.side,
          right: tabBar.side,
          bottom: tabBar.bottom,
          height: tabBar.height,
          paddingTop: showLabels ? 10 : 8,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: "rgba(255,255,255,0.82)",
          borderTopWidth: 0,
          borderRadius: tabBar.compact ? 22 : 26,
          borderWidth: 1,
          borderColor: "rgba(226,232,240,0.7)",
          elevation: 10,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 2,
        },
        tabBarActiveTintColor: referenceColors.primary,
        tabBarInactiveTintColor: referenceColors.textMuted,
        tabBarLabelStyle: { fontSize: 10, marginTop: 2, fontWeight: "600" },
        tabBarShowLabel: showLabels,
      }}
    >
      {access.hasAnyMainAccess ? (
        <>
          {access.canOpenHome ? (
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{ tabBarLabel: "Home", tabBarIcon: renderTabIcon(Home) }}
            />
          ) : null}
          {access.canOpenEvents ? (
            <Tab.Screen
              name="Events"
              component={LogsScreen}
              options={{
                tabBarLabel: "Events",
                tabBarIcon: renderTabIcon(Activity),
              }}
            />
          ) : null}
          {access.canOpenLive ? (
            <Tab.Screen
              name="Live"
              component={LiveFeedScreen}
              options={{
                tabBarLabel: "Live",
                tabBarIcon: renderTabIcon(Video),
              }}
            />
          ) : null}
          {access.canOpenFaces ? (
            <Tab.Screen
              name="Faces"
              component={FacialRegistrationScreen}
              options={{
                tabBarLabel: "Faces",
                tabBarIcon: renderTabIcon(ScanFace),
              }}
            />
          ) : null}
          {access.canOpenSettings ? (
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarLabel: "Settings",
                tabBarIcon: renderTabIcon(Settings),
              }}
            />
          ) : null}
        </>
      ) : (
        <Tab.Screen
          name="Home"
          component={NoAccessScreen}
          options={{ tabBarLabel: "Access", tabBarIcon: renderTabIcon(Shield) }}
        />
      )}
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { session, bootstrapping, hasPi } = useAuth();
  const access = getSessionAccess(session);
  const sessionKey = [
    String(hasPi),
    String(!!session),
    session?.role ?? "guest",
    JSON.stringify(session?.permissions ?? null),
  ].join(":");

  useEffect(() => {
    if (Platform.OS === "android") {
      void NavigationBar.setVisibilityAsync("hidden");
      void NavigationBar.setBehaviorAsync("overlay-swipe");
      void NavigationBar.setBackgroundColorAsync("#f8fafc");
    }

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
      <View
        style={{
          flex: 1,
          backgroundColor: referenceColors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: referenceColors.primary,
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          I.R.I.S
        </Text>
        <Text style={{ color: referenceColors.textMuted, marginTop: 8 }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={sessionKey}>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={session ? "DeviceList" : "Login"}
      >
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="DeviceList" component={DeviceListScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ animation: "slide_from_right" }}
            />
            {access.canOpenEvents ? (
              <Stack.Screen name="Logs" component={LogsScreen} />
            ) : null}
            {access.canOpenEvents ? (
              <Stack.Screen
                name="EventDetails"
                component={EventDetailsScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canOpenFaces ? (
              <Stack.Screen
                name="FacialRegistration"
                component={FacialRegistrationScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canAddDevice ? (
              <Stack.Screen
                name="AddCamera"
                component={AddCameraScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canOpenLive ? (
              <Stack.Screen
                name="LiveFeed"
                component={LiveFeedScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canAddDevice ? (
              <Stack.Screen
                name="Setup"
                component={SetupScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canOpenAdmin ? (
              <Stack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
            {access.canOpenSharedUsers ? (
              <Stack.Screen
                name="Users"
                component={TrustedFacesScreen}
                options={{ animation: "slide_from_right" }}
              />
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 34,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconActive: {
    backgroundColor: "rgba(219,234,254,0.82)",
  },
  tabIconCompact: {
    width: 38,
    height: 36,
    borderRadius: 12,
  },
  emptyState: {
    flex: 1,
    backgroundColor: referenceColors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: referenceColors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyStateText: {
    color: referenceColors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },
});
