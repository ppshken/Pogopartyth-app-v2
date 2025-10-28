import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { api } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnackHost } from "../components/Snackbar";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useFonts } from "expo-font";

export default function Layout() {
  const [fontsLoaded] = useFonts({
    KanitRegular: require("../assets/fonts/Kanit-Regular.ttf"), // ฟอนต์ปกติ
    KanitMedium: require("../assets/fonts/Kanit-Medium.ttf"), // ฟอนต์น้ำหนักกลาง
    KanitSemiBold: require("../assets/fonts/Kanit-SemiBold.ttf"), // ฟอนต์หนากว่า
    KanitBold: require("../assets/fonts/Kanit-Bold.ttf"), // ฟอนต์หนาสุด
  });

  useEffect(() => {
    if (!fontsLoaded) return;
  }, [fontsLoaded]);

  // ตั้งค่า header Authorization จาก token ที่เคยเก็บไว้
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
    })();
  }, []);

  // ✅ รองรับกรณีผู้ใช้ "แตะ" การแจ้งเตือน (ตอนแอป foreground/background)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as {
        url?: string;
      };
      navigateByUrl(data?.url);
    });
    return () => sub.remove();
  }, []);

  // ✅ รองรับกรณี "เปิดแอปจากปิดสนิท" ด้วยการแตะแจ้งเตือน (initial response)
  useEffect(() => {
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      const data = last?.notification.request.content.data as
        | { url?: string }
        | undefined;
      if (data?.url) {
        // หน่วงสั้นๆ ให้ navigation พร้อม (บางครั้งแอปยังบูตไม่ครบ)
        setTimeout(() => navigateByUrl(data.url), 0);
      }
    })();
  }, []);

  // ✅ ฟังก์ชันช่วย: รับ url แล้วนำทางให้รองรับทั้งลิงก์เต็ม (pogopartyth://...) และพาธภายใน (/rooms/123)
  const navigateByUrl = (url?: string) => {
    if (!url) return;
    try {
      // ถ้าเป็นดีปลิงก์เต็ม ให้ตัด schema ออกให้เหลือ path เพื่อความชัวร์
      // ตัวอย่าง: pogopartyth://rooms/123 -> /rooms/123
      const u = new URL(url);
      const path = `/${u.host}${u.pathname}`; // host จะกลายเป็น 'rooms', pathname เป็น '/123'
      router.push(path);
    } catch {
      // กรณีส่งมาเป็น path ตรงๆ เช่น "/rooms/123"
      router.push(url);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackTitle: "กลับ",
            headerBackTitleStyle: { fontSize: 16, fontFamily: "KanitSemiBold" },
            headerTitleStyle: { fontSize: 16, fontFamily: "KanitSemiBold" },
            animation: "ios_from_right",
          }}
        >
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)/register"
            options={{ title: "สมัครสมาชิก", headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/email_verify_otp"
            options={{
              title: "ลืมรหัสผ่าน",
              headerShown: false,
              headerBackVisible: false,
            }}
          />
          <Stack.Screen
            name="(auth)/forget_password"
            options={{ title: "ลืมรหัสผ่าน", headerShown: true }}
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
          <Stack.Screen
            name="settings/profile-setup"
            options={{ title: "ตั้งค่าโปรไฟล์", headerShown: true }}
          />
          <Stack.Screen
            name="settings/setting-app"
            options={{ title: "ตั้งค่าแอป", headerShown: true }}
          />
          <Stack.Screen
            name="friends/[id]"
            options={{ title: "โปรไฟล์เพื่อน", headerShown: true }}
          />
          <Stack.Screen
            name="friends/[id]/chat"
            options={{ title: "แชท", headerShown: true }}
          />
        </Stack>
        <SnackHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
