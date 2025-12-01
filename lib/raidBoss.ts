// lib/raidBoss.ts
import { api } from "./api";

export type RaidBoss = {
  raid_boss_id: number;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_image: string;
  pokemon_tier: number;
  start_date: string;
  end_date: string;
  type: string;
  special: boolean;
  maximum: number;
  created_at: string;
};

export async function getActiveRaidBosses(params?: { q?: string; all?: 1 }) {
  const { data } = await api.get("/api/raid_boss/get_raid_boss.php", {
    params: { all: 1, ...(params || {}) },   // all=1 เหมาะกับ dropdown
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "โหลดรายชื่อบอสไม่สำเร็จ");
  return (data.data.items ?? []) as RaidBoss[];
}
