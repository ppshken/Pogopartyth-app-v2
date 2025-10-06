import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showSnack } from "../../components/Snackbar";

const STORAGE_KEY = "@pogopartyth:settings:notifications";

export default function SettingApp() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v !== null) setEnabled(v === "1");
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const persist = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch (e) {
      // ignore
    }
  };

  const enableNotifications = async () => {
    try {
      setLoading(true);
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        showSnack({ text: "อนุญาตการแจ้งเตือนถูกปฏิเสธ", variant: "warning" });
        setEnabled(false);
        await persist(false);
        return false;
      }

      showSnack({ text: "เปิดการแจ้งเตือนแล้ว", variant: "success" });
      await persist(true);
      return true;
    } catch (e: any) {
      showSnack({ text: e?.message || "เกิดข้อผิดพลาด", variant: "error" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    try {
      setLoading(true);
      // We won't revoke OS permission programmatically; just stop app-level notifications
      // Optionally cancel scheduled notifications
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch {
        // ignore
      }
      showSnack({ text: "ปิดการแจ้งเตือนแล้ว", variant: "success" });
      await persist(false);
      return true;
    } catch (e: any) {
      showSnack({ text: e?.message || "เกิดข้อผิดพลาด", variant: "error" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onToggle = async (next: boolean) => {
    setEnabled(next);
    if (next) await enableNotifications();
    else await disableNotifications();
  };

  const onReport = async () => {
    const to = "support@pogopartyth.app"; // change if you have a support email
    const subject = encodeURIComponent("รายงานจากแอป Pogopartyth");
    const body = encodeURIComponent("กรุณาระบุปัญหาที่พบ\n\n(เวอร์ชันแอป, ข้อความแสดงข้อผิดพลาด, ขั้นตอนการทำซ้ำ)");
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
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Text style={styles.title}>ตั้งค่าแอป</Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>การแจ้งเตือน</Text>
          <Text style={styles.desc}>เปิด/ปิด การแจ้งเตือนจากแอป</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={loading}
        />
      </View>

      <TouchableOpacity style={styles.reportBtn} onPress={onReport}>
        <Text style={styles.reportBtnText}>รายงานปัญหา / ส่งความคิดเห็น</Text>
      </TouchableOpacity>

      <Text style={styles.note}>หมายเหตุ: การเปิดการแจ้งเตือนจะขออนุญาตจากระบบปฏิบัติการ</Text>
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
