import { shallowRef } from "vue";
import MarkdownIt from "markdown-it";
import Shiki from "@shikijs/markdown-it";

export const copyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
export const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

import type { BundledLanguage } from "shiki";

const LANGS: BundledLanguage[] = [
  "javascript", "typescript", "python", "html", "css", "json",
  "bash", "shell", "markdown", "yaml", "sql", "go", "rust",
  "java", "c", "cpp", "ruby", "php", "swift", "kotlin",
  "jsx", "tsx", "vue", "xml", "toml", "diff",
];

function addCodeBlockWrapper(md: MarkdownIt) {
  const defaultFence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const lang = tokens[idx]!.info.trim().split(/\s+/)[0] || "";
    const langLabel = lang ? `<span class="code-block-lang">${lang}</span>` : "";
    const code = defaultFence(tokens, idx, options, env, self);
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          ${langLabel}
          <button class="code-copy-btn" type="button">${copyIcon}</button>
        </div>
        ${code}
      </div>`;
  };
}

function createMd() {
  const instance = new MarkdownIt({ breaks: true });
  addCodeBlockWrapper(instance);
  return instance;
}

const md = shallowRef(createMd());

async function initShiki() {
  const instance = new MarkdownIt({ breaks: true });
  instance.use(await Shiki({
    themes: { dark: "github-dark", light: "github-light" },
    defaultColor: "dark",
    langs: LANGS,
  }));
  addCodeBlockWrapper(instance);
  md.value = instance;
}

initShiki();

export function useMarkdown() {
  return md;
}
