// lib/otp.ts
import { API_BASE } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function sendEmailOtp() {
  const token = await AsyncStorage.getItem("token");
  const r = await fetch(`${API_BASE}/api/auth/send_email_otp.php`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.message || "ส่งรหัสไม่สำเร็จ");
}

export async function verifyEmailOtp(code: string) {
  const token = await AsyncStorage.getItem("token");
  const r = await fetch(`${API_BASE}/api/auth/verify_email_otp.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.message || "รหัสไม่ถูกต้อง");
}
