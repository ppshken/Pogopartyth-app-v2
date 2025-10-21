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
  return res.data.data as { list: Friend[]; pagination: { page: number; has_more: boolean } };
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

/** รับคำขอเป็นเพื่อน (อีกฝ่ายคือ requester) */
export async function AcceptFriend(requesterId: number): Promise<{ message: string }> {
  const res = await api.post("api/friends/respond.php", {
    requester_id: requesterId,
    action: "accept",
  });
  if (!res.data?.success) {
    throw new Error(res.data?.message || "ตอบรับคำขอไม่สำเร็จ");
  }
  return { message: res.data?.message || "ตอบรับคำขอเป็นเพื่อนแล้ว" };
}