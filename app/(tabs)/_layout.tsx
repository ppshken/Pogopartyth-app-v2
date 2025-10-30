import { Tabs, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { GetPendingFriends } from "../../lib/friend";


export default function TabsLayout() {
  const [badge, setBadge] = useState<number | null>(null);

  // ---- ดึงจำนวนคำขอเพื่อนค้าง ----
  const fetchPendingFriendCount = useCallback(async () => {
    try {
      const res = await GetPendingFriends({ page: 1, limit: 1 });
      const total =(Array.isArray(res?.list) ? res.list.length : 0); // นับจำนวน แบบ list
      console.log('count',total);

      setBadge(total);
    } catch (e) {
      // เงียบไว้ ไม่ให้รบกวน UX
      // console.log("GetPendingFriends error:", e);
    }
  }, []);

  // โฟกัสหน้านี้เมื่อไหร่ รีเฟรช
  useFocusEffect(
    useCallback(() => {
      fetchPendingFriendCount();
    }, [fetchPendingFriendCount])
  );

  // กลับ foreground แล้วรีเฟรช
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") fetchPendingFriendCount();
    });
    return () => sub.remove();
  }, [fetchPendingFriendCount]);

  // โพลทุก 60 วิ (เบาๆ)
  useEffect(() => {
    const t = setInterval(fetchPendingFriendCount, 60_000);
    return () => clearInterval(t);
  }, [fetchPendingFriendCount]);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleStyle: { fontSize: 20, marginBottom: 8, fontFamily: "KanitSemiBold" },
        tabBarActiveTintColor: "#000000ff",
        tabBarInactiveTintColor: "#6b7280ff",
        tabBarStyle: { paddingBottom: 8, height: 85 },
        tabBarLabelStyle: { fontSize: 13, fontFamily: "KanitSemiBold" },
        tabBarItemStyle: { marginTop: 6 },

        // ✅ ตั้ง badge ต่อแท็บแบบไดนามิก (แสดง 99+ ถ้าเยอะ)
        tabBarBadgeStyle: {
          backgroundColor: "#ef4444",
          minWidth: 18,
          height: 18,
          lineHeight: 18,
          paddingHorizontal: 4,
          textAlign: "center",
          fontFamily: "KanitSemiBold",
        },

        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, any> = {
            room_raid: focused ? "paw" : "paw-outline",
            create: focused ? "chatbubbles" : "chatbubbles-outline",
            my_raid: focused ? "invert-mode" : "invert-mode-outline",
            friends: focused ? "people" : "people-outline",
            profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
        animation: "none",
      })}
    >
      <Tabs.Screen name="room_raid" options={{ title: "ห้องบอส" }} />
      <Tabs.Screen name="create" options={{ title: "สร้างห้อง" }} />
      <Tabs.Screen name="my_raid" options={{ title: "ห้องของฉัน" }} />
      <Tabs.Screen
        name="friends"
        options={{
          title: "หาเพื่อน",
          tabBarBadge:
            // convert null to undefined and display "99+" when count is large
            badge !== null && badge > 0 ? (badge > 99 ? "99+" : badge) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "โปรไฟล์" }} />
    </Tabs>
  );
}
