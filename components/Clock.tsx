"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;

  return (
    <time
      dateTime={time.toISOString()}
      className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
    >
      {displayHours}:{displayMinutes} {ampm}
    </time>
  );
}
