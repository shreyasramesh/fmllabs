"use client";

import { useEffect, useState } from "react";

type WeatherFormat = "condition-temp" | "emoji-temp" | "temp-only";

type ClockProps = {
  weatherFormat: WeatherFormat;
  onMoonPhaseChange?: (phase: number | null) => void;
};

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunder and hail",
  99: "Thunder and hail",
};

const WEATHER_EMOJI: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  77: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  85: "🌨️",
  86: "❄️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function fallbackMoonPhase(now = new Date()): number {
  // Approximate synodic month progression, good enough for icon display.
  const synodicMonth = 29.53058867;
  const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14, 0);
  const daysSince = (now.getTime() - knownNewMoonUtc) / 86400000;
  const phaseDays = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
  return phaseDays / synodicMonth;
}

function getNowForTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const getNum = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const year = getNum("year");
  const month = getNum("month");
  const day = getNum("day");
  const hour = getNum("hour");
  const minute = getNum("minute");
  const second = getNum("second");
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function resolveMoonPhaseFromTimezone(timeZone: string | null): number {
  if (!timeZone) return fallbackMoonPhase();
  try {
    return fallbackMoonPhase(getNowForTimeZone(timeZone));
  } catch {
    return fallbackMoonPhase();
  }
}

function formatWeather(code: number | null, tempC: number | null, format: WeatherFormat): string {
  if (tempC == null) return "Weather unavailable";
  const temp = `${Math.round(tempC)}°C`;
  if (format === "temp-only") return temp;
  if (format === "emoji-temp") {
    const emoji = code != null ? (WEATHER_EMOJI[code] ?? "🌤️") : "🌤️";
    return `${emoji} ${temp}`;
  }
  const label = code != null ? (WEATHER_LABELS[code] ?? "Weather") : "Weather";
  return `${label} ${temp}`;
}

export function Clock({ weatherFormat, onMoonPhaseChange }: ClockProps) {
  const [time, setTime] = useState<Date | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [hasLocationAccess, setHasLocationAccess] = useState<boolean | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshId: ReturnType<typeof setInterval> | null = null;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationReady(true);
      setHasLocationAccess(false);
      onMoonPhaseChange?.(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        setHasLocationAccess(true);
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const refresh = async () => {
          try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch weather");
            const data = await res.json();
            if (cancelled) return;
            const nextTemp =
              typeof data?.current?.temperature_2m === "number"
                ? data.current.temperature_2m
                : typeof data?.current_weather?.temperature === "number"
                  ? data.current_weather.temperature
                  : null;
            const nextCode =
              typeof data?.current?.weather_code === "number"
                ? data.current.weather_code
                : typeof data?.current_weather?.weathercode === "number"
                  ? data.current_weather.weathercode
                  : null;
            const nextTz = typeof data?.timezone === "string" ? data.timezone : null;
            setTemperatureC(nextTemp);
            setWeatherCode(nextCode);
            setTimezone(nextTz);
            onMoonPhaseChange?.(resolveMoonPhaseFromTimezone(nextTz));
          } catch {
            onMoonPhaseChange?.(resolveMoonPhaseFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null));
          } finally {
            if (!cancelled) setLocationReady(true);
          }
        };
        await refresh();
        if (!cancelled) {
          refreshId = setInterval(() => {
            void refresh();
          }, 10 * 60 * 1000);
        }
      },
      () => {
        if (cancelled) return;
        setLocationReady(true);
        setHasLocationAccess(false);
        setTemperatureC(null);
        setWeatherCode(null);
        onMoonPhaseChange?.(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 }
    );
    return () => {
      cancelled = true;
      if (refreshId) clearInterval(refreshId);
    };
  }, [onMoonPhaseChange]);

  if (!time) return null;

  const nowText = timezone
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timezone }).format(time)
    : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(time);
  const weatherText = locationReady ? formatWeather(weatherCode, temperatureC, weatherFormat) : "Locating...";
  const shouldShowWeather = hasLocationAccess === true;

  return (
    <time
      dateTime={time.toISOString()}
      className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
    >
      {shouldShowWeather ? `${nowText} | ${weatherText}` : nowText}
    </time>
  );
}
