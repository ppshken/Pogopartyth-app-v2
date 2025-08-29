import { api } from "./api";

export async function listRooms(params: any) {
  const { data } = await api.get("/api/raid/list.php", {
    params,
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
  boss: string; start_time: string; max_members: number; note?: string;
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


