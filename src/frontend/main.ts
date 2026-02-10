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

createApp(App).mount("#app");
