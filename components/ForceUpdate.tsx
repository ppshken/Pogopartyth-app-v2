// app/component/ForceUpdate.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  BackHandler,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // หรือใช้ library icon ที่คุณใช้อยู่

// กำหนด Type ของ Props ที่รับเข้ามา
type ForceUpdate = {
  version?: string; // ข้อความแจ้งเตือนจาก API
  android_url: string;
  ios_url: string;
};

export default function ForceUpdate({
  version,
  android_url,
  ios_url,
}: ForceUpdate) {
  // ป้องกันการกดปุ่ม Back ของ Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        return true; // บล็อกการกด Back
      }
    );
    return () => backHandler.remove();
  }, []);

  const handleUpdate = async () => {
    const url = Platform.OS === "ios" ? ios_url : android_url;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.error("Cannot open Store URL:", url);
      }
    } catch (error) {
      console.error("An error occurred", error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.contentContainer}>
        {/* Image / Icon Section */}
        <View style={styles.imageWrapper}>
          {/* คุณสามารถเปลี่ยนเป็นรูป Rocket หรือ รูป Logo แอพได้ */}
          <Ionicons name="arrow-undo-outline" size={80} color="#000000ff" />
        </View>

        {/* Text Section */}
        <View style={styles.textWrapper}>
          <Text style={styles.title}>มีอัปเดตแอพเวอร์ชั่นใหม่</Text>
          <Text style={styles.subtitle}>
            เราได้เพิ่มฟีเจอร์ใหม่และแก้ไขข้อผิดพลาดเพื่อประสบการณ์การตีบอสที่ดียิ่งขึ้น{" "}
            {"\n"}
            กรุณาอัปเดตแอปเป็นเวอร์ชันล่าสุด
          </Text>
        </View>

        {/* Button Section */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleUpdate}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>อัปเดตตอนนี้</Text>
        </TouchableOpacity>

        {/* Version Info (Optional) */}
        <Text style={styles.versionText}>Current Version: {version}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  imageWrapper: {
    marginBottom: 40,
    width: 150,
    height: 150,
    backgroundColor: "#e6e6e6ff", // สีพื้นหลังจางๆ ให้ดูมีมิติ
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    // Shadow for depth
    shadowColor: "#afafafff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  image: {
    width: 100,
    height: 100,
  },
  textWrapper: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: "KanitSemiBold",
    color: "#333333",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "KanitMedium",
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#000000ff", // สีหลักของแอพ (Theme Color)
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    // Button Shadow
    shadowColor: "#000000ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "KanitSemiBold",
  },
  versionText: {
    marginTop: 20,
    fontSize: 12,
    color: "#CCCCCC",
  },
});
