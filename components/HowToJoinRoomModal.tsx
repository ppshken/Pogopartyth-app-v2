// components/HowToJoinRoomModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function HowToJoinRoomModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* แตะพื้นหลังเพื่อปิด */}
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* กันไม่ให้แตะทะลุเนื้อหา */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="help-circle-outline" size={20} color="#111827" />
              <Text style={styles.title}>วิธีใช้งานเมื่อเข้าห้อง</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="ปิด">
              <Ionicons name="close" size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            contentContainerStyle={{ paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <Section title="ภาพรวม" style={{ marginBottom: 12 }}>
              <Bullet>ดูรูปบอส, ชื่อห้อง, เวลานับถอยหลัง, สถานะ (เปิดรับ/เชิญแล้ว/เต็ม/หมดเวลา)</Bullet>
              <Bullet>เห็นจำนวนสมาชิกปัจจุบัน / สูงสุด</Bullet>
            </Section>

            <Section title="การเข้าร่วม & แชท">
              <Bullet>ยังไม่เข้าห้อง ➜ กด “เข้าร่วมห้อง” ก่อน จึงจะเข้าแชทได้</Bullet>
              <Bullet>เข้าร่วมแล้ว ➜ ปุ่ม “เข้าแชท” จะใช้งานได้ทันที</Bullet>
              <Bullet>เจ้าของห้องจะไม่มีปุ่มเข้าร่วม</Bullet>
            </Section>

            <Section title="รหัสเพื่อนหัวห้อง">
              <Bullet>สมาชิก (ที่ไม่ใช่เจ้าของ) กด “คัดลอกรหัสหัวห้อง” แล้วไปแอดในเกม</Bullet>
              <Bullet>กด “เพิ่มเพื่อนแล้ว” เพื่อแจ้งความพร้อมให้หัวห้องดู</Bullet>
            </Section>

            <Section title="สำหรับเจ้าของห้อง">
              <Bullet>กด “คัดลอกชื่อผู้เล่น” เพื่อรวบชื่อสมาชิกทั้งหมด</Bullet>
              <Bullet>เมื่อสมาชิกทุกคนกด “เพิ่มเพื่อนแล้ว” ➜ กด “เชิญในเกม”</Bullet>
              <Bullet>หลังเชิญแล้ว ทุกคนจะเห็นปุ่ม “ตีบอสเสร็จ กด” เพื่อรายงานผล</Bullet>
            </Section>

            <Section title="รายงานผลหลังตีบอส">
              <Bullet>กด “ตีบอสเสร็จ กด” ➜ เลือก “สำเร็จ” หรือ “ไม่สำเร็จ”</Bullet>
              <Bullet>ถ้าสำเร็จ ➜ ให้คะแนนห้อง 1–5 ดาว</Bullet>
              <Bullet>ถ้าไม่สำเร็จ ➜ ใส่เหตุผลสั้นๆ</Bullet>
              <Bullet>ระบบจะ “ปิดห้อง” อัตโนมัติ เมื่อ “ทุกคน” รีวิวครบ</Bullet>
            </Section>

            <Section title="ทริกเล็กๆ">
              <Bullet>ดึงหน้าจอลงเพื่อรีเฟรชข้อมูลล่าสุด</Bullet>
              <Bullet>ห้องหมดเวลา ➜ สถานะจะเป็น “หมดเวลา”</Bullet>
              <Bullet>ห้องเต็ม ➜ ขึ้น “เต็ม” และไม่สามารถเข้าร่วมเพิ่มได้</Bullet>
            </Section>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    maxHeight: "80%",
    // เงา/ยกชั้นเล็กๆ
    shadowColor: "rgba(16,24,40,0.06)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    color: "#111827",
    fontFamily: "KanitSemiBold",
  },
  iconBtn: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  sectionTitle: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 4,
    fontFamily: "KanitBold",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: { color: "#111827", fontSize: 14, lineHeight: 20, fontFamily: "KanitBold" },
  bulletText: { color: "#374151", fontSize: 14, flex: 1, lineHeight: 20, fontFamily: "KanitMedium" },
  closeBtn: {
    marginTop: 8,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnText: { color: "#fff", fontFamily: "KanitBold" },
});
