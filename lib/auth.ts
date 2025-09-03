import { api } from "./api";

/** ปรับตามโครงจริงของ API คุณ */
export type User = {
  id: number;
  email: string;
  username: string;
  avatar: string | null;
  friend_code: string | null;
  created_at: string | null;
};

/** เข้าสู่ระบบ */
export async function login(payload: {
  email?: string;
  username?: string;
  password: string;
}) {
  const { data } = await api.post("/api/auth/login.php", payload, {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Login failed"); // ← จะโยน "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
  return data.data;
}

/** สมัครสมาชิก */
export async function register(payload: {
  email: string;
  username: string;
  password: string;
  avatar?: string;
  friend_code?: string;
  level?: number;
}) {
  const { data } = await api.post("/api/auth/register.php", payload, {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Register failed");
  return data.data as { user: User; token: string };
}

/** โปรไฟล์ */
export async function profile() {
  const { data } = await api.get("/api/auth/profile.php", {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Profile failed");
  return data.data;
}
