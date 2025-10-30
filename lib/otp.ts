// lib/otp.ts
import { api } from "./api";

/**
 * ยืนยัน OTP (6 หลัก)
 * แนะนำให้ backend (ถ้า verify สำเร็จ) ส่ง user + token กลับมาเพื่อ login ทันที
 */
export async function verifyEmailOtp(user_id: number, type: string, otp: string) {
  try {
    const res = await api.post("/api/auth/otp/verify.php", { user_id, type, otp });
    if (!res?.data?.success) {
      throw new Error(res?.data?.message || "รหัสไม่ถูกต้อง");
    }
    return res.data;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาด";
    throw new Error(msg);
  }
}

/** สมัครสมาชิก */
export async function sendEmailOtp(payload: {
  user_id: number;
  type: string;
}) {
  const { data } = await api.post("/api/auth/otp/send_otp.php", payload, {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Register failed");
  return data.data;
}
