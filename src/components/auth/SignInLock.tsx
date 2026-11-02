"use client";

import { useEffect, useState } from "react";

export function formatSignInWait(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useSignInLock() {
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (lockedUntil == null) return;

    const tick = () => {
      const left = lockedUntil - Date.now();
      if (left <= 0) {
        setLockedUntil(null);
        setRemainingMs(0);
        return;
      }
      setRemainingMs((current) =>
        Math.ceil(current / 1000) === Math.ceil(left / 1000) ? current : left
      );
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  return {
    locked: remainingMs > 0,
    remainingLabel: formatSignInWait(remainingMs),
    startLock(seconds: number) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const until = Date.now() + seconds * 1000;
      setLockedUntil(until);
      setRemainingMs(until - Date.now());
    },
  };
}

export function SignInLockNotice() {
  return (
    <div
      id="sign-in-lock"
      role="alert"
      className="mt-3.5 rounded-[10px] border-[1.5px] border-[#f2b8b0] bg-[#fdecea] px-3 py-2.5 text-[12.5px] text-[#b3261e]"
    >
      Too many attempts. Sign-in is paused until the countdown ends.
    </div>
  );
}
