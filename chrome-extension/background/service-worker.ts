import { createClerkClient } from "@clerk/chrome-extension/background";

const publishableKey = typeof __CLERK_PUBLISHABLE_KEY__ !== "undefined"
  ? __CLERK_PUBLISHABLE_KEY__
  : "";

let clerkClient: Awaited<ReturnType<typeof createClerkClient>> | null = null;

async function getClerkClient() {
  if (!clerkClient) {
    clerkClient = await createClerkClient({
      publishableKey,
      background: true,
      syncHost: API_BASE,
    } as never);
  }
  return clerkClient;
}

const API_BASE =
  typeof __API_BASE__ !== "undefined" ? __API_BASE__ : "https://fmllabs.ai";
const API_PREFIX = "/api/extension";

// Make extension icon open the side panel persistently.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // No-op: keep service worker resilient on unsupported/older environments.
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // No-op: keep service worker resilient on unsupported/older environments.
  });
});

async function apiRequest(path: string, init: RequestInit): Promise<Response> {
  const clerk = await getClerkClient();
  let token = await clerk.session?.getToken();
  if (!token) {
    // Force-refresh token path for cases where background cache is stale.
    try {
      await clerk.load?.();
    } catch {
      // ignore and retry token read below
    }
    token = await clerk.session?.getToken({ skipCache: true } as never);
  }
  if (!token) {
    return new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
    });
  }
  let res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  });
  // Retry once on auth-related failures with a fresh token.
  if (res.status === 401 || res.status === 422) {
    const refreshedToken = await clerk.session?.getToken({ skipCache: true } as never);
    if (refreshedToken && refreshedToken !== token) {
      res = await fetch(`${API_BASE}${API_PREFIX}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshedToken}`,
          ...(init.headers as Record<string, string>),
        },
      });
    }
  }
  return res;
}

function openChatSidePanelNow(windowId?: number) {
  if (typeof windowId === "number") {
    return chrome.sidePanel.open({ windowId });
  }
  return Promise.resolve();
}

async function runContentActionInBackground(
  action: "nugget" | "concept" | "model",
  text: string,
  url?: string
) {
  if (action === "nugget") {
    const res = await apiRequest("/me/nuggets", {
      method: "POST",
      body: JSON.stringify({
        content: text,
        source: url || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to save nugget");
    }
    return;
  }

  if (action === "concept") {
    const genRes = await apiRequest("/me/custom-concepts/generate", {
      method: "POST",
      body: JSON.stringify({ userInput: text }),
    });
    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to generate concept");
    }
    const generated = await genRes.json();
    const saveRes = await apiRequest("/me/custom-concepts", {
      method: "POST",
      body: JSON.stringify({
        title: generated.title,
        summary: generated.summary,
        enrichmentPrompt: generated.enrichmentPrompt,
      }),
    });
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to save concept");
    }
    return;
  }

  const genRes = await apiRequest("/me/mental-models/generate", {
    method: "POST",
    body: JSON.stringify({ userInput: text, language: "en" }),
  });
  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to generate mental model");
  }
  const generatedModel = await genRes.json();
  const saveRes = await apiRequest("/me/mental-models", {
    method: "POST",
    body: JSON.stringify({ model: generatedModel }),
  });
  if (!saveRes.ok) {
    const err = await saveRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to save mental model");
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; action?: string; text?: string; url?: string },
    sender,
    sendResponse: (response: {
      token?: string | null;
      ok?: boolean;
      error?: string;
    }) => void
  ) => {
    if (message.type === "GET_TOKEN") {
      getClerkClient()
        .then((clerk) => clerk.session?.getToken())
        .then((token) => sendResponse({ token: token ?? null }))
        .catch(() => sendResponse({ token: null }));
      return true;
    }

    if (message.type === "CONTENT_ACTION" && message.action && message.text) {
      const run = async () => {
        try {
          if (message.action === "ask") {
            const windowId = (sender.tab as chrome.tabs.Tab | undefined)?.windowId;
            const openPromise = openChatSidePanelNow(windowId);
            chrome.storage.session.set({
              fmlPendingAskText: message.text,
              fmlPendingOpenTab: "chat",
            });
            await openPromise;
            sendResponse({ ok: true });
          } else if (
            message.action === "nugget" ||
            message.action === "concept" ||
            message.action === "model"
          ) {
            try {
              const text = message.text || "";
              await runContentActionInBackground(
                message.action as "nugget" | "concept" | "model",
                text,
                message.url
              );
              sendResponse({ ok: true });
            } catch (err) {
              sendResponse({
                error: (err as Error).message,
              });
            }
          } else {
            sendResponse({ error: "Unknown action" });
          }
        } catch (e) {
          sendResponse({ error: (e as Error).message });
        }
      };
      run();
      return true;
    }

    if (message.type === "OPEN_CHAT_FROM_PAGE") {
      const run = async () => {
        try {
          const windowId = (sender.tab as chrome.tabs.Tab | undefined)?.windowId;
          const openPromise = openChatSidePanelNow(windowId);
          if (message.text) {
            chrome.storage.session.set({
              fmlPendingAskText: message.text,
              fmlPendingOpenTab: "chat",
            });
          } else {
            chrome.storage.session.set({ fmlPendingOpenTab: "chat" });
          }
          await openPromise;
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ error: (e as Error).message });
        }
      };
      run();
      return true;
    }

    if (message.type === "EXTRACT_YOUTUBE_CONCEPTS" && message.url) {
      const run = async () => {
        try {
          const windowId = (sender.tab as chrome.tabs.Tab | undefined)?.windowId;
          const openPromise = openChatSidePanelNow(windowId);
          chrome.storage.session.set({
            fmlPendingOpenTab: "concepts",
            fmlPendingYoutubeUrl: message.url,
          });

          await openPromise;
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ error: (e as Error).message });
        }
      };
      run();
      return true;
    }

    return false;
  }
);
