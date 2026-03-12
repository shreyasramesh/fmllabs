let floatingBar: HTMLDivElement | null = null;
let lastSelection = "";
let youtubeButtonInitialized = false;
let isInteractingWithFloatingBar = false;
type ThemeMode = "light" | "dark";
let currentTheme: ThemeMode =
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

function syncThemeFromStorage() {
  chrome.storage.local.get("fmlTheme", (data) => {
    const stored = data.fmlTheme as ThemeMode | undefined;
    if (stored === "light" || stored === "dark") {
      currentTheme = stored;
    }
  });
}

syncThemeFromStorage();
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.fmlTheme?.newValue) return;
  const next = changes.fmlTheme.newValue as ThemeMode;
  if (next === "light" || next === "dark") {
    currentTheme = next;
  }
});

function getFloatingPalette(theme: ThemeMode) {
  if (theme === "light") {
    return {
      barBg: "#ffffff",
      barFg: "#111827",
      barBorder: "1px solid rgba(17,24,39,0.14)",
      barShadow: "0 6px 18px rgba(17,24,39,0.16)",
      buttonBg: "rgba(17,24,39,0.08)",
      buttonHoverBg: "rgba(17,24,39,0.14)",
      buttonFg: "#111827",
    };
  }
  return {
    barBg: "#1a1a1a",
    barFg: "#ffffff",
    barBorder: "1px solid rgba(255,255,255,0.16)",
    barShadow: "0 6px 18px rgba(0,0,0,0.28)",
    buttonBg: "rgba(255,255,255,0.15)",
    buttonHoverBg: "rgba(255,255,255,0.25)",
    buttonFg: "#ffffff",
  };
}

function getSelectionText(): string {
  const sel = window.getSelection();
  return sel?.toString().trim() || "";
}

function hideFloatingBar() {
  if (floatingBar && floatingBar.parentNode) {
    floatingBar.parentNode.removeChild(floatingBar);
    floatingBar = null;
  }
}

function showActionToast(message: string) {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    background: "#111827",
    color: "#fff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
  });
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function isYouTubeWatchPage(): boolean {
  return (
    window.location.hostname.includes("youtube.com") &&
    window.location.pathname === "/watch"
  );
}

function getYouTubeButtonHost(): HTMLElement | null {
  const selectors = [
    "ytd-watch-metadata #actions #top-level-buttons-computed",
    "#top-level-buttons-computed",
    "ytd-watch-metadata #actions-inner",
  ];
  for (const selector of selectors) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
  }
  return null;
}

function removeYouTubeButton() {
  const existing = document.getElementById("fml-youtube-button-wrap");
  if (existing) existing.remove();
}

function ensureYouTubeActionButton() {
  if (!isYouTubeWatchPage()) {
    removeYouTubeButton();
    return;
  }
  const host = getYouTubeButtonHost();
  if (!host) return;
  if (document.getElementById("fml-youtube-button-wrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "fml-youtube-button-wrap";
  Object.assign(wrap.style, {
    marginRight: "8px",
    display: "flex",
    alignItems: "center",
  });

  const getNativeYouTubePalette = () => {
    const sample =
      (host.querySelector("button.yt-spec-button-shape-next") as HTMLElement | null) ||
      (host.querySelector("button") as HTMLElement | null);
    if (!sample) {
      return {
        background: "#272727",
        color: "#f1f1f1",
      };
    }
    const cs = window.getComputedStyle(sample);
    return {
      background: cs.backgroundColor || "#272727",
      color: cs.color || "#f1f1f1",
    };
  };

  const applyRestStyles = (button: HTMLButtonElement) => {
    const palette = getNativeYouTubePalette();
    Object.assign(button.style, {
      borderRadius: "999px",
      height: "40px",
      padding: "0 16px",
      display: "inline-flex",
      alignItems: "center",
      background: palette.background,
      color: palette.color,
      border: "none",
      fontSize: "14px",
      lineHeight: "14px",
      cursor: "pointer",
      fontFamily: "Roboto, Arial, sans-serif",
      transition: "background 160ms ease, color 160ms ease",
    });
  };

  const makeActionButton = (opts: {
    title: string;
    label: string;
    iconSvg: string;
    onClick: () => void;
  }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.title = opts.title;
    button.ariaLabel = opts.title;
    button.innerHTML = `
    <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-right:8px;">
      ${opts.iconSvg}
    </span>
    <span style="font-weight:700;">${opts.label}</span>
  `;
    applyRestStyles(button);
    button.onmouseenter = () => {
      button.style.background = "#f59e0b";
      button.style.color = "#1f1300";
    };
    button.onmouseleave = () => applyRestStyles(button);
    button.addEventListener("click", opts.onClick);
    return button;
  };

  const extractButton = makeActionButton({
    title: "Extract Concepts",
    label: "Extract Concepts",
    iconSvg:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="13" rx="2.2" fill="currentColor" opacity="0.18"></rect><rect x="5.7" y="6.7" width="12.6" height="10.6" rx="1.6" stroke="currentColor" stroke-width="1.6"></rect><path d="M7.8 13.3h8.4M7.8 10.4h6.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M18.8 4.6l.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7z" fill="currentColor"></path></svg>',
    onClick: () => {
      chrome.runtime.sendMessage(
      {
        type: "EXTRACT_YOUTUBE_CONCEPTS",
        url: window.location.href,
      },
      (response) => {
        if (chrome.runtime.lastError || response?.error) {
          showActionToast(response?.error || "Could not extract concepts");
          return;
        }
        showActionToast("Request sent. Concepts will appear in Concepts tab when ready.");
      }
    );
    },
  });

  wrap.appendChild(extractButton);
  const firstAction = host.firstElementChild;
  if (firstAction) {
    host.insertBefore(wrap, firstAction);
  } else {
    host.appendChild(wrap);
  }

  // Re-apply native rest styles after insertion in case host computes late.
  setTimeout(() => {
    applyRestStyles(extractButton);
  }, 0);
}

function showFloatingBar(x: number, y: number, text: string) {
  hideFloatingBar();
  lastSelection = text;
  const palette = getFloatingPalette(currentTheme);

  const bar = document.createElement("div");
  bar.id = "fml-floating-bar";
  bar.dataset.selection = text;
  bar.dataset.loadingAction = "";
  bar.innerHTML = `
    <button data-action="nugget" title="Save Nugget" aria-label="Save Nugget">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 3h11l3 3v15H5z"></path><path d="M9 3v6h6V3"></path>
      </svg>
    </button>
    <button data-action="concept" title="Save as Concept" aria-label="Save as Concept">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12c.7.7 1.4 1.6 1.6 2.6h4.8c.2-1 1-1.9 1.6-2.6A7 7 0 0 0 12 2z"></path>
      </svg>
    </button>
    <button data-action="ask" title="Ask about this" aria-label="Ask about this">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
      </svg>
    </button>
    <button data-action="model" title="Create Mental Model" aria-label="Create Mental Model">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v4"></path>
        <path d="M7.5 5.5l2.5 3"></path>
        <path d="M16.5 5.5l-2.5 3"></path>
        <path d="M4 13c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>
      </svg>
    </button>
  `;

  Object.assign(bar.style, {
    position: "fixed",
    left: `${Math.min(x, window.innerWidth - 200)}px`,
    top: `${y + 4}px`,
    zIndex: "2147483647",
    display: "flex",
    gap: "8px",
    padding: "6px",
    background: palette.barBg,
    color: palette.barFg,
    border: palette.barBorder,
    borderRadius: "8px",
    fontSize: "12px",
    fontFamily: "system-ui, sans-serif",
    boxShadow: palette.barShadow,
  });

  bar.querySelectorAll("button").forEach((btn) => {
    btn.dataset.selection = text;
    Object.assign(btn.style, {
      width: "28px",
      height: "28px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      borderRadius: "6px",
      background: palette.buttonBg,
      color: palette.buttonFg,
      cursor: "pointer",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.background = palette.buttonHoverBg;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = palette.buttonBg;
    });
  });

  bar.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button[data-action]") as HTMLButtonElement | null;
    const action = button?.dataset.action;
    if (bar.dataset.loadingAction) return;
    const selectedText =
      button?.dataset.selection || floatingBar?.dataset.selection || lastSelection;
    if (!action || !selectedText) return;
    bar.dataset.loadingAction = action;

    const buttons = Array.from(
      bar.querySelectorAll("button[data-action]")
    ) as HTMLButtonElement[];
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = "0.65";
    });
    if (button) {
      button.dataset.prevHtml = button.innerHTML;
      button.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity="0.25" fill="none"></circle><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite" /></path></svg>';
    }

    const complete = (isError: boolean) => {
      if (button) {
        button.innerHTML = isError
          ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>'
          : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m5 13 4 4L19 7"></path></svg>';
        button.style.background = isError ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)";
      }
      window.setTimeout(() => {
        if (button && button.dataset.prevHtml) {
          button.innerHTML = button.dataset.prevHtml;
          delete button.dataset.prevHtml;
          button.style.background = palette.buttonBg;
        }
        buttons.forEach((btn) => {
          btn.disabled = false;
          btn.style.opacity = "1";
        });
        bar.dataset.loadingAction = "";
      }, 700);
    };

    chrome.runtime.sendMessage(
      { type: "CONTENT_ACTION", action, text: selectedText, url: window.location.href },
      (response) => {
        if (chrome.runtime.lastError) {
          complete(true);
          return;
        }
        if (response?.error) {
          complete(true);
        } else if (response?.ok) {
          complete(false);
        }
      }
    );
  });

  bar.addEventListener("mousedown", (e) => {
    // Keep current text selection while clicking action buttons.
    isInteractingWithFloatingBar = true;
    e.preventDefault();
  });
  bar.addEventListener("mouseup", () => {
    window.setTimeout(() => {
      isInteractingWithFloatingBar = false;
    }, 0);
  });
  bar.addEventListener("mouseleave", () => {
    isInteractingWithFloatingBar = false;
  });

  document.body.appendChild(bar);
  floatingBar = bar;
}

function onMouseUp(event: MouseEvent) {
  if (
    floatingBar &&
    event.target instanceof Node &&
    floatingBar.contains(event.target)
  ) {
    return;
  }
  const text = getSelectionText();
  if (text) {
    const range = window.getSelection()?.getRangeAt(0);
    if (range) {
      const rect = range.getBoundingClientRect();
      showFloatingBar(rect.left, rect.bottom, text);
    }
  } else {
    hideFloatingBar();
  }
}

document.addEventListener("mouseup", onMouseUp);
document.addEventListener("selectionchange", () => {
  if (isInteractingWithFloatingBar) return;
  if (!getSelectionText() && !(floatingBar && floatingBar.matches(":hover"))) {
    hideFloatingBar();
  }
});

if (!youtubeButtonInitialized) {
  youtubeButtonInitialized = true;
  const run = () => ensureYouTubeActionButton();
  run();
  window.addEventListener("yt-navigate-finish", run);
  window.addEventListener("popstate", run);
  const observer = new MutationObserver(() => {
    ensureYouTubeActionButton();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
