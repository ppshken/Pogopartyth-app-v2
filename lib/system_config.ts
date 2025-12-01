// lib/raidBoss.ts
import { api } from "./api";

export type AppConfig = {
    maintenance: {
        is_active: boolean;
        message: string;
    };
    version_check: {
        android: { min_version: string; store_url: string };
        ios: { min_version: string; store_url: string };
    };
    features: {
        ads_enabled: boolean;
        vip_enables: boolean;
    };
    announcement: {
        show: boolean;
        title: string;
        body: string;
        link: string;
    };
    general: {
        contact_line: string;
        privacy_policy: string;
    };
};

export async function systemConfig() {
    const { data } = await api.get("/api/system/config.php", {
        validateStatus: () => true,
    });
    if (!data?.success) throw new Error(data?.message || "โหลดรายชื่อบอสไม่สำเร็จ");
    return (data.data as AppConfig);
}
