import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

export function useNotifyRoomExpiredLocal(opts: {
  expired: boolean;
  roomId: number;
  boss?: string | null;
}) {
  const { expired, roomId, boss } = opts;
  const sentRef = useRef(false);

  useEffect(() => {
    if (!expired || sentRef.current) return;

    sentRef.current = true;
    Notifications.scheduleNotificationAsync({
      content: {
        title: `ห้องบอส ${boss ?? ""} ของคุณหมดเวลาแล้ว`,
        body: "หมดเวลาแล้วนะ กดเพื่อเปิดหน้าห้อง",
        data: { type: "room_expired", room_id: roomId },
      },
      trigger: null, // ทันที
    });
  }, [expired, roomId, boss]);
}
