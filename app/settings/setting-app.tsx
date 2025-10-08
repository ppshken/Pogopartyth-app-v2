import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showSnack } from "../../components/Snackbar";
import { getProfile } from "../../lib/user";

type noti = {
  noti_status: string;
};

export default function SettingApp() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(false);

  // โหลด ข้อมูล
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await getProfile()) as noti;
      if (u.noti_status === "on") {
        setEnabled(true);
      } else {
        setEnabled(false);
      }
    } catch (e: any) {
      Alert.alert("โหลดไม่สำเร็จ", e.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  // โหลดข้อมูลเมื่อเปิดหน้า
  useEffect(() => {
    load();
  }, [load]);

  const onToggle = () => setEnabled(previousState => !previousState);

  const onReport = async () => {
    const to = "support@pogopartyth.app"; // change if you have a support email
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
        <Switch value={enabled} onValueChange={onToggle} disabled={loading} />
      </View>

      <TouchableOpacity style={styles.reportBtn} onPress={onReport}>
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
