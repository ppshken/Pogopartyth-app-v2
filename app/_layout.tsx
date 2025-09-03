import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { api } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnackHost } from "../components/Snackbar";
import { View } from "react-native";
import { Platform } from "react-native";

export default function Layout() {
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    })();
  }, []);

  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <StatusBar style="dark" translucent />
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackTitle: "กลับ",
            headerTitleStyle: { fontSize: 18, fontWeight: "800" },
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)/register"
            options={{ title: "สมัครสมาชิก", headerShown: true }}
          />
          <Stack.Screen
            name="index"
            options={{ title: "ห้องบอส", headerShown: true }}
          />
          <Stack.Screen
            name="rooms/[id]"
            options={{ title: "ห้องบอส", headerShown: true }}
          />
          <Stack.Screen
            name="rooms/[id]/chat"
            options={{ title: "แชท", headerShown: true }}
          />
          <Stack.Screen
            name="settings/profile-edit"
            options={{ title: "แก้ไขโปรไฟล์", headerShown: true }}
          />
        </Stack>
        <SnackHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
