// hooks/useAuthGate.ts
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";

export function useAuthGate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      setAuthed(!!token);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!authed && !inAuthGroup) {
      router.replace("/(auth)/login");
    }
  }, [ready, authed, segments]);

  return { ready, authed };
}
