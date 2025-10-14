// app/(tabs)/settings/SettingApp.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showSnack } from "../../components/Snackbar";
import { getProfile } from "../../lib/user";
import { api } from "../../lib/api";

type NotiProfile = {
  noti_status: "on" | "off";
};

export default function SettingApp() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);       // โหลดโปรไฟล์
  const [updating, setUpdating] = useState(false);     // ยิง API toggle
  const [enabled, setEnabled] = useState<boolean>(false);

  // โหลดข้อมูลจาก backend
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await getProfile()) as NotiProfile;
      setEnabled(u?.noti_status === "on");
    } catch (e: any) {
      Alert.alert("โหลดไม่สำเร็จ", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  // เรียกตอนเข้าเพจ
  useEffect(() => {
    load();
  }, [load]);

  // ฟังก์ชันอัปเดตสถานะแจ้งเตือนบนเซิร์ฟเวอร์
  const updateNotiStatus = useCallback(
    async (nextOn: boolean) => {
      setUpdating(true);

      try {
        // ถ้าจะ "เปิด" — ขอสิทธิ์แจ้งเตือนก่อน (iOS/Android)
        if (nextOn) {
          const { status: existing } = await Notifications.getPermissionsAsync();
          let finalStatus = existing;
          if (existing !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== "granted") {
            showSnack({ text: "ต้องอนุญาตการแจ้งเตือนในระบบก่อน", variant: "success" });
            // ไม่อนุญาต => ไม่อัปเดตฝั่งเซิร์ฟเวอร์ และคงไว้เป็น OFF
            setEnabled(false);
            setUpdating(false);
            return;
          }
        }

        // ยิง API ไป backend (ปรับ path ตามของคุณ)
        // ตัวอย่าง: POST /api/user/noti_status  { status: 'on' | 'off' }
        const status = nextOn ? "on" : "off";
        await api.post("/api/auth/noti_status.php", { status });
        showSnack({ text: nextOn ? "เปิดการแจ้งเตือนแล้ว" : "ปิดการแจ้งเตือนแล้ว", variant: "success" });

        // reload โปรไฟล์ทุกครั้งหลังสลับ (ตามที่ต้องการ)
        await load();
      } catch (e: any) {
        // revert ค่าในกรณีผิดพลาด
        setEnabled((prev) => !prev);
        Alert.alert("อัปเดตไม่สำเร็จ", e?.message || "กรุณาลองใหม่");
      } finally {
        setUpdating(false);
      }
    },
    [load]
  );

  // กดสวิตช์
  const onToggle = useCallback(() => {
    if (loading || updating) return;
    const next = !enabled;
    setEnabled(next);          // optimistic UI
    updateNotiStatus(next);    // แล้วค่อยยิง API (+ reload)
  }, [enabled, loading, updating, updateNotiStatus]);

  const onReport = async () => {
    const to = "support@pogopartyth.app";
    const subject = encodeURIComponent("รายงานจากแอป Pogopartyth");
    const body = encodeURIComponent(
      "กรุณาระบุปัญหาที่พบ\n\n(เวอร์ชันแอป, ข้อความแสดงข้อผิดพลาด, ขั้นตอนการทำซ้ำ)"
    );
    const url = `mailto:${to}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("ไม่สามารถเปิดแอปอีเมล", "กรุณาติดต่อผู้พัฒนาโดยตรง");
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e?.message || "ไม่สามารถเปิดเมลได้");
    }
  };

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Text style={styles.title}>ตั้งค่าแอป</Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>การแจ้งเตือน</Text>
          <Text style={styles.desc}>เปิด/ปิด การแจ้งเตือนจากแอป</Text>
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            disabled={loading || updating}
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.reportBtn, updating && { opacity: 0.7 }]}
        onPress={onReport}
        disabled={updating}
      >
        <Text style={styles.reportBtnText}>รายงานปัญหา / ส่งความคิดเห็น</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        หมายเหตุ: การเปิดการแจ้งเตือนจะขออนุญาตจากระบบปฏิบัติการ
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  label: { fontSize: 16, fontWeight: "800", color: "#111827" },
  desc: { color: "#6B7280", marginTop: 2 },
  reportBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  reportBtnText: { color: "#fff", fontWeight: "800" },
  note: { color: "#6B7280", marginTop: 12, fontSize: 12 },
});
