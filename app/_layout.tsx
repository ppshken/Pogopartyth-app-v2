import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { api } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnackHost } from "../components/Snackbar";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useFonts } from "expo-font";
import { Modal, View, Text, Image, TouchableOpacity } from "react-native";

export default function Layout() {
  const [onupdate, setOnupdate] = useState(false); // เปิด - ปิด Update
  const [onEvent, setOnEvent] = useState(false);

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
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        setOnEvent(true);
      } else {
        router.replace("/(auth)/login");
        //router.replace("/(auth)/reset_password");
      }
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
            name="package/premium_plan"
            options={{
              title: "Premium",
              headerShown: true,
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
        <SnackHost />

        {/* แจ้งอัพเดทเวอร์ชั่นใหม่ */}
        <Modal
          visible={onupdate}
          transparent
          animationType="fade"
          onRequestClose={() => setOnupdate(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
              padding: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: 16,
                padding: 20,
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontFamily: "KanitSemiBold",
                  fontSize: 20,
                  marginBottom: 6,
                }}
              >
                มีอัปเดตใหม่พร้อมใช้งาน
              </Text>

              <View
                style={{
                  borderRadius: 12,
                  marginBottom: 14,
                  paddingBottom: 6,
                }}
              >
                <Text style={{ color: "#111827", fontFamily: "KanitRegular" }}>
                  กรุณาอัปเดตแอปเป็นเวอร์ชันล่าสุด (1.0.1)
                  แอปเวอร์ชันใหม่มีการปรับปรุงความ ปลอดภัย เพิ่มฟีเจอร์ใหม่
                  และแก้ไขข้อ เพื่อให้คุณได้รับ ประสบการณ์ที่ดีที่สุดในการใช้งาน
                  หาก ไม่ได้อัปเดต คุณอาจไม่สามารถใช้งาน ฟีเจอร์บางอย่างได้
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <TouchableOpacity
                  onPress={() => setOnupdate(false)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{ fontFamily: "KanitSemiBold", color: "#111827" }}
                  >
                    ภายหลัง
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: "#111827",
                  }}
                >
                  <Text style={{ fontFamily: "KanitSemiBold", color: "#fff" }}>
                    อัปเดตตอนนี้
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* แจ้งอัพเดทอีเว้นท์ใหม่ */}
        <Modal
          visible={onEvent}
          transparent
          animationType="fade"
          onRequestClose={() => setOnupdate(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.35)",
              padding: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: 16,
                padding: 20,
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontFamily: "KanitSemiBold",
                  fontSize: 20,
                  marginBottom: 8,
                }}
              >
                Pokémon GO ไวลด์แอเรีย: ทั่วโลก
              </Text>

              <View style={{ marginBottom: 12 }}>
                <Image
                  source={{
                    uri: "https://lh3.googleusercontent.com/lbCY-RkrL1u02I9PhzJjdPAr3KOjL24bll2o7E__LLIOVPUY5VGeltdenmRmn37WEjKZy2IcOk8SnA--hspmRJQlIj-iflFhpg=e365-pa-nu-w2880",
                  }}
                  style={{
                    width: "auto",
                    height: 200,
                    borderRadius: 8,
                    backgroundColor: "#F3F4F6",
                    marginBottom: 8,
                  }}
                />
                <Text
                  style={{
                    fontFamily: "KanitSemiBold",
                    fontSize: 20,
                    marginBottom: 6,
                  }}
                >
                  15 และ 16 พฤศจิกายน 2025
                </Text>
                <Text
                  style={{
                    color: "#000000ff",
                    fontFamily: "KanitRegular",
                  }}
                >
                  เทรนเนอร์จากทั่วโลกสามารถเตรียมพร้อมสำหรับการผจญภัยทั่วโลกได้ระหว่าง
                  Pokémon GO ไวลด์แอเรีย: ทั่วโลก ซึ่งเปิดให้เล่นในเกมเป็นเวลา 2
                  วันเท่านั้น! กำลังมองหาวิธีเพิ่มความสนุกให้กับสุดสัปดาห์ GO
                  ไวลด์แอเรียของคุณอยู่ใช่ไหม?
                  ไม่ว่าจะเป็นงานวิจัยพิเศษสุดพิเศษ, โบนัสเพิ่มเติม
                  หรือโอกาสเพิ่มขึ้นที่จะได้เจอโปเกมอนสีแตกต่าง
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  justifyContent: "flex-end",
                }}
              >
                <TouchableOpacity
                  onPress={() => setOnEvent(false)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{ fontFamily: "KanitSemiBold", color: "#111827" }}
                  >
                    ปิด
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
