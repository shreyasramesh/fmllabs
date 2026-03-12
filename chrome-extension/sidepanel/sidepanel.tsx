import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import {
  ClerkProvider,
  useAuth,
  useUser,
  SignIn,
} from "@clerk/chrome-extension";
import { apiFetch, apiJson } from "../lib/api";
import { stripContextBlock } from "../lib/stream-utils";
import type { Nugget, CustomConcept, ConceptGroup, Session, ChatMessage } from "../shared/types";
import { useRef } from "react";

const publishableKey =
  typeof __CLERK_PUBLISHABLE_KEY__ !== "undefined" ? __CLERK_PUBLISHABLE_KEY__ : "";
const sidepanelUrl = chrome.runtime.getURL("sidepanel/sidepanel.html");

type Tab = "nuggets" | "concepts" | "chat";
type ThemeMode = "light" | "dark";

function resolveInitialTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type SessionMessage = {
  role: "user" | "assistant";
  content: string;
};

type PendingContentAction = {
  action: "nugget" | "concept" | "model";
  text: string;
  url?: string;
};

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => Promise<void>;
};

function humanizeReferenceToken(token: string): string {
  const strippedIdPrefix = token.replace(/^id:/i, "").trim();
  const humanized = strippedIdPrefix
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = humanized.replace(/\s+/g, "");
  const hasOnlySimpleChars = /^[a-z0-9_-]+$/i.test(compact);
  const looksLongId = compact.length >= 12;
  const vowelCount = (compact.match(/[aeiou]/gi) || []).length;
  const vowelRatio = compact.length > 0 ? vowelCount / compact.length : 0;
  const digitCount = (compact.match(/\d/g) || []).length;
  const digitRatio = compact.length > 0 ? digitCount / compact.length : 0;
  const looksOpaque =
    hasOnlySimpleChars &&
    looksLongId &&
    (vowelRatio < 0.2 || digitRatio > 0.35);
  if (looksOpaque) return "referenced item";
  return humanized;
}

function formatReferenceItems(content: string): string {
  return content.replace(/\[\[([^[\]]+)\]\]/g, (_full, token: string) => {
    const label = humanizeReferenceToken(token) || token;
    return `**${label}**`;
  });
}

function normalizeAssistantContent(raw: string): string {
  const withoutStreamContext = stripContextBlock(raw);
  const marker = "\n---RELEVANT-CONTEXT---";
  const markerIdx = withoutStreamContext.indexOf(marker);
  const cleaned = markerIdx >= 0
    ? withoutStreamContext.slice(0, markerIdx).trimEnd()
    : withoutStreamContext;
  return formatReferenceItems(formatOptionsBlock(cleaned));
}

const OPTIONS_MARKER_REGEX = /-{2,3}\s*OPTIONS\s*-{2,3}/i;

function normalizeOptionText(line: string): string {
  const stripped = line
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\[\[([^[\]]+)\]\]/g, (_full, token: string) => humanizeReferenceToken(token))
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim();
  const bracketed = stripped.match(/^\[(.*)\]$/);
  return bracketed ? bracketed[1].trim() : stripped;
}

function extractAssistantRenderPayload(content: string): { text: string; options: string[] } {
  const markerMatch = content.match(OPTIONS_MARKER_REGEX);
  if (markerMatch && markerMatch.index !== undefined) {
    const text = content.slice(0, markerMatch.index).trimEnd();
    const options = content
      .slice(markerMatch.index + markerMatch[0].length)
      .split(/\r?\n/)
      .map(normalizeOptionText)
      .filter((line) => line.length > 0 && !/^-{3,}$/.test(line))
      .slice(0, 6);
    return { text, options };
  }

  const optionsHeader = /\*\*Options\*\*/i;
  const headerMatch = content.match(optionsHeader);
  if (!headerMatch || headerMatch.index === undefined) {
    return { text: content, options: [] };
  }

  const beforeHeader = content.slice(0, headerMatch.index).trimEnd();
  const afterHeader = content.slice(headerMatch.index + headerMatch[0].length).trimStart();
  const lines = afterHeader.split(/\r?\n/);
  const options: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const option = normalizeOptionText(trimmed);
      if (option) options.push(option);
      if (options.length >= 6) break;
      continue;
    }
    break;
  }

  if (options.length === 0) {
    return { text: content, options: [] };
  }

  return { text: beforeHeader, options };
}

function formatOptionsBlock(content: string): string {
  const match = content.match(OPTIONS_MARKER_REGEX);
  if (!match || match.index === undefined) return content;

  const text = content.slice(0, match.index).trim();
  const rawOptionsSection = content.slice(match.index + match[0].length).trim();
  const options = rawOptionsSection
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^[-*]\s*/, "")
        .replace(/^\d+\.\s*/, "")
        .trim()
    )
    .filter((line) => line.length > 0 && !/^-{3,}$/.test(line))
    .slice(0, 6);

  if (options.length === 0) return text || content;
  return `${text}\n\n**Options**\n${options.map((option) => `- ${option}`).join("\n")}`.trim();
}

function SidepanelContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("nuggets");

  const [nuggets, setNuggets] = useState<Nugget[]>([]);
  const [nuggetContent, setNuggetContent] = useState("");
  const [nuggetSource, setNuggetSource] = useState("");
  const [nuggetLoading, setNuggetLoading] = useState(false);
  const [deletingNuggetId, setDeletingNuggetId] = useState<string | null>(null);

  const [conceptContent, setConceptContent] = useState("");
  const [conceptLoading, setConceptLoading] = useState(false);
  const [conceptSaved, setConceptSaved] = useState(false);
  const [concepts, setConcepts] = useState<CustomConcept[]>([]);
  const [conceptGroups, setConceptGroups] = useState<ConceptGroup[]>([]);
  const [selectedConceptGroupFilter, setSelectedConceptGroupFilter] = useState<string>("__ALL__");
  const [deletingConceptId, setDeletingConceptId] = useState<string | null>(null);
  const [youtubeExtractLoading, setYoutubeExtractLoading] = useState(false);
  const [youtubeExtractNotice, setYoutubeExtractNotice] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);
  const [contentActionNotice, setContentActionNotice] = useState<string | null>(null);
  const [uiNotice, setUiNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const contentActionInFlightKey = useRef<string | null>(null);
  const uiNoticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((text: string, type: "error" | "success" = "error") => {
    if (uiNoticeTimerRef.current) {
      window.clearTimeout(uiNoticeTimerRef.current);
      uiNoticeTimerRef.current = null;
    }
    setUiNotice({ type, text });
    uiNoticeTimerRef.current = window.setTimeout(() => {
      setUiNotice(null);
      uiNoticeTimerRef.current = null;
    }, 2600);
  }, []);

  const fetchNuggets = useCallback(async () => {
    try {
      const data = await apiJson<Nugget[]>("/me/nuggets");
      setNuggets(Array.isArray(data) ? data : []);
    } catch {
      setNuggets([]);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiJson<Session[]>("/sessions");
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    }
  }, []);

  const fetchConceptGroups = useCallback(async () => {
    try {
      const data = await apiJson<ConceptGroup[]>("/me/concept-groups");
      setConceptGroups(Array.isArray(data) ? data : []);
    } catch {
      setConceptGroups([]);
    }
  }, []);

  const fetchConcepts = useCallback(async () => {
    try {
      const data = await apiJson<CustomConcept[]>("/me/custom-concepts");
      setConcepts(Array.isArray(data) ? data : []);
    } catch {
      setConcepts([]);
    }
  }, []);

  const runYoutubeExtraction = useCallback(
    async (url: string) => {
      if (!url.trim()) return;
      setTab("concepts");
      setYoutubeExtractLoading(true);
      setYoutubeExtractNotice("Extracting concepts from transcript...");
      try {
        const extracted = await apiJson<{
          groups?: Array<{
            domain: string;
            concepts: Array<{
              title: string;
              summary: string;
              enrichmentPrompt: string;
            }>;
          }>;
        }>("/me/custom-concepts/from-youtube", {
          method: "POST",
          body: JSON.stringify({ url, language: "en" }),
        });
        const groups = extracted.groups || [];
        for (const group of groups) {
          const validConcepts = (group.concepts || []).filter(
            (c) =>
              typeof c.title === "string" &&
              c.title.trim() &&
              typeof c.summary === "string" &&
              c.summary.trim() &&
              typeof c.enrichmentPrompt === "string" &&
              c.enrichmentPrompt.trim()
          );
          if (validConcepts.length === 0) continue;
          await apiFetch("/me/concept-groups", {
            method: "POST",
            body: JSON.stringify({
              domain: group.domain,
              concepts: validConcepts,
            }),
          });
        }
        await Promise.all([fetchConceptGroups(), fetchConcepts()]);
        setYoutubeExtractNotice("Concept extraction complete. Check Concepts below.");
      } catch (e) {
        setYoutubeExtractNotice(`Extraction failed: ${(e as Error).message}`);
      } finally {
        setYoutubeExtractLoading(false);
      }
    },
    [fetchConceptGroups, fetchConcepts]
  );

  const runPendingContentAction = useCallback(
    async (pendingAction: PendingContentAction) => {
      const action = pendingAction.action;
      const text = pendingAction.text?.trim();
      if (!text) return;

      const key = `${action}:${text}:${pendingAction.url || ""}`;
      if (contentActionInFlightKey.current === key) return;
      contentActionInFlightKey.current = key;

      try {
        if (action === "nugget") {
          await apiFetch("/me/nuggets", {
            method: "POST",
            body: JSON.stringify({
              content: text,
              source: pendingAction.url?.trim() || undefined,
            }),
          });
          setTab("nuggets");
          setContentActionNotice("Saved nugget from highlighted text.");
          fetchNuggets();
        } else if (action === "concept") {
          const generated = await apiJson<{
            title: string;
            summary: string;
            enrichmentPrompt: string;
          }>("/me/custom-concepts/generate", {
            method: "POST",
            body: JSON.stringify({ userInput: text }),
          });
          await apiFetch("/me/custom-concepts", {
            method: "POST",
            body: JSON.stringify({
              title: generated.title,
              summary: generated.summary,
              enrichmentPrompt: generated.enrichmentPrompt,
            }),
          });
          setTab("concepts");
          setContentActionNotice("Saved concept from highlighted text.");
          fetchConcepts();
        } else if (action === "model") {
          const generatedModel = await apiJson<Record<string, unknown>>(
            "/me/mental-models/generate",
            {
              method: "POST",
              body: JSON.stringify({ userInput: text, language: "en" }),
            }
          );
          await apiFetch("/me/mental-models", {
            method: "POST",
            body: JSON.stringify({ model: generatedModel }),
          });
          setContentActionNotice("Created mental model from highlighted text.");
        }
        chrome.storage.session.remove(["fmlPendingContentAction"]);
      } catch (e) {
        setContentActionNotice(`Action failed: ${(e as Error).message}`);
      } finally {
        contentActionInFlightKey.current = null;
      }
    },
    [fetchConcepts, fetchNuggets]
  );

  const fetchSessionMessages = useCallback(
    async (id: string) => {
      try {
        const data = await apiJson<{ messages?: SessionMessage[] }>(`/sessions/${id}`);
        const nextMessages = (data.messages || [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role,
            content:
              m.role === "assistant" ? normalizeAssistantContent(m.content) : m.content,
          }));
        setMessages(nextMessages);
      } catch {
        // Ignore transient sync errors; keep current chat view.
      }
    },
    []
  );

  useEffect(() => {
    if (isSignedIn && tab === "nuggets") fetchNuggets();
  }, [isSignedIn, tab, fetchNuggets]);

  useEffect(() => {
    if (!isSignedIn || tab !== "nuggets") return;
    const interval = window.setInterval(() => {
      fetchNuggets();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isSignedIn, tab, fetchNuggets]);

  useEffect(() => {
    if (isSignedIn && tab === "chat") fetchSessions();
  }, [isSignedIn, tab, fetchSessions]);

  useEffect(() => {
    if (isSignedIn && tab === "concepts") fetchConceptGroups();
  }, [isSignedIn, tab, fetchConceptGroups]);

  useEffect(() => {
    if (isSignedIn && tab === "concepts") fetchConcepts();
  }, [isSignedIn, tab, fetchConcepts]);

  useEffect(() => {
    if (!isSignedIn || tab !== "concepts") return;
    const interval = window.setInterval(() => {
      fetchConceptGroups();
      fetchConcepts();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isSignedIn, tab, fetchConceptGroups, fetchConcepts]);

  useEffect(() => {
    if (selectedConceptGroupFilter === "__ALL__" || selectedConceptGroupFilter === "__UNGROUPED__") {
      return;
    }
    const exists = conceptGroups.some((g) => g._id === selectedConceptGroupFilter);
    if (!exists) setSelectedConceptGroupFilter("__ALL__");
  }, [conceptGroups, selectedConceptGroupFilter]);

  useEffect(() => {
    // Avoid clobbering optimistic user/assistant rows while a send is in-flight.
    if (isSignedIn && tab === "chat" && sessionId && !chatLoading) {
      fetchSessionMessages(sessionId);
    }
  }, [isSignedIn, tab, sessionId, chatLoading, fetchSessionMessages]);

  useEffect(() => {
    if (!isSignedIn || tab !== "chat" || !sessionId) return;
    const interval = window.setInterval(() => {
      if (!chatLoading) {
        fetchSessionMessages(sessionId);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isSignedIn, tab, sessionId, chatLoading, fetchSessionMessages]);

  useEffect(() => {
    chrome.storage.session.get(
      [
        "fmlPendingAskText",
        "fmlPendingOpenTab",
        "fmlPendingYoutubeUrl",
        "fmlPendingContentAction",
      ],
      (data) => {
      if (data.fmlPendingOpenTab === "chat" || data.fmlPendingAskText) {
        setTab("chat");
      } else if (data.fmlPendingOpenTab === "concepts") {
        setTab("concepts");
      } else if (data.fmlPendingOpenTab === "nuggets") {
        setTab("nuggets");
      }
      if (data.fmlPendingAskText) {
        setChatInput(data.fmlPendingAskText);
      }
      if (typeof data.fmlPendingYoutubeUrl === "string" && data.fmlPendingYoutubeUrl.trim()) {
        runYoutubeExtraction(data.fmlPendingYoutubeUrl);
      }
      const pendingAction = data.fmlPendingContentAction as PendingContentAction | undefined;
      if (
        isSignedIn &&
        pendingAction &&
        typeof pendingAction.action === "string" &&
        typeof pendingAction.text === "string"
      ) {
        runPendingContentAction(pendingAction);
      }
      chrome.storage.session.remove([
        "fmlPendingAskText",
        "fmlPendingOpenTab",
        "fmlPendingYoutubeUrl",
      ]);
    });
  }, [isSignedIn, runPendingContentAction, runYoutubeExtraction]);

  useEffect(() => {
    const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== "session") return;
      const pendingTab = changes.fmlPendingOpenTab?.newValue as string | undefined;
      const pendingText = changes.fmlPendingAskText?.newValue as string | undefined;
      const pendingYoutubeUrl = changes.fmlPendingYoutubeUrl?.newValue as string | undefined;
      const pendingContentAction = changes.fmlPendingContentAction
        ?.newValue as PendingContentAction | undefined;
      if (pendingTab === "chat" || pendingText) {
        setTab("chat");
      } else if (pendingTab === "concepts") {
        setTab("concepts");
      } else if (pendingTab === "nuggets") {
        setTab("nuggets");
      }
      if (typeof pendingText === "string" && pendingText.trim()) {
        setChatInput(pendingText);
      }
      if (typeof pendingYoutubeUrl === "string" && pendingYoutubeUrl.trim()) {
        runYoutubeExtraction(pendingYoutubeUrl);
      }
      if (
        isSignedIn &&
        pendingContentAction &&
        typeof pendingContentAction.action === "string" &&
        typeof pendingContentAction.text === "string"
      ) {
        runPendingContentAction(pendingContentAction);
      }
      if (pendingTab === "chat" || pendingText || pendingYoutubeUrl) {
        chrome.storage.session.remove([
          "fmlPendingAskText",
          "fmlPendingOpenTab",
          "fmlPendingYoutubeUrl",
        ]);
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, [isSignedIn, runPendingContentAction, runYoutubeExtraction]);

  useEffect(() => {
    if (!isSignedIn) return;
    chrome.storage.session.get(["fmlPendingContentAction"], (data) => {
      const pendingAction = data.fmlPendingContentAction as PendingContentAction | undefined;
      if (
        pendingAction &&
        typeof pendingAction.action === "string" &&
        typeof pendingAction.text === "string"
      ) {
        runPendingContentAction(pendingAction);
      }
    });
  }, [isSignedIn, runPendingContentAction]);

  useEffect(() => {
    chrome.storage.local.get("fmlTheme", (data) => {
      const stored = data.fmlTheme as ThemeMode | undefined;
      const next = stored === "dark" || stored === "light" ? stored : resolveInitialTheme();
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    });

    const onStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== "local" || !changes.fmlTheme?.newValue) return;
      const next = changes.fmlTheme.newValue as ThemeMode;
      if (next === "dark" || next === "light") {
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
      }
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  useEffect(() => {
    return () => {
      if (uiNoticeTimerRef.current) {
        window.clearTimeout(uiNoticeTimerRef.current);
      }
    };
  }, []);

  const setThemeAndPersist = (next: ThemeMode) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    chrome.storage.local.set({ fmlTheme: next });
  };

  const saveNugget = async () => {
    if (!nuggetContent.trim() || nuggetLoading) return;
    setNuggetLoading(true);
    try {
      await apiFetch("/me/nuggets", {
        method: "POST",
        body: JSON.stringify({
          content: nuggetContent.trim(),
          source: nuggetSource.trim() || undefined,
        }),
      });
      setNuggetContent("");
      setNuggetSource("");
      fetchNuggets();
    } catch (e) {
      showNotice((e as Error).message, "error");
    } finally {
      setNuggetLoading(false);
    }
  };

  const saveConcept = async () => {
    if (!conceptContent.trim() || conceptLoading) return;
    setConceptLoading(true);
    setConceptSaved(false);
    try {
      const generated = await apiJson<{
        title: string;
        summary: string;
        enrichmentPrompt: string;
      }>("/me/custom-concepts/generate", {
        method: "POST",
        body: JSON.stringify({ userInput: conceptContent.trim() }),
      });
      await apiFetch("/me/custom-concepts", {
        method: "POST",
        body: JSON.stringify({
          title: generated.title,
          summary: generated.summary,
          enrichmentPrompt: generated.enrichmentPrompt,
        }),
      });
      setConceptContent("");
      setConceptSaved(true);
      fetchConcepts();
      setTimeout(() => setConceptSaved(false), 2000);
    } catch (e) {
      showNotice((e as Error).message, "error");
    } finally {
      setConceptLoading(false);
    }
  };

  const deleteNuggetById = async (id: string) => {
    setDeletingNuggetId(id);
    try {
      await apiFetch(`/me/nuggets/${id}`, { method: "DELETE" });
      fetchNuggets();
    } catch (e) {
      showNotice((e as Error).message, "error");
    } finally {
      setDeletingNuggetId(null);
    }
  };

  const requestDeleteNuggetById = (id: string) => {
    if (!id || deletingNuggetId) return;
    setConfirmDialog({
      title: "Delete nugget?",
      message: "This nugget will be permanently removed.",
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: () => deleteNuggetById(id),
    });
  };

  const deleteConceptById = async (id: string) => {
    setDeletingConceptId(id);
    try {
      await apiFetch(`/me/custom-concepts/${id}`, { method: "DELETE" });
      await Promise.all([fetchConcepts(), fetchConceptGroups()]);
    } catch (e) {
      showNotice((e as Error).message, "error");
    } finally {
      setDeletingConceptId(null);
    }
  };

  const requestDeleteConceptById = (id: string) => {
    if (!id || deletingConceptId) return;
    setConfirmDialog({
      title: "Delete concept?",
      message: "This concept will be permanently removed.",
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: () => deleteConceptById(id),
    });
  };

  const deleteSessionById = async (id: string) => {
    setDeletingSessionId(id);
    try {
      await apiFetch(`/sessions/${id}`, { method: "DELETE" });
      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }
      fetchSessions();
    } catch (e) {
      showNotice((e as Error).message, "error");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const requestDeleteSessionById = (id: string) => {
    if (!id || deletingSessionId) return;
    setConfirmDialog({
      title: "Delete conversation?",
      message: "This conversation will be permanently removed.",
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: () => deleteSessionById(id),
    });
  };

  const sendChatMessage = async (overrideText?: string) => {
    if (chatLoading) return;
    const text = (overrideText ?? chatInput).trim();
    if (!text) return;
    if (overrideText) {
      setChatInput("");
    } else {
      setChatInput("");
    }
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);

    let newSessionId = sessionId;
    if (!newSessionId) {
      try {
        const newSession = await apiJson<Session>("/sessions", {
          method: "POST",
          body: JSON.stringify({}),
        });
        newSessionId = newSession._id;
        setSessionId(newSessionId);
        setSessions((prev) => [...prev, newSession]);
      } catch {
        setChatLoading(false);
        setMessages((prev) => prev.slice(0, -1));
        showNotice("Failed to create session", "error");
        return;
      }
    }

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          sessionId: newSessionId,
          language: "en",
          userType: "millennial",
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      if (!res.body) throw new Error("No body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const content = normalizeAssistantContent(accumulated);
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, content };
          }
          return next;
        });
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: `Error: ${(e as Error).message}`,
          };
        }
        return next;
      });
    } finally {
      setChatLoading(false);
      if (newSessionId) {
        fetchSessions();
        fetchSessionMessages(newSessionId);
      }
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setChatInput("");
    setChatLoading(false);
  };

  if (!isLoaded) {
    return <p>Loading…</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex">
        <div className="topbar">
          <h1>FigureMyLife Labs</h1>
          <div className="theme-switch" role="tablist" aria-label="Theme">
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setThemeAndPersist("light")}
            >
              Light
            </button>
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setThemeAndPersist("dark")}
            >
              Dark
            </button>
          </div>
        </div>
        <div className="card">
          <p className="meta auth-note">Sign in to use the side panel.</p>
          <SignIn
            fallbackRedirectUrl={sidepanelUrl}
            signUpFallbackRedirectUrl={sidepanelUrl}
            signUpUrl={sidepanelUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="topbar">
        <h1>FigureMyLife Labs</h1>
        <div className="theme-switch" role="tablist" aria-label="Theme">
          <button
            className={theme === "light" ? "active" : ""}
            onClick={() => setThemeAndPersist("light")}
          >
            Light
          </button>
          <button
            className={theme === "dark" ? "active" : ""}
            onClick={() => setThemeAndPersist("dark")}
          >
            Dark
          </button>
        </div>
      </div>
      <p className="meta">
        Hi, {user?.firstName || user?.emailAddresses[0]?.emailAddress || "there"}!
      </p>
      {uiNotice && (
        <p className={`notice ${uiNotice.type === "error" ? "error" : "success"}`}>
          {uiNotice.text}
        </p>
      )}
      {contentActionNotice && (
        <p
          className={`notice ${
            contentActionNotice.toLowerCase().includes("failed") ? "error" : "success"
          }`}
        >
          {contentActionNotice}
        </p>
      )}

      <div className="tabs">
        <button
          className={tab === "nuggets" ? "active" : ""}
          onClick={() => setTab("nuggets")}
        >
          Nuggets
        </button>
        <button
          className={tab === "concepts" ? "active" : ""}
          onClick={() => setTab("concepts")}
        >
          Concepts
        </button>
        <button
          className={tab === "chat" ? "active" : ""}
          onClick={() => setTab("chat")}
        >
          Chat
        </button>
      </div>

      {tab === "nuggets" && (
        <>
          <div className="card">
            <h2>Add Nugget</h2>
            <div className="form-stack">
              <textarea
                placeholder="Paste or type your nugget..."
                value={nuggetContent}
                onChange={(e) => setNuggetContent(e.target.value)}
                rows={3}
              />
              <input
                type="text"
                placeholder="Source (optional)"
                value={nuggetSource}
                onChange={(e) => setNuggetSource(e.target.value)}
              />
              <button
                className="primary"
                onClick={saveNugget}
                disabled={!nuggetContent.trim() || nuggetLoading}
              >
                {nuggetLoading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <div>
            <h2 className="section-title">Your Nuggets</h2>
            {nuggets.length === 0 ? (
              <p className="meta">No nuggets yet.</p>
            ) : (
              nuggets.map((n) => (
                <div key={n._id} className="card">
                  <div className="item-header">
                    <p className="item-title">Nugget</p>
                    <button
                        onClick={() => requestDeleteNuggetById(n._id)}
                      disabled={deletingNuggetId === n._id}
                      title="Delete nugget"
                      aria-label="Delete nugget"
                      className="btn-sm"
                    >
                      {deletingNuggetId === n._id ? "…" : "Delete"}
                    </button>
                  </div>
                  <p className="item-body">{n.content}</p>
                  {n.source && (
                    <p className="item-subtle">
                      {n.source}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "concepts" && (
        <>
          {youtubeExtractNotice && (
            <p
              className={`notice ${
                youtubeExtractNotice.toLowerCase().includes("failed") ? "error" : ""
              }`}
            >
              {youtubeExtractNotice}
            </p>
          )}
          {youtubeExtractLoading && (
            <p className="meta">
              This can take up to ~30 seconds depending on transcript length.
            </p>
          )}
          <div className="card">
            <h2>Save as Concept</h2>
            <p className="meta">
              Paste text from any webpage. We'll generate a concept and save it.
            </p>
            <div className="form-stack">
              <textarea
                placeholder="Paste text here..."
                value={conceptContent}
                onChange={(e) => setConceptContent(e.target.value)}
                rows={4}
              />
              <button
                className="primary"
                onClick={saveConcept}
                disabled={!conceptContent.trim() || conceptLoading}
              >
                {conceptLoading ? "Generating…" : conceptSaved ? "Saved!" : "Generate & Save"}
              </button>
            </div>
          </div>
          <div className="section">
            <h2 className="section-title">Saved Concepts</h2>
            {(() => {
              const conceptsWithGroups = concepts.map((concept) => {
                const groups = conceptGroups.filter(
                  (group) =>
                    Array.isArray(group.conceptIds) &&
                    group.conceptIds.includes(concept._id)
                );
                return { concept, groups };
              });

              const hasUngrouped = conceptsWithGroups.some(({ groups }) => groups.length === 0);
              const filteredConcepts =
                selectedConceptGroupFilter === "__ALL__"
                  ? conceptsWithGroups
                  : selectedConceptGroupFilter === "__UNGROUPED__"
                    ? conceptsWithGroups.filter(({ groups }) => groups.length === 0)
                    : conceptsWithGroups.filter(({ groups }) =>
                        groups.some((g) => g._id === selectedConceptGroupFilter)
                      );

              return (
                <>
                  {concepts.length > 0 && (
                    <div className="filter-pills">
                      <button
                        type="button"
                        className={`filter-pill ${
                          selectedConceptGroupFilter === "__ALL__" ? "active" : ""
                        }`}
                        onClick={() => setSelectedConceptGroupFilter("__ALL__")}
                      >
                        All
                      </button>
                      {conceptGroups.map((group) => (
                        <button
                          key={`filter-${group._id}`}
                          type="button"
                          className={`filter-pill ${
                            selectedConceptGroupFilter === group._id ? "active" : ""
                          }`}
                          onClick={() => setSelectedConceptGroupFilter(group._id)}
                        >
                          {group.title}
                        </button>
                      ))}
                      {hasUngrouped && (
                        <button
                          type="button"
                          className={`filter-pill ${
                            selectedConceptGroupFilter === "__UNGROUPED__" ? "active" : ""
                          }`}
                          onClick={() => setSelectedConceptGroupFilter("__UNGROUPED__")}
                        >
                          Ungrouped
                        </button>
                      )}
                    </div>
                  )}
                  {concepts.length === 0 ? (
              <p className="meta">No concepts yet.</p>
            ) : (
              filteredConcepts.length === 0 ? (
                <p className="meta">No concepts in this group yet.</p>
              ) : (
              filteredConcepts.map(({ concept, groups }) => {
                const groupTitles = groups
                  .map((group) => group.title)
                  .filter((title) => typeof title === "string" && title.trim().length > 0);

                return (
                  <div key={concept._id} className="card">
                    <div className="item-header">
                      <p className="item-title">{concept.title}</p>
                      <button
                        onClick={() => requestDeleteConceptById(concept._id)}
                        disabled={deletingConceptId === concept._id}
                        title="Delete concept"
                        aria-label="Delete concept"
                        className="btn-sm"
                      >
                        {deletingConceptId === concept._id ? "…" : "Delete"}
                      </button>
                    </div>
                    <p className="item-body">{concept.summary}</p>
                    <div className="chips-row">
                      {groupTitles.length === 0 ? (
                        <span className="chip">Ungrouped</span>
                      ) : (
                        groupTitles.map((title) => (
                          <span key={`${concept._id}-${title}`} className="chip">
                            {title}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            ))}
                </>
              );
            })()}
          </div>
        </>
      )}

      {tab === "chat" && (
        <>
          <div className="card">
            <div className="item-header">
              <p className="item-title">Ask the Agent</p>
              <button onClick={startNewChat}>New Chat</button>
            </div>
            <div className="chat-stream">
              {messages.length === 0 && (
                <p className="meta">
                  {sessionId
                    ? "No messages in this conversation yet."
                    : "Start a new chat or select a conversation."}
                </p>
              )}
              {messages.map((m, i) => {
                const assistantPayload =
                  m.role === "assistant"
                    ? extractAssistantRenderPayload(m.content)
                    : { text: m.content, options: [] };
                const assistantOptions = assistantPayload.options;
                const isAssistantTyping = m.role === "assistant" && !m.content.trim() && chatLoading;
                return (
                  <div key={i} className={`chat-message ${m.role}`}>
                    {m.role === "assistant" ? (
                      isAssistantTyping ? (
                        <div className="typing-dots" aria-label="Assistant is typing">
                          <span />
                          <span />
                          <span />
                        </div>
                      ) : (
                        <>
                          <div className="assistant-markdown">
                            <ReactMarkdown>{assistantPayload.text}</ReactMarkdown>
                          </div>
                          {assistantOptions.length > 0 && (
                            <div className="option-chips">
                              {assistantOptions.map((option) => (
                                <button
                                  key={`${i}-${option}`}
                                  type="button"
                                  className="option-chip"
                                  disabled={chatLoading}
                                  onClick={() => sendChatMessage(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    ) : (
                      m.content
                    )}
                  </div>
                );
              })}
            </div>
            <div className="chat-input-row">
              <input
                placeholder="Ask a question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChatMessage()}
              />
              <button
                className="primary"
                onClick={() => sendChatMessage()}
                disabled={!chatInput.trim() || chatLoading}
              >
                {chatLoading ? "…" : "Send"}
              </button>
            </div>
          </div>
          <div className="section">
            <h2 className="section-title">Conversations</h2>
            {sessions.length === 0 ? (
              <p className="meta">
                No previous conversations yet.
              </p>
            ) : (
              <div className="list-stack">
                {sessions.map((s, idx) => (
                  <div key={s._id} className="card conversation-row">
                    <button
                      onClick={() => {
                        setSessionId(s._id);
                        fetchSessionMessages(s._id);
                      }}
                      className={`conversation-select ${sessionId === s._id ? "active" : ""}`}
                      title={s.title || s._id}
                    >
                      {s.title?.trim() || `Chat ${idx + 1}`}
                    </button>
                    <button
                      onClick={() => requestDeleteSessionById(s._id)}
                      disabled={deletingSessionId === s._id}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      className="btn-sm"
                    >
                      {deletingSessionId === s._id ? "…" : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {confirmDialog && (
        <div className="overlay" onClick={() => !confirmLoading && setConfirmDialog(null)}>
          <div className="confirm-modal card" onClick={(e) => e.stopPropagation()}>
            <p className="item-title">{confirmDialog.title}</p>
            <p className="meta">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={confirmDialog.tone === "danger" ? "primary danger" : "primary"}
                disabled={confirmLoading}
                onClick={async () => {
                  setConfirmLoading(true);
                  try {
                    await confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  } finally {
                    setConfirmLoading(false);
                  }
                }}
              >
                {confirmLoading ? "…" : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidepanel() {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={sidepanelUrl}
      signInFallbackRedirectUrl={sidepanelUrl}
      signUpFallbackRedirectUrl={sidepanelUrl}
      signInForceRedirectUrl={sidepanelUrl}
      signUpForceRedirectUrl={sidepanelUrl}
      allowedRedirectProtocols={["chrome-extension:"]}
    >
      <SidepanelContent />
    </ClerkProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Sidepanel />);
}
