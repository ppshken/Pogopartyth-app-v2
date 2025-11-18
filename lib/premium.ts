import { api } from "./api";

export async function UpgradePremium(day: number) {
    const { data } = await api.post("/api/premium/upgrade_premium.php",
        { day },
        { validateStatus: () => true }
    );
    if (!data?.success) throw new Error(data?.message || "Leave failed");
    return data.data;
}