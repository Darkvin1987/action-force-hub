
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_LIMIT = 15* 60 * 1000; // 15 minutes

export default function SessionTimeout() {
  useEffect(() => {
    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout>;
    let active = true;

    const logout = async () => {
      if (!active) return;

      await supabase.auth.signOut();
      window.location.replace("/login?reason=timeout");
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void logout();
      }, INACTIVITY_LIMIT);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, {
        passive: true,
      });
    });

    resetTimer();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, []);

  return null;
}
