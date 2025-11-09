import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { router } from "expo-router";
import { showSnack } from "../../components/Snackbar";
import { forget_password } from "../../lib/auth";

export default function ForgetPasswordScreen() {
  const [email, setEmail] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!email) return false;
    // ตรวจรูปแบบอีเมลแบบพื้นฐาน
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }, [email]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const onReset = async () => {
    if (!canSubmit) return;
    setLoading(true);

    // ตรวจสอบความถูกต้องของ UI อีกครั้งก่อนส่ง
    if (!canSubmit) {
      showSnack({ text: "รูปแบบอีเมลไม่ถูกต้อง", variant: "error" });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        email: email.trim(),
      };
      const user = await forget_password(payload);
      console.log("user", user);
      router.replace({
        pathname: "/(auth)/email_verify_otp",
        params: {
          email: email,
          user_id: user.user.id,
          type: "reset",
        },
      });
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
        <Text style={styles.title}>ลืมรหัสผ่าน</Text>
        <Text style={styles.subtitle}>
          กรอกอีเมลที่ลงทะเบียนไว้ เราจะส่งลิงก์หรือรหัสสำหรับรีเซ็ตไปให้คุณ
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>อีเมล</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
            placeholderTextColor="#9AA0A6"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (!canSubmit || loading) && styles.buttonDisabled,
          ]}
          disabled={!canSubmit || loading}
          onPress={onReset}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>รีเซ็ทรหัสผ่าน</Text>
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 12, android: 10 }),
    fontSize: 16,
    fontFamily: "KanitRegular",
    color: "#111827",
    backgroundColor: "#fff",
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
