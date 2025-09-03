import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleStyle: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
        tabBarActiveTintColor: "#000000ff",
        tabBarInactiveTintColor: "#6b7280ff",
        tabBarStyle: { paddingBottom: 8, height: 85 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
        tabBarItemStyle: { marginTop: 6 },
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, string> = {
            room_raid: focused ? "paw" : "paw-outline",
            create: focused ? "chatbubbles" : "chatbubbles-outline",
            my_raid: focused ? "albums" : "albums-outline",
            profile: focused ? "person" : "person-outline",
          };
          return (
            <Ionicons name={map[route.name] as any} size={size} color={color} />
          );
        },
      })}
    >
      <Tabs.Screen name="room_raid" options={{ title: "ห้องบอส" }} />
      <Tabs.Screen name="create" options={{ title: "สร้างห้อง" }} />
      <Tabs.Screen name="my_raid" options={{ title: "ห้องของฉัน" }} />
      <Tabs.Screen name="profile" options={{ title: "โปรไฟล์" }} />
    </Tabs>
  );
}
