import { API_BASE } from "../shared/config";

const API_PREFIX = "/api/extension";

async function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response?.token ?? null);
    });
  });
}

export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  const url = `${API_BASE}${API_PREFIX}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    let errorMessage = `Request failed (${res.status})`;

    if (contentType.includes("application/json")) {
      const err = await res
        .json()
        .catch(() => ({ error: res.statusText || errorMessage }));
      errorMessage =
        (err as { error?: string; message?: string }).error ||
        (err as { error?: string; message?: string }).message ||
        errorMessage;
    } else {
      const bodyText = await res.text().catch(() => "");
      // Avoid dumping full HTML pages into alerts.
      if (bodyText && !bodyText.trimStart().startsWith("<!DOCTYPE")) {
        errorMessage = bodyText.slice(0, 200);
      }
    }

    throw new Error(errorMessage);
  }
  return res.json();
}
