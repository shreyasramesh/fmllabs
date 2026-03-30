import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type PomodoroLiveState = {
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
  completed: boolean;
  source: string;
};

type PomodoroLivePlugin = {
  start(options: { durationSeconds: number; remainingSeconds: number }): Promise<void>;
  resume(options: { durationSeconds: number; remainingSeconds: number }): Promise<void>;
  pause(): Promise<void>;
  reset(options: { durationSeconds: number }): Promise<void>;
  end(): Promise<void>;
  stop(): Promise<void>;
  getState(): Promise<PomodoroLiveState>;
  addListener(
    eventName: "pomodoroStateChanged",
    listener: (state: PomodoroLiveState) => void
  ): Promise<PluginListenerHandle>;
};

const PomodoroLive = registerPlugin<PomodoroLivePlugin>("PomodoroLive");

export function isNativePomodoroLiveSupported(): boolean {
  return Capacitor.getPlatform() === "android";
}

export async function startNativePomodoroLive(
  durationSeconds: number,
  remainingSeconds: number
): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.start({ durationSeconds, remainingSeconds });
}

export async function resumeNativePomodoroLive(
  durationSeconds: number,
  remainingSeconds: number
): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.resume({ durationSeconds, remainingSeconds });
}

export async function pauseNativePomodoroLive(): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.pause();
}

export async function resetNativePomodoroLive(durationSeconds: number): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.reset({ durationSeconds });
}

export async function endNativePomodoroLive(): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.end();
}

export async function stopNativePomodoroLive(): Promise<void> {
  if (!isNativePomodoroLiveSupported()) return;
  await PomodoroLive.stop();
}

export async function getNativePomodoroLiveState(): Promise<PomodoroLiveState | null> {
  if (!isNativePomodoroLiveSupported()) return null;
  return PomodoroLive.getState();
}

export async function addNativePomodoroLiveListener(
  listener: (state: PomodoroLiveState) => void
): Promise<PluginListenerHandle | null> {
  if (!isNativePomodoroLiveSupported()) return null;
  return PomodoroLive.addListener("pomodoroStateChanged", listener);
}

export type { PomodoroLiveState };
