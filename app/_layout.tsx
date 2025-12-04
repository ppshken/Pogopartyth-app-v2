// app/_layout.tsx
import { Stack, SplashScreen, router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { api } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnackHost } from "../components/Snackbar";
import * as Notifications from "expo-notifications";
import * as Font from "expo-font";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import Constants from "expo-constants"; // ✅ เพิ่ม: สำหรับดึง Version ของ App

import { Events, getEvents } from "@/lib/events";
import { systemConfig } from "@/lib/system_config";
import MaintenanceComponent from "../components/Maintenance";
import { userLog } from "@/lib/auth";

// ✅ เพิ่ม: Import หน้า ForceUpdate (ตรวจสอบ Path ให้ถูกต้องตามที่คุณสร้างไฟล์ไว้)
import ForceUpdate from "../components/ForceUpdate";

// ✅ ป้องกัน Splash Screen หายไปเอง จนกว่าเราจะสั่ง
SplashScreen.preventAutoHideAsync();

// ✅ Helper Function: เปรียบเทียบ Version (Return true ถ้าต้องอัปเดต)
const isVersionOutdated = (currentGen: string, minGen: string) => {
  if (!minGen) return false;

  const v1 = currentGen.split(".").map(Number);
  const v2 = minGen.split(".").map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 < num2) return true; // ต้องอัปเดต (current น้อยกว่า min)
    if (num1 > num2) return false; // เวอร์ชั่นใหม่กว่า ไม่ต้องอัปเดต
  }
  return false; // เท่ากัน หรือ ใหม่กว่า
};

export default function Layout() {
  const [appIsReady, setAppIsReady] = useState(false); // พร้อม render Stack หรือยัง
  const [isMaintenance, setIsMaintenance] = useState(false); // ติดสถานะปิดปรับปรุงหรือไม่
  const [maintenanceMsg, setMaintenanceMsg] = useState(""); // ข้อความปิดปรับปรุง

  // ✅ เพิ่ม: State สำหรับ Force Update
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [ios_url, setIos_url] = useState("");
  const [android_url, setAndroid_url] = useState("");

  const [isRetrying, setIsRetrying] = useState(false); // state สำหรับ loading ตอนกดปุ่ม retry
  const [onEvent, setOnEvent] = useState(false); // เปิด modal แจ้งเตือนอีเวนท์ใหม่
  const [eventData, setEventData] = useState<Events>();

  // ----------------------------------------------------------------------
  // 1. ฟังก์ชันหลักสำหรับเช็คระบบ (ใช้ทั้งตอนเริ่มแอพ และตอนกด Retry)
  // ----------------------------------------------------------------------
  const checkSystemAndAuth = async () => {
    try {
      // 1. โหลด Config ระบบ
      const system = await systemConfig();

      // --------------------------
      // A. กรณี: ปิดปรับปรุง (Maintenance)
      // --------------------------
      if (system.maintenance.is_active) {
        setMaintenanceMsg(system.maintenance.message);
        setIsMaintenance(true);
        // ถึงจะติด Maintenance ก็ต้องถือว่า App Ready (เพื่อซ่อน Splash Screen และโชว์หน้า Maintenance)
        setAppIsReady(true);
        return; // จบการทำงานตรงนี้ ไม่ไปต่อ
      }

      // กรณี: ปกติ (หรือหายปิดปรับปรุงแล้ว)
      setIsMaintenance(false);

      // --------------------------
      // B. กรณี: เช็ค Version (Force Update) ✅
      // --------------------------
      const currentVersion = Constants.expoConfig?.version ?? "1.0.0";
      let minVersion = "0.0.0";

      // แยกเช็คตาม Platform (เผื่อ Android/iOS ปล่อยไม่พร้อมกัน)
      if (Platform.OS === "ios") {
        minVersion = system.version_check.ios.min_version || "0.0.0";
      } else {
        minVersion = system.version_check.android.min_version || "0.0.0";
      }

      // ถ้าเวอร์ชันปัจจุบัน เก่ากว่า ขั้นต่ำ -> บังคับอัปเดต
      if (isVersionOutdated(currentVersion, minVersion)) {
        setIsForceUpdate(true);
        setIos_url(system.version_check.ios.store_url);
        setAndroid_url(system.version_check.android.store_url);
        setAppIsReady(true);
        return; // จบการทำงานตรงนี้ ไม่ไปเช็ค Auth ต่อ
      }
      setIsForceUpdate(false);

      // --------------------------
      // C. เช็ค Auth Token & Load Data (Logic เดิมของคุณ)
      // --------------------------
      const token = await AsyncStorage.getItem("token");
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        const user = await AsyncStorage.getItem("user");
        if (user) {
          const parsedUser = JSON.parse(user);
          const payload = {
            type: "online_lasted",
            target: parsedUser.id,
            description: "ออนไลน์ล่าสุด",
          };
          await userLog(payload);
        }
        const events = await getEvents();
        if (events) {
          setEventData(events);
          setOnEvent(true);
        }
      } else {
        // ถ้าไม่มี Token ให้เตรียมดีดไป Login (หลังจาก Render เสร็จ)
        setTimeout(() => router.replace("/(auth)/login"), 100);
      }

      setAppIsReady(true);
    } catch (e) {
      console.warn("System Check Error:", e);
      // กรณี Error อาจจะให้เข้าแอพไปก่อน หรือโชว์ Error แล้วแต่ Policy
      setAppIsReady(true);
    }
  };

  // ----------------------------------------------------------------------
  // 2. useEffect เริ่มต้น (Load Fonts -> Check System)
  // ----------------------------------------------------------------------
  useEffect(() => {
    async function prepare() {
      try {
        // โหลดฟอนต์แค่ครั้งเดียว
        await Font.loadAsync({
          KanitRegular: require("../assets/fonts/Kanit-Regular.ttf"),
          KanitMedium: require("../assets/fonts/Kanit-Medium.ttf"),
          KanitSemiBold: require("../assets/fonts/Kanit-SemiBold.ttf"),
          KanitBold: require("../assets/fonts/Kanit-Bold.ttf"),
        });

        // เริ่มเช็คระบบ
        await checkSystemAndAuth();
      } catch (e) {
        console.warn(e);
      }
    }

    prepare();
  }, []);

  // ----------------------------------------------------------------------
  // 3. ฟังก์ชันสำหรับปุ่ม Retry (ส่งให้ Maintenance Component)
  // ----------------------------------------------------------------------
  const handleRetry = async () => {
    setIsRetrying(true);
    await checkSystemAndAuth(); // เช็คใหม่
    setIsRetrying(false);
  };

  // ----------------------------------------------------------------------
  // 4. สั่งปิด Splash Screen เมื่อ UI พร้อมแสดงผล
  // ----------------------------------------------------------------------
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // ----------------------------------------------------------------------
  // 5. Notification Logic
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // 6. Render Logic
  // ----------------------------------------------------------------------

  // ถ้ายังโหลดไม่เสร็จ (appIsReady = false) ให้คืนค่า null หรือ View ว่างๆ
  // Splash Screen ของ Native จะบังไว้อยู่แล้ว
  if (!appIsReady) {
    return null;
  }

  // ✅ กรณี: ต้อง Force Update (แสดงหน้านี้ก่อน Maintenance)
  if (isForceUpdate) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ForceUpdate
          version={Constants.expoConfig?.version}
          ios_url={ios_url}
          android_url={android_url}
        />
      </View>
    );
  }

  // กรณี: ติด Maintenance Mode
  if (isMaintenance) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        {/* ส่ง props ไปให้ component ที่เราสร้างไว้ */}
        <MaintenanceComponent message={maintenanceMsg} onRetry={handleRetry} />

        {/* Loading Indicator ทับหน้าจอตอนกด Retry */}
        {isRetrying && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0047AB" />
          </View>
        )}
      </View>
    );
  }

  // กรณี: ปกติ เข้าแอพได้
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
          {/* --- Screens ทั้งหมดของคุณ --- */}
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

          <Stack.Screen
            name="rooms/[id]"
            options={{ title: "ห้องบอส", headerShown: true }}
          />
          <Stack.Screen
            name="rooms/[id]/chat"
            options={{ title: "แชท", headerShown: true }}
          />

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
            name="calendar/calendar"
            options={{ title: "ปฏิทินกิจกรรม", headerShown: true }}
          />

          <Stack.Screen
            name="calendar/research"
            options={{ title: "วิจัยภาคสนาม", headerShown: true }}
          />

          <Stack.Screen
            name="calendar/eggs"
            options={{ title: "ฟักไข่", headerShown: true }}
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

        {/* Event Modal */}
        <Modal visible={onEvent} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{eventData?.title}</Text>
              <Image
                source={{ uri: eventData?.image }}
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

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, // คลุมทั้งหน้าจอ
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    alignSelf: "flex-end",
  },
  closeBtnText: {
    fontFamily: "KanitSemiBold",
    color: "#111827",
  },
});
