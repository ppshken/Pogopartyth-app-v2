import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // ใช้ Icon มาตรฐานของ Expo
import { SafeAreaView } from "react-native-safe-area-context";

// กำหนด Type ของ Props ที่รับเข้ามา
type MaintenanceProps = {
  message?: string; // ข้อความแจ้งเตือนจาก API
  onRetry?: () => void; // ฟังก์ชันสำหรับปุ่ม "ลองใหม่"
};

export default function MaintenanceComponent({
  message,
  onRetry,
}: MaintenanceProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 1. Icon หรือ รูปภาพ (ใช้ Icon แนว Construction) */}
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={80} color="#0047AB" />
          {/* หรือถ้าอยากใช้รูปภาพ ให้ comment บรรทัดบน แล้วเปิดบรรทัดล่างแทน */}
        </View>

        {/* 2. หัวข้อหลัก */}
        <Text style={styles.title}>ระบบปิดปรับปรุงชั่วคราว</Text>

        {/* 3. ข้อความแจ้งเตือน (รับมาจากหลังบ้าน) */}
        <Text style={styles.message}>
          {message ||
            "ทีมงานกำลังพัฒนาระบบให้ดียิ่งขึ้น\nกรุณากลับมาใหม่ในภายหลังครับ"}
        </Text>

        {/* 4. ปุ่ม Refresh (เผื่อเปิดระบบแล้ว User จะได้กดเข้าได้เลย) */}
        {onRetry && (
          <TouchableOpacity
            style={styles.button}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Ionicons
              name="refresh"
              size={20}
              color="#FFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>ลองใหม่อีกครั้ง</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer เล็กๆ (Optional) */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>PogopartyTH Team</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // พื้นขาว
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    marginTop: -40, // ขยับขึ้นนิดหน่อยให้ดู balance
  },
  iconContainer: {
    marginBottom: 24,
    width: 120,
    height: 120,
    backgroundColor: "#F0F5FF", // สีฟ้าอ่อนมากๆ รองพื้น Icon
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: "KanitSemiBold",
    color: "#0047AB", // สีน้ำเงินหลัก
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666666", // สีเทาอ่านง่าย
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
    fontFamily: "KanitMedium",
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#0047AB",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12, // ปุ่มมน
    alignItems: "center",
    elevation: 3, // เงาเล็กน้อย (Android)
    shadowColor: "#000", // เงา (iOS)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "KanitSemiBold",
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    color: "#CCCCCC",
    fontSize: 12,
  },
});
