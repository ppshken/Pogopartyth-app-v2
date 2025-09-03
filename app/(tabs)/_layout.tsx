import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: true,
      headerTitleStyle: { fontSize: 20, fontWeight: "800", marginBottom: 8}, 
      tabBarActiveTintColor: "#000000ff",
      tabBarInactiveTintColor: "#6b7280ff",
      tabBarStyle: { paddingBottom: 8, height: 85},
      tabBarLabelStyle: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
      tabBarItemStyle: { marginTop: 6 },
      }}>
      <Tabs.Screen
        name="room_raid"
        options={{
          title: "ห้องบอส",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="paw-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "สร้างห้อง",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my_raid"
        options={{
          title: "ห้องของฉัน",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="invert-mode-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "โปรไฟล์",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
