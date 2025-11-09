import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { showSnack } from "../../components/Snackbar";
import { reset_password } from "../../lib/auth";

export default function ForgetPasswordScreen() {
  const { user_id: user_id } = useLocalSearchParams();
  const userId = Number(user_id);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfrimPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [shwconfrimPw, setShowConFirmPw] = useState(false);

  const canSubmit = useMemo(() => {
    if (!password || !confirmPassword) return false;
    return true;
  }, [password, confirmPassword]);

  useEffect(() => {
    console.log("user_id", userId);
  }, []);

  const onResetPassword = async () => {
    if (!canSubmit) return;
    if (password !== confirmPassword)
      return showSnack({ text: "รหัสผ่านไม่ตรงกัน", variant: "error" });
    setLoading(true);

    // ตรวจสอบความถูกต้องของ UI อีกครั้งก่อนส่ง
    if (!canSubmit) {
      showSnack({ text: "รูปแบบอีเมลไม่ถูกต้อง", variant: "error" });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        user_id: userId,
        password: confirmPassword,
      };
      const user = await reset_password(payload);
      console.log("user", user);
      router.replace("/(auth)/login");
      showSnack({ text: "รีเซ็ทรหัสผ่านสำเร็จ", variant: "success" });
    } catch (e: any) {
      showSnack({
        text: e?.message || "การรีเซ็ทรหัสผ่านไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View style={styles.card}>
        <Text style={styles.title}>ระบุ รหัสผ่านที่ต้องการรีเซ็ท</Text>
        <Text style={styles.subtitle}>
          กรุณาระบุรหัสผ่านใหม่ของคุณ เพื่อทำการรีเซ็ทรหัสผ่านใหม่
        </Text>

        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.inputRowPassword}>
          <TextInput
            placeholder="อย่างน้อย 8 ตัวอักษร"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            style={[styles.input, { paddingVertical: 2 }]}
            returnKeyType="done"
            onSubmitEditing={onResetPassword}
          />
          <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
            <Ionicons
              name={showPw ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </TouchableOpacity>
        </View>

        {password && password.length < 8 ? (
          <Text
            style={{
              marginBottom: 12,
              fontFamily: "KanitRegular",
              fontSize: 12,
              color: "#DC2626",
            }}
          >
            อย่างน้อย 8 ตัวอักษร
          </Text>
        ) : (
          <View style={{ marginBottom: 12 }} />
        )}

        <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="อย่างน้อย 8 ตัวอักษร"
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfrimPassword}
            secureTextEntry={!shwconfrimPw}
            style={[styles.input, { paddingVertical: 2 }]}
            returnKeyType="done"
            onSubmitEditing={onResetPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConFirmPw((v) => !v)}
            hitSlop={12}
          >
            <Ionicons
              name={shwconfrimPw ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={onResetPassword}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>บันทึก</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginTop: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "KanitSemiBold",
    marginBottom: 6,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "KanitRegular",
    color: "#6B7280",
    marginBottom: 16,
    lineHeight: 20,
  },
  field: { marginBottom: 14 },
  label: {
    fontSize: 14,
    fontFamily: "KanitSemiBold",
    color: "#374151",
    marginBottom: 6,
  },
  inputRowPassword: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontFamily: "KanitRegular",
  },
  button: {
    marginTop: 4,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "KanitSemiBold",
  },
  linkBtn: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: "#2563EB",
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
});
