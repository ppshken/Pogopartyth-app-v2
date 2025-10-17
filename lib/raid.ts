import { api } from "./api";

export async function listRooms(params: any) {
  const { data } = await api.get("/api/raid/list.php", {
  params: {
    status: "active",
    exclude_expired: 1, // คงไว้เพื่อซ่อนห้องหมดเวลา
    exclude_mine: 1,    // ✅ ใหม่: ไม่เอาห้องที่ตัวเองสร้าง
    page: 1,
    limit: 50,
  },
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "List rooms failed");
  return data.data; // คงไว้ให้ caller เลือกใช้ res.items หรือ res.rooms ตาม API
}

export async function getRoom(room_id: number) {
  const { data } = await api.get("/api/raid/get_room.php", {
    params: { room_id },
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Get room failed");
  return data.data;
}

export async function createRoom(body: {
  raid_boss_id: number;
  pokemon_image: string;
  boss: string;
  start_time: string;
  max_members: number;
  note?: string;
}) {
  const { data } = await api.post("/api/raid/create.php", body, {
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Create room failed");
  return data.data.room;
}

export async function joinRoom(room_id: number) {
  const { data } = await api.post("/api/raid/join.php",
    { room_id },
    { validateStatus: () => true }
  );
  if (!data?.success) throw new Error(data?.message || "Join failed");
  return data.data;
}

export async function leaveRoom(room_id: number) {
  const { data } = await api.post("/api/raid/leave.php",
    { room_id },
    { validateStatus: () => true }
  );
  if (!data?.success) throw new Error(data?.message || "Leave failed");
  return data.data;
}

export async function updateStatus(
  room_id: number,
  status: "active" | "closed" | "canceled" | "invited" // ✅ เพิ่ม invited
) {
  const { data } = await api.post("/api/raid/update_status.php", { room_id, status }, { validateStatus:()=>true });
  if (!data?.success) throw new Error(data?.message || "Update status failed");
  return data.data;
}

export async function kickMember(
  room_id: number,
  user_id: number, // ✅ เพิ่ม invited
) {
  const { data } = await api.post("/api/raid/kick_member.php", { room_id, user_id }, { validateStatus:()=>true });
  if (!data?.success) throw new Error(data?.message || "Kick Member failed");
  return data.data;
}


export async function reviewRoom(room_id: number, rating: number, comment?: string) {
  const { data } = await api.post("/api/raid/review.php", { room_id, rating, comment }, { validateStatus:()=>true });
  if (!data?.success) throw new Error(data?.message || "Review failed");
  return data.data;
}

export async function getFriendReadyStatus(room_id: number) {
  const { data } = await api.get("/api/raid/ready_status.php", {
    params: { room_id },
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Get friend ready status failed");
  return data.data;
}

export async function setFriendReady(room_id: number, ready?: boolean, user_id?: number) {
  const body: any = { room_id };
  if (typeof ready === "boolean") body.ready = ready ? 1 : 0;
  if (typeof user_id === "number") body.user_id = user_id;

  const { data } = await api.post("/api/raid/ready_friend.php", body, { validateStatus: () => true });
  if (!data?.success) throw new Error(data?.message || "Set friend ready failed");
  return data.data;
}

export async function CancelRoom(payload: { room_id: number; reason?: string }) {
  const { data } = await api.post("/api/raid/cancel_room.php", payload, {
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Cancel room failed");
  return data.data;
}
