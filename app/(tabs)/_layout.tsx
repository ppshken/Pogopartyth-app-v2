import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        // ใช้ฟอนต์หนาจริง แทน fontWeight
        headerTitleStyle: { fontSize: 20, marginBottom: 8, fontFamily: "KanitMedium" },
        tabBarActiveTintColor: "#000000ff",
        tabBarInactiveTintColor: "#6b7280ff",
        tabBarStyle: { paddingBottom: 8, height: 85 },
        tabBarLabelStyle: {
          fontSize: 13,
          fontFamily: "KanitSemiBold",
          marginBottom: 4,
        },
        tabBarItemStyle: { marginTop: 6 },
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, string> = {
            room_raid: focused ? "paw" : "paw-outline",
            create: focused ? "chatbubbles" : "chatbubbles-outline",
            my_raid: focused ? "invert-mode" : "invert-mode-outline",
            profile: focused ? "person" : "person-outline",
            friends: focused ? "people" : "people-outline",
          };
          return <Ionicons name={map[route.name] as any} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="room_raid" options={{ title: "ห้องบอส" }} />
      <Tabs.Screen name="create" options={{ title: "สร้างห้อง" }} />
      <Tabs.Screen name="my_raid" options={{ title: "ห้องของฉัน" }} />
      <Tabs.Screen name="friends" options={{ title: "หาเพื่อน" }} />
      <Tabs.Screen name="profile" options={{ title: "โปรไฟล์" }} />
    </Tabs>
  );
}
