import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

// iOS keyboard: detect height via visualViewport, expose as CSS variable.
// Native scroll prevention is in webview_helper.rs.
if (window.visualViewport) {
  const vv = window.visualViewport;
  const setKb = (v: string) =>
    document.documentElement.style.setProperty("--keyboard-height", v);

  vv.addEventListener("resize", () => {
    const kb = Math.max(0, window.innerHeight - vv.height);
    setKb(kb > 50 ? `${kb}px` : "0px");
  });

  // iOS bug: visualViewport.height doesn't fully restore after dismiss.
  // Reset when no input is focused — no keyboard without focus.
  document.addEventListener("focusout", () =>
    setTimeout(() => {
      const el = document.activeElement;
      if (!el || el === document.body) setKb("0px");
    }, 100),
  );
}

// Sync <meta name="theme-color"> with current data-theme attribute
function syncThemeColor() {
  const isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  const color = isLight ? "#ffffff" : "#151515";
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.attributeName === "data-theme") syncThemeColor();
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

// Detect mobile devices via userAgent and flag <html> so CSS can skip :hover styles.
// Touch devices trigger sticky hover states that look broken, so we disable them entirely.
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  document.documentElement.classList.add("is-mobile");
}

createApp(App).mount("#app");
