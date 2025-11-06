// lib/friend.ts
import { api } from "./api";

export type FriendRelation = {
  status?: "none" | "pending" | "accepted" | "blocked";
  requested_by_you?: boolean;
  is_friend?: boolean;
};

export type Friend = {
  id: number;
  username: string;
  avatar?: string | null;
  friend_code_masked?: string | null;
  team?: string | null;
  level?: number;
  device_token: string;
  rating_owner?: number | null;
  relation?: FriendRelation;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_more: boolean;
  next_page: number | null;
  user_all: number;
};

export type Inbox = {
  id: number;
  sender: number;
  username: string;
  avatar?: string | null;
  message: string;
  created_at: string;
};

export type FriendSearchPayload = {
  q?: string;
  page?: number;
  limit?: number; // default 20
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type FriendSearchData =
  | { list: Friend[]; pagination: Pagination } // (แนะนำ)
  | { data: Friend[]; pagination: Pagination }; // (สำรอง: ถ้าฝั่ง PHP ส่งเป็น data+pagination)

function normalize(data: any): { list: Friend[]; pagination: Pagination } {
  // รองรับทั้ง data.list และ data.data
  const list: Friend[] = data?.list ?? data?.data ?? [];
  const pagination: Pagination = data?.pagination ?? {
    page: 1,
    limit: 20,
    total: list.length,
    total_pages: 1,
    has_more: false,
    next_page: null,
  };
  return { list, pagination };
}

/** ค้นหาเพื่อน (20 ต่อหน้า) */
export async function searchFriends(params: FriendSearchPayload) {
  const { q = "", page = 1, limit = 20 } = params ?? {};
  const { data } = await api.get<ApiEnvelope<FriendSearchData>>(
    "/api/friends/search.php",
    { params: { q, page, limit } }
  );

  if (!data?.success) {
    throw new Error(data?.message || "Search failed");
  }
  return normalize(data.data);
}

/** สร้าง URL รูปแทนกรณีไม่มี avatar */
export function avatarOrFallback(username?: string | null, avatar?: string | null) {
  if (avatar) return avatar;
  const name = encodeURIComponent(username || "User");
  return `https://ui-avatars.com/api/?name=${name}&background=random`;
}

// ✅ ใหม่: ดึง "เพื่อนของฉัน" (พร้อมรองรับ q เพื่อกรองด้วยชื่อ/โค้ด)
export async function listMyFriends(params: { q?: string; page: number; limit: number }) {
  const res = await api.get("/api/friends/myfriend.php", { params });
  if (!res.data?.success) throw new Error(res.data?.message || "list failed");
  return res.data.data as { list: Friend[]; pagination: { page: number; has_more: boolean; user_all: number; } };
}

/** ส่งคำขอเป็นเพื่อนไปหา targetId */
export async function AddFriend(targetId: number): Promise<{ message: string }> {
  const res = await api.post("/api/friends/add.php", { target_id: targetId });
  // โครงตอบกลับที่คาดหวัง: { success: boolean, message?: string }
  if (!res.data?.success) {
    throw new Error(res.data?.message || "ส่งคำขอเป็นเพื่อนไม่สำเร็จ");
  }
  return { message: res.data?.message || "ส่งคำขอเป็นเพื่อนเรียบร้อยแล้ว" };
}

/** ตอบรับคำขอเป็นเพื่อน (อีกฝ่ายคือ requester) */
export async function AcceptFriend(requester_id: number): Promise<{ message: string }> {
  const res = await api.post("/api/friends/respond.php", {
    requester_id: requester_id,
    action: "accept",
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message || "ตอบรับคำขอไม่สำเร็จ");
  }
  return { message: res.data?.message || "ตอบรับคำขอเป็นเพื่อนแล้ว" };
}

/** ปฏิเสธคำขอเป็นเพื่อน */
export async function DeclineFriend(requester_id: number): Promise<{ message: string }> {
  const res = await api.post("/api/friends/respond.php", {
    requester_id: requester_id,
    action: "decline",
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message || "ตอบรับคำขอไม่สำเร็จ");
  }
  return { message: res.data?.message || "ตอบรับคำขอเป็นเพื่อนแล้ว" };
}

// ✅ ดึง "คำขอเป็นเพื่อนที่ส่งมาหาเรา" (สถานะ pending)
export async function GetPendingFriends(params: { q?: string; page: number; limit: number }) {
  const res = await api.get("/api/friends/request_friend.php", { params });
  if (!res.data?.success) throw new Error(res.data?.message || "get pending friends failed");
  return res.data.data as {
    list: {
      request_id: number;
      requester_id: number;
      username: string;
      avatar?: string | null;
      team?: string | null;
      level?: number | null;
      friend_code?: string | null;
      created_at?: string;
      status?: string;
    }[];
    pagination: {
      page: number;
      has_more: boolean;
      total?: number;
    };
  };
}

// ดึงเพื่อนที่เชิญเข้าห้องนี้ได้ (ยังไม่อยู่ในห้อง)
export async function getFriendAvailable(params?: {
  room_id: number;
  q?: string;
}) {
  const { room_id, q } = params ?? {};
  if (!room_id) {
    throw new Error("room_id is required");
  }
  const res = await api.get("/api/friends/available_for_room.php", {
    params: { room_id, q },
    validateStatus: () => true, // อย่าปล่อย axios throw เอง (เผื่อ 422/429/etc.)
  });
  const json = res.data;
  if (!json?.success) {
    throw new Error(json?.message || "โหลดรายชื่อเพื่อนไม่สำเร็จ");
  }
  // เซิร์ฟเวอร์ส่งกลับใน data.list ไม่ใช่ data.items
  return (json.data?.list ?? []) as Friend[];
}

// ดึงข้อความเพื่อนที่ยังไม่อ่าน
export async function getInbox_list() {
  const res = await api.get("/api/friends/inbox_list.php", {
    validateStatus: () => true, // อย่าปล่อย axios throw เอง (เผื่อ 422/429/etc.)
  });
  const json = res.data;
  if (!json?.success) {
    throw new Error(json?.message || "โหลดข้อความไม่สำเร็จ");
  }
  // เซิร์ฟเวอร์ส่งกลับใน data.list ไม่ใช่ data.items
  return (json.data?.list ?? []);
}
