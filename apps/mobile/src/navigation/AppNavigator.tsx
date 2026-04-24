import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import DashboardScreen from "../screens/DashboardScreen";
import RecordScreen from "../screens/RecordScreen";
import ProgressScreen from "../screens/ProgressScreen";
import ReviewScreen from "../screens/ReviewScreen";
import ProfileScreen from "../screens/ProfileScreen";

// ── Param lists ──────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  Record: undefined;
  Progress: { sessionId: string };
  Review: { sessionId: string; profileId: string };
  Profile: { profileId: string };
};

// ── Stacks ───────────────────────────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "My Sessions" }}
      />
      <AppStack.Screen
        name="Record"
        component={RecordScreen}
        options={{ title: "Record Video CV" }}
      />
      <AppStack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: "Processing…" }}
      />
      <AppStack.Screen
        name="Review"
        component={ReviewScreen}
        options={{ title: "Review CV" }}
      />
      <AppStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
    </AppStack.Navigator>
  );
}

// ── Root navigator with auth guard ───────────────────────────────────────────

export default function AppNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
