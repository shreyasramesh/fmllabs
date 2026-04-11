import { Capacitor, registerPlugin } from "@capacitor/core";

type WidgetDataPlugin = {
  syncAuth(options: { url: string }): Promise<void>;
  refreshWidget(): Promise<void>;
};

const WidgetData = registerPlugin<WidgetDataPlugin>("WidgetData");

function isSupported(): boolean {
  return Capacitor.getPlatform() === "android";
}

export async function syncWidgetAuth(): Promise<void> {
  if (!isSupported()) return;
  try {
    await WidgetData.syncAuth({ url: "https://www.fmllabs.ai" });
  } catch {
    // silently ignore on platforms where plugin is unavailable
  }
}

export async function refreshCalorieWidget(): Promise<void> {
  if (!isSupported()) return;
  try {
    await WidgetData.refreshWidget();
  } catch {
    // silently ignore
  }
}
