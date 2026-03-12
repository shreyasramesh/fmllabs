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

function normalizeAssistantContent(raw: string): string {
  const withoutStreamContext = stripContextBlock(raw);
  const marker = "\n---RELEVANT-CONTEXT---";
  const markerIdx = withoutStreamContext.indexOf(marker);
  const cleaned = markerIdx >= 0
    ? withoutStreamContext.slice(0, markerIdx).trimEnd()
    : withoutStreamContext;
  return formatOptionsBlock(cleaned);
}

const OPTIONS_MARKER_REGEX = /-{2,3}\s*OPTIONS\s*-{2,3}/i;

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
  const contentActionInFlightKey = useRef<string | null>(null);

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
    if (isSignedIn && tab === "chat" && sessionId) {
      fetchSessionMessages(sessionId);
    }
  }, [isSignedIn, tab, sessionId, fetchSessionMessages]);

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
      alert((e as Error).message);
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
      alert((e as Error).message);
    } finally {
      setConceptLoading(false);
    }
  };

  const deleteNuggetById = async (id: string) => {
    if (!id || deletingNuggetId) return;
    const shouldDelete = window.confirm("Delete this nugget?");
    if (!shouldDelete) return;
    setDeletingNuggetId(id);
    try {
      await apiFetch(`/me/nuggets/${id}`, { method: "DELETE" });
      fetchNuggets();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingNuggetId(null);
    }
  };

  const deleteConceptById = async (id: string) => {
    if (!id || deletingConceptId) return;
    const shouldDelete = window.confirm("Delete this concept?");
    if (!shouldDelete) return;
    setDeletingConceptId(id);
    try {
      await apiFetch(`/me/custom-concepts/${id}`, { method: "DELETE" });
      await Promise.all([fetchConcepts(), fetchConceptGroups()]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingConceptId(null);
    }
  };

  const deleteSessionById = async (id: string) => {
    if (!id || deletingSessionId) return;
    const shouldDelete = window.confirm("Delete this conversation?");
    if (!shouldDelete) return;
    setDeletingSessionId(id);
    try {
      await apiFetch(`/sessions/${id}`, { method: "DELETE" });
      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }
      fetchSessions();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const text = chatInput.trim();
    setChatInput("");
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
        alert("Failed to create session");
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
          <h1>FML Labs</h1>
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
        <p>Sign in to use the side panel.</p>
        <SignIn
          fallbackRedirectUrl={sidepanelUrl}
          signUpFallbackRedirectUrl={sidepanelUrl}
          signUpUrl={sidepanelUrl}
        />
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="topbar">
        <h1>FML Labs</h1>
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
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        Hi, {user?.firstName || user?.emailAddresses[0]?.emailAddress || "there"}!
      </p>
      {contentActionNotice && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -4 }}>
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
          <div>
            <h2>Your Nuggets</h2>
            {nuggets.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>No nuggets yet.</p>
            ) : (
              nuggets.map((n) => (
                <div key={n._id} className="card">
                  <div className="topbar" style={{ marginBottom: 6 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>Nugget</p>
                    <button
                      onClick={() => deleteNuggetById(n._id)}
                      disabled={deletingNuggetId === n._id}
                      title="Delete nugget"
                      aria-label="Delete nugget"
                      style={{ padding: "2px 8px", fontSize: 12 }}
                    >
                      {deletingNuggetId === n._id ? "…" : "Delete"}
                    </button>
                  </div>
                  <p style={{ margin: 0 }}>{n.content}</p>
                  {n.source && (
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
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
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text)",
                marginTop: 0,
                marginBottom: 6,
              }}
            >
              {youtubeExtractNotice}
            </p>
          )}
          {youtubeExtractLoading && (
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                marginTop: 0,
                marginBottom: 10,
              }}
            >
              This can take up to ~30 seconds depending on transcript length.
            </p>
          )}
          <div className="card">
            <h2>Save as Concept</h2>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Paste text from any webpage. We'll generate a concept and save it.
            </p>
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
          <div style={{ marginTop: 12 }}>
            <h2>Saved Concepts</h2>
            {concepts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>No concepts yet.</p>
            ) : (
              concepts.map((concept) => {
                const groupTitles = conceptGroups
                  .filter((group) => Array.isArray(group.conceptIds) && group.conceptIds.includes(concept._id))
                  .map((group) => group.title)
                  .filter((title) => typeof title === "string" && title.trim().length > 0);

                return (
                  <div key={concept._id} className="card">
                    <div className="topbar" style={{ marginBottom: 6 }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{concept.title}</p>
                      <button
                        onClick={() => deleteConceptById(concept._id)}
                        disabled={deletingConceptId === concept._id}
                        title="Delete concept"
                        aria-label="Delete concept"
                        style={{ padding: "2px 8px", fontSize: 12 }}
                      >
                        {deletingConceptId === concept._id ? "…" : "Delete"}
                      </button>
                    </div>
                    <p style={{ fontSize: 13, margin: "6px 0 0" }}>{concept.summary}</p>
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
            )}
          </div>
        </>
      )}

      {tab === "chat" && (
        <>
          <div className="card">
            <div className="topbar" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Ask the Agent</h2>
              <button onClick={startNewChat}>New Chat</button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {messages.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                  {sessionId
                    ? "No messages in this conversation yet."
                    : "Start a new chat or select a conversation."}
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`chat-message ${m.role}`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {m.role === "assistant" ? (
                    <div className="assistant-markdown">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              ))}
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
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
              >
                {chatLoading ? "…" : "Send"}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <h2>Conversations</h2>
            {sessions.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                No previous conversations yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessions.map((s, idx) => (
                  <div
                    key={s._id}
                    className="card"
                    style={{
                      margin: 0,
                      padding: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <button
                      onClick={() => {
                        setSessionId(s._id);
                        fetchSessionMessages(s._id);
                      }}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        padding: "6px 10px",
                        borderRadius: 10,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                        background:
                          sessionId === s._id ? "var(--primary)" : "var(--surface)",
                        color:
                          sessionId === s._id ? "var(--primary-text)" : "var(--text)",
                      }}
                      title={s.title || s._id}
                    >
                      {s.title?.trim() || `Chat ${idx + 1}`}
                    </button>
                    <button
                      onClick={() => deleteSessionById(s._id)}
                      disabled={deletingSessionId === s._id}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      style={{ padding: "4px 8px", fontSize: 12 }}
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
