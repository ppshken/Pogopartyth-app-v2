import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Variant = "default" | "success" | "error" | "info" | "warning";
type ShowArgs = {
  text: string;
  duration?: number;        // ms, ใส่ 0 = ค้างไว้จนกดปิด/ทำ action
  variant?: Variant;
  actionLabel?: string;
  onAction?: () => void;
};
type Placement = "top" | "bottom";

let _externalShow: ((args: ShowArgs) => void) | undefined;
let _externalHide: (() => void) | undefined;

/** เรียกโชว์จากที่ไหนก็ได้ */
export function showSnack(arg: string | ShowArgs) {
  const args = typeof arg === "string" ? { text: arg } : arg;
  _externalShow?.(args);
}

/** ซ่อน */
export function hideSnack() {
  _externalHide?.();
}

/** วางไว้ท้ายๆ ของ root (เช่น _layout.tsx หรือ App.tsx)
 *  <SnackHost placement="top" />  // ด้านบน (ค่าเริ่มต้น)
 *  <SnackHost placement="bottom" /> // ด้านล่าง
 */
export function SnackHost({ placement = "top" }: { placement?: Placement }) {
  const insets = useSafeAreaInsets();

  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<ShowArgs>({
    text: "",
    duration: 2000,
    variant: "default",
  });

  // ถ้าอยู่บน ให้แอนิเมตจาก -20 → 0, ถ้าอยู่ล่าง 20 → 0
  const startOffset = placement === "top" ? -20 : 20;
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(startOffset)).current;
  const timer = useRef<NodeJS.Timeout | null>(null);

  const colors: Record<Variant, string> = {
    default: "#111827",
    success: "#10B981",
    error:   "#EF4444",
    info:    "#2563EB",
    warning: "#F59E0B",
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    Animated.parallel([
      Animated.timing(opacity,   { toValue: 0,  duration: 160, useNativeDriver: true }),
      Animated.timing(translate, { toValue: startOffset, duration: 160, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const show = (args: ShowArgs) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const next = { duration: 2000, variant: "default" as Variant, ...args };
    setState(next);
    setVisible(true);
    opacity.setValue(0);
    translate.setValue(startOffset);
    Animated.parallel([
      Animated.timing(opacity,   { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();

    if (next.duration && next.duration > 0) {
      timer.current = setTimeout(hide, next.duration);
    }
  };

  useEffect(() => {
    _externalShow = show;
    _externalHide = hide;
    return () => {
      _externalShow = undefined;
      _externalHide = undefined;
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]); // เปลี่ยนตำแหน่งให้รีเซ็ต animator ให้ถูก
  

  if (!visible) return null;

  // ระยะห่างจากขอบ: ใช้ safe-area เสมอ
  const verticalStyle =
    placement === "top"
      ? { top: Math.max(insets.top, 12) + 8, bottom: undefined }
      : { bottom: Math.max(insets.bottom, 12) + 8, top: undefined };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[styles.container, verticalStyle]}>
        <Animated.View
          style={[
            styles.snack,
            {
              backgroundColor: colors[state.variant || "default"],
              opacity,
              transform: [{ translateY: translate }],
            },
          ]}
        >
          <Text style={styles.text}>{state.text}</Text>
          {state.actionLabel ? (
            <TouchableOpacity
              onPress={() => {
                state.onAction?.();
                hide();
              }}
            >
              <Text style={styles.action}>{state.actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  snack: {
    maxWidth: "94%",
    minWidth: "90%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    // เงาเล็กๆ
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  // ใช้ Kanit จาก defaultProps ของคุณอยู่แล้ว
  text: { color: "#fff", fontFamily: "KanitSemiBold", flexShrink: 1 },
  action: { color: "#fff", fontFamily: "KanitSemiBold", marginLeft: 8, textDecorationLine: "underline" },
});
