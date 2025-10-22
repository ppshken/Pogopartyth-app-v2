// app/(auth)/EmailOtpVerifyScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { showSnack } from "../../components/Snackbar";
import { resendEmailOtp, verifyEmailOtp } from "../../lib/otp";
import { useAuth } from "../../store/authStore";

const ACCENT = "#111827";
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#6B7280";
const ERROR = "#DC2626";

export default function EmailOtpVerifyScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = (emailParam || "").toString();
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState<number>(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // เริ่มนับถอยหลัง resend เมื่อเข้าหน้า
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ตรวจว่ากรอกครบ 6 แล้ว auto-verify
  useEffect(() => {
    if (code.length === 6) onVerify();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = useMemo(
    () => code.length === 6 && !submitting,
    [code, submitting]
  );

  const onVerify = useCallback(async () => {
    if (!canSubmit) return;
    if (!email) {
      showSnack({ text: "ไม่พบอีเมลสำหรับยืนยัน", variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      // แนะนำให้ backend ส่งกลับ { success, data: { token?, user?, redirect? } }
      const res = await verifyEmailOtp(email.trim(), code);
      // ถ้า backend ออก JWT พร้อม user เลย: login อัตโนมัติ
      if (res?.data?.token && res?.data?.user) {
        await setAuth(res.data.user, res.data.token);
        showSnack({ text: "ยืนยันอีเมลสำเร็จ", variant: "success" });
        router.replace("/room_raid");
      } else {
        // กรณี backend แค่ verify สถานะ, ให้กลับหน้า login
        showSnack({ text: "ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ", variant: "success" });
        router.replace("/(auth)/login");
      }
    } catch (e: any) {
      showSnack({ text: e?.message || "รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, code, email, router, setAuth]);

  const onResend = useCallback(async () => {
    if (!email) {
      showSnack({ text: "ไม่พบอีเมลสำหรับส่งรหัส", variant: "error" });
      return;
    }
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendEmailOtp(email.trim());
      showSnack({ text: "ส่งรหัสใหม่แล้ว โปรดตรวจอีเมล", variant: "success" });
      setCooldown(60);
    } catch (e: any) {
      showSnack({ text: e?.message || "ส่งรหัสใหม่ไม่สำเร็จ", variant: "error" });
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.centerContainer}>
          <View style={styles.wrap}>
            <View style={styles.card}>
              <Text style={styles.title}>ยืนยันอีเมล</Text>
              <Text style={styles.subtitle}>
                เราได้ส่งรหัสยืนยัน 6 หลักไปที่{` `}
                <Text style={styles.bold}>{email || "อีเมลของคุณ"}</Text>
              </Text>

              {/* OTP 6 หลัก (ช่องเดียว แสดงกรอบสวย ๆ) */}
              <View style={styles.otpBoxes}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const ch = code[i] ?? "";
                  const isActive = i === code.length;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.otpBox,
                        isActive && { borderColor: ACCENT },
                      ]}
                    >
                      <Text style={styles.otpChar}>{ch}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Hidden input ตัวจริง */}
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus
                style={styles.hiddenInput}
                maxLength={6}
              />

              <TouchableOpacity
                onPress={onVerify}
                disabled={!canSubmit}
                activeOpacity={0.9}
                style={[styles.primaryBtn, !canSubmit && { opacity: 0.6 }]}
              >
                <View style={styles.primaryBtnInner}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.primaryBtnText}>ยืนยัน</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.bottomRow}>
                <Text style={{ color: TEXT_SUB, fontFamily: "KanitMedium" }}>
                  ยังไม่ได้รับรหัส?
                </Text>
                <TouchableOpacity
                  onPress={onResend}
                  disabled={cooldown > 0 || resending}
                >
                  <Text style={styles.link}>
                    {cooldown > 0 ? `ขอใหม่ได้ใน ${cooldown}s` : "ขอรหัสใหม่"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Back to login */}
              <View style={[styles.bottomRow, { marginTop: 6 }]}>
                <Text style={{ color: TEXT_SUB, fontFamily: "KanitMedium" }}>
                  กลับไป
                </Text>
                <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                  <Text style={styles.link}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  wrap: { width: "100%", maxWidth: 420 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  title: {
    fontSize: 24,
    fontFamily: "KanitMedium",
    color: TEXT_MAIN,
  },
  subtitle: {
    marginTop: 6,
    color: TEXT_SUB,
    fontFamily: "KanitRegular",
  },
  bold: { color: TEXT_MAIN, fontFamily: "KanitSemiBold" },

  otpBoxes: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  otpChar: {
    fontSize: 22,
    fontFamily: "KanitSemiBold",
    color: TEXT_MAIN,
  },

  hiddenInput: {
    // ซ่อนไว้แต่ยังโฟกัสได้
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },

  primaryBtn: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: ACCENT,
  },
  primaryBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "KanitSemiBold",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  bottomRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  link: {
    color: ACCENT,
    textDecorationLine: "underline",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
});
