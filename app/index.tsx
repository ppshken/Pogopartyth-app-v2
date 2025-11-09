// app/index.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { getProfile } from "../lib/user";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null; // เก็บใน DB แบบไม่มีเว้นวรรค
  setup_status?: string;
  team?: string | null;
  level?: number | null;
  created_at?: string | null;
};

export default function Index() {
  const [ready, setReady] = useState(false);
  const [href, setHref] = useState("/(auth)/login");

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const u = (await getProfile()) as FullUser;
        const status = (u?.setup_status || "").toLowerCase();
        if (status === "no") {
          setHref("/settings/profile-setup");
        } else if (status === "yes") {
          setHref("/(tabs)/room_raid");
        } else {
          setHref("/(auth)/login");
        }
      } catch (error) {
        await AsyncStorage.removeItem("token"); // อาจจะลบ token เก่าออก
        setHref("/(auth)/login");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={href} />;
}
