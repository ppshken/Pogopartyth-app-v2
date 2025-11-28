import { Stack, SplashScreen } from "expo-router"; // ✅ เพิ่ม SplashScreen
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { api } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnackHost } from "../components/Snackbar";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as Font from "expo-font"; // ✅ ใช้ loadAsync แบบ manual เพื่อคุม flow ได้ดีกว่า
import { Events, getEvents } from "@/lib/events";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

// ✅ ป้องกัน Splash Screen หายไปเอง จนกว่าเราจะสั่ง
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [appIsReady, setAppIsReady] = useState(false); // เช็คความพร้อมของแอป
  const [onUpdate, setOnUpdate] = useState(false);
  const [onEvent, setOnEvent] = useState(false);
  const [eventData, setEventData] = useState<Events>();

  // ✅ 1. โหลดทุกอย่าง (Fonts + Auth) ก่อนเริ่มแอป
  useEffect(() => {
    async function prepare() {
      try {
        // 1.1 โหลดฟอนต์
        await Font.loadAsync({
          KanitRegular: require("../assets/fonts/Kanit-Regular.ttf"),
          KanitMedium: require("../assets/fonts/Kanit-Medium.ttf"),
          KanitSemiBold: require("../assets/fonts/Kanit-SemiBold.ttf"),
          KanitBold: require("../assets/fonts/Kanit-Bold.ttf"),
        });

        // 1.2 เช็ค Auth Token
        const token = await AsyncStorage.getItem("token");
        // const user = await AsyncStorage.getItem("user");

        if (token) {
          api.defaults.headers.common.Authorization = `Bearer ${token}`;

          // ดึง Events
          const events = await getEvents();

          if (events) {
            // ✅ เช็คว่ามีข้อมูลจริงค่อย set
            setEventData(events);
            setOnEvent(true);
          }
        } else {
          setTimeout(() => router.replace("/(auth)/login"), 100);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        // 1.3 บอกว่าแอปพร้อมแล้ว
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // ✅ 2. สั่งปิด Splash Screen เมื่อ Layout render ครั้งแรกหลัง appIsReady = true
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // ✅ 3. Notification Handlers (เหมือนเดิม)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as { url?: string };
      navigateByUrl(data?.url);
    });

    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      const data = last?.notification.request.content.data as
        | { url?: string }
        | undefined;
      if (data?.url) setTimeout(() => navigateByUrl(data.url), 500);
    })();

    return () => sub.remove();
  }, []);

  const navigateByUrl = (url?: string) => {
    if (!url) return;
    try {
      const u = new URL(url);
      const path = `/${u.host}${u.pathname}`;
      router.push(path);
    } catch {
      router.push(url);
    }
  };

  // ⚠️ ถ้าแอปยังไม่พร้อม (กำลังโหลดฟอนต์/token) ไม่ต้อง render Stack
  if (!appIsReady) {
    return null; // หรือใส่ <View style={{flex:1, backgroundColor:'white'}} />
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />

        {/* Stack Navigation */}
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
            options={{ title: "ยืนยัน OTP", headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/forget_password"
            options={{ title: "ลืมรหัสผ่าน", headerShown: true }}
          />
          <Stack.Screen
            name="(auth)/reset_password"
            options={{ title: "รหัสผ่านใหม่", headerShown: true }}
          />

          {/* App Screens */}
          <Stack.Screen
            name="rooms/[id]"
            options={{ title: "ห้องบอส", headerShown: true }}
          />
          <Stack.Screen
            name="rooms/[id]/chat"
            options={{ title: "แชท", headerShown: true }}
          />

          {/* Settings Group */}
          <Stack.Screen
            name="settings/profile"
            options={{ title: "โปรไฟล์", headerShown: true }}
          />
          <Stack.Screen
            name="settings/profile-edit"
            options={{ title: "แก้ไขโปรไฟล์", headerShown: true }}
          />
          <Stack.Screen
            name="settings/user-log"
            options={{ title: "ประวัติ", headerShown: true }}
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
            name="settings/feedback"
            options={{ title: "Feedback", headerShown: true }}
          />

          {/* Friend Group */}
          <Stack.Screen
            name="friends/[id]"
            options={{ title: "โปรไฟล์เพื่อน", headerShown: true }}
          />
          <Stack.Screen
            name="friends/request_friend"
            options={{ title: "แจ้งเตือน", headerShown: true }}
          />
          <Stack.Screen
            name="friends/chat"
            options={{ title: "แชท", headerShown: true }}
          />
          <Stack.Screen
            name="events/[id]"
            options={{ title: "รายละเอียดอีเวนท์", headerShown: true }}
          />

          <Stack.Screen
            name="package/premium_plan"
            options={{
              title: "Premium",
              headerShown: true,
              animation: "slide_from_bottom",
            }}
          />
        </Stack>

        <SnackHost />

        {/* Update Modal */}
        <Modal visible={onUpdate} transparent animationType="fade">
          {/* ... (Code Modal Update เหมือนเดิม) ... */}
          {/* เพื่อความกระชับ ผมละไว้ แต่คุณสามารถแปะโค้ดเดิมกลับมาได้เลยครับ */}
        </Modal>

        {/* Event Modal */}
        <Modal visible={onEvent} transparent animationType="fade">
          {/* ... (Code Modal Event เหมือนเดิม) ... */}
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{eventData?.title}</Text>
              <Image
                source={{ uri: eventData?.image }} // แนะนำให้ใช้รูปจริงหรือ local asset
                style={styles.eventImage}
              />
              <Text style={[styles.modalDesc, { color: "#5c5c5cff" }]}>
                {eventData?.created_at}
              </Text>
              <Text style={styles.modalDesc}>{eventData?.description}</Text>
              <TouchableOpacity
                onPress={() => {
                  router.push("events/events");
                  setOnEvent(false);
                }}
              >
                <Text
                  style={[
                    styles.modalDesc,
                    { color: "#2636ccff", fontFamily: "KanitSemiBold" },
                  ]}
                >
                  ดูอีเวนท์ทั้งหมด
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOnEvent(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>ปิด</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// เพิ่ม Stylesheet เพื่อความสะอาดของโค้ด
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontFamily: "KanitSemiBold",
    fontSize: 20,
    marginBottom: 8,
  },
  eventImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  modalDesc: {
    color: "#353535ff",
    fontFamily: "KanitMedium",
    marginBottom: 12,
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-end" as const,
  },
  closeBtnText: {
    fontFamily: "KanitSemiBold",
    color: "#111827",
  },
});
