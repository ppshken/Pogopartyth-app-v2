// app/(tabs)/settings/SettingApp.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showSnack } from "../../components/Snackbar";
import { useRouter } from "expo-router";
import { createReport } from "../../lib/reports";

export default function SettingApp() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false); // โหลดโปรไฟล์

  // ส่งรายงานปัญหา
  const onSubmit = async () => {
    const trimmed = reason.trim();

    if (trimmed.length < 5) {
      Alert.alert("กรุณากรอกรายละเอียด", "กรุณาใส่ข้อความอย่างน้อย 5 ตัวอักษร");
      return;
    }
    if (trimmed.length > 2000) {
      Alert.alert("ข้อความยาวเกินไป", "กรุณาลดข้อความให้ไม่เกิน 2000 ตัวอักษร");
      return;
    }

    try {
      setLoading(true);

      const res = await createReport({
        report_type: "other",
        target_id: 0,
        reason: trimmed,
      });

      // เคสคูลดาวน์ (429 จาก backend)
      if (res.statusCode === 429) {
        const waitSec = res.data?.cooldown_sec ?? null;
        const hint =
          waitSec != null
            ? `คุณเพิ่งส่งรายงานไปแล้ว โปรดลองใหม่ใน ${waitSec} วินาที`
            : res.message || "คุณส่งถี่เกินไป โปรดลองใหม่อีกครั้งภายหลัง";

        showSnack({
          text: hint,
          variant: "warning",
          duration: 4000,
        });
        return;
      }

      // error อื่น ๆ (422, 500 etc.)
      if (!res.success) {
        Alert.alert("ไม่สำเร็จ", res.message || "ลองใหม่อีกครั้ง");
        return;
      }

      // สำเร็จ
      showSnack({
        text: "ส่งรายงานสำเร็จ ขอบคุณสำหรับความคิดเห็น!",
        variant: "success",
      });
      setReason("");
      router.back();
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Text style={styles.title}>รายงานปัญหา / ส่งความคิดเห็น</Text>
      <Text style={styles.desc}>
        กรุณาอธิบายปัญหาหรือความคิดเห็นของคุณให้ละเอียด
        เพื่อให้ทีมงานตรวจสอบและปรับปรุงระบบได้ตรงจุด
      </Text>

      <TextInput
        style={styles.input}
        placeholder="พิมพ์รายละเอียดที่นี่..."
        placeholderTextColor="#9CA3AF"
        multiline
        value={reason}
        onChangeText={setReason}
        maxLength={2000}
        editable={!loading}
      />

      <Text style={styles.note}>
        หมายเหตุ: การรายงานนี้จะถูกเก็บไว้ในระบบเพื่อการตรวจสอบ
        ไม่สามารถแก้ไขภายหลังได้
      </Text>

      <TouchableOpacity
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>ส่งรายงาน</Text>
        )}
      </TouchableOpacity>
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
    fontFamily: "KanitSemiBold",
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
  label: { fontSize: 16, fontFamily: "KanitSemiBold", color: "#111827" },
  desc: {
    color: "#6B7280",
    marginTop: 2,
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  reportBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  reportBtnText: { color: "#fff", fontWeight: "800" },
  note: {
    color: "#6B7280",
    marginTop: 12,
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
    fontFamily: "KanitMedium",
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  submitText: {
    color: "#fff",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
});
