import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, SignIn, useAuth, useUser } from "@clerk/chrome-extension";

const publishableKey = typeof __CLERK_PUBLISHABLE_KEY__ !== "undefined" ? __CLERK_PUBLISHABLE_KEY__ : "";
const popupUrl = chrome.runtime.getURL("popup/popup.html");
type ThemeMode = "light" | "dark";

function resolveInitialTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function PopupContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [theme, setTheme] = useState<ThemeMode>(resolveInitialTheme);

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

  const openSidePanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
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
        <div className="panel">
          <p className="meta">Sign in to save nuggets, concepts, and chat with the agent.</p>
          <SignIn
            fallbackRedirectUrl={popupUrl}
            signUpFallbackRedirectUrl={popupUrl}
            signUpUrl={popupUrl}
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
      <div className="panel">
        <p className="meta">Hi, {user?.firstName || user?.emailAddresses[0]?.emailAddress || "there"}!</p>
        <button className="primary mt" onClick={openSidePanel}>
          Open Side Panel
        </button>
        <p className="meta mt">
          Select text on any page to save nuggets or concepts.
        </p>
      </div>
    </div>
  );
}

function Popup() {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={popupUrl}
      signInFallbackRedirectUrl={popupUrl}
      signUpFallbackRedirectUrl={popupUrl}
      signInForceRedirectUrl={popupUrl}
      signUpForceRedirectUrl={popupUrl}
      allowedRedirectProtocols={["chrome-extension:"]}
    >
      <PopupContent />
    </ClerkProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Popup />);
}
