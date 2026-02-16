<script setup lang="ts">
import {
  useMarkdown,
  copyIcon,
  checkIcon,
} from "../../composables/useMarkdown";
import { useToast } from "../../composables/useToast";

defineProps<{
  role: "user" | "assistant";
  content: string;
}>();

const md = useMarkdown();
const toast = useToast();

function onContentClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest(".code-copy-btn");
  if (btn) {
    const pre = btn.closest(".code-block-wrapper")?.querySelector("pre");
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent || "");
    btn.innerHTML = checkIcon;
    setTimeout(() => {
      btn.innerHTML = copyIcon;
    }, 1500);
    return;
  }

  // Handle download links in Tauri/mobile webviews via fetch + blob
  const anchor = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (!href || !href.includes("/api/downloads/")) return;
  e.preventDefault();
  if (anchor.classList.contains("downloading")) return;

  anchor.classList.add("downloading");

  const url = new URL(href, window.location.origin);
  const fileName = decodeURIComponent(url.pathname.split("/").pop() || "download");

  // Android + Tauri: validate first, then trigger native download via
  // DownloadListener which uses Android's DownloadManager to save to
  // the public Downloads folder.
  const isTauri = !!(window as any).__TAURI__;
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid && isTauri) {
    fetch(url.toString(), { method: "HEAD" })
      .then((res) => {
        anchor.classList.remove("downloading");
        if (res.status === 404) {
          toast.error("Download expired — ask the assistant to create it again");
          return;
        }
        if (!res.ok) {
          toast.error("Download failed");
          return;
        }
        // Navigate to the download URL — the native DownloadListener
        // intercepts Content-Disposition: attachment and saves the file
        // via DownloadManager. The WebView stays on the current page.
        window.location.assign(url.toString());
        toast.success(`Downloaded ${fileName}`);
      })
      .catch(() => {
        anchor.classList.remove("downloading");
        toast.error("Download failed");
      });
    return;
  }

  fetch(url.toString())
    .then((res) => {
      if (res.status === 404) throw new Error("expired");
      if (!res.ok) throw new Error("Download failed");
      return res.blob();
    })
    .then(async (blob) => {
      const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });

      // iOS webviews ignore <a download>; use the Web Share API instead
      // which opens the native share sheet (Save to Files, etc.)
      // Only use share on mobile — desktop browsers handle <a download> fine.
      const isMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        let shared = false;
        if (navigator.share) {
          try {
            await navigator.share({ files: [file] });
            shared = true;
          } catch (e) {
            // User dismissed the share sheet — re-throw so the outer catch handles it
            if (e instanceof DOMException && e.name === "AbortError") throw e;
          }
        }
        if (!shared) {
          window.open(url.toString(), "_blank");
        }
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }

      anchor.classList.remove("downloading");
      toast.success(`Downloaded ${fileName}`);
    })
    .catch((err) => {
      anchor.classList.remove("downloading");
      // User dismissed the share sheet — not an error
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.message === "expired") {
        toast.error("Download expired — ask the assistant to create it again");
      } else {
        toast.error("Download failed");
        window.open(url.toString(), "_blank");
      }
    });
}

/**
 * Unwrap ```markdown fences so the inner content is rendered as markdown
 * instead of being displayed as a code block. Tracks nested fences
 * (```python, ```js, etc.) to find the correct closing fence.
 */
function unwrapMarkdownFences(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (/^```+\s*(?:markdown|md)\s*$/.test(line.trim())) {
      let depth = 1;
      i++;
      while (i < lines.length && depth > 0) {
        const inner = lines[i]!;
        const trimmed = inner.trim();
        if (/^```+\s*\S+/.test(trimmed)) {
          depth++;
          result.push(inner);
        } else if (/^```+\s*$/.test(trimmed)) {
          depth--;
          if (depth > 0) result.push(inner);
        } else {
          result.push(inner);
        }
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}

function renderMarkdown(content: string): string {
  // Remove standalone &nbsp; lines the agent inserts between paragraphs
  const cleaned = content.replace(/\n\s*&nbsp;\s*\n/g, "\n\n");
  const unwrapped = unwrapMarkdownFences(cleaned);
  return md.value.render(unwrapped);
}
</script>

<template>
  <div
    :class="['flex w-full', role === 'user' ? 'justify-end' : 'justify-start']"
  >
    <div
      :class="[
        'rounded-radius whitespace-pre-wrap wrap-break-word leading-relaxed min-w-0 max-w-full',
        role === 'user'
          ? 'bg-primary text-white py-2.5 px-3.5'
          : 'text-text-primary w-full',
      ]"
    >
      <div
        :class="['markdown-content whitespace-normal', role]"
        v-html="renderMarkdown(content)"
        @click="onContentClick"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown deep styles - targets dynamically rendered HTML from v-html */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 1em 0 0.5em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content :deep(h1:first-child),
.markdown-content :deep(h2:first-child),
.markdown-content :deep(h3:first-child),
.markdown-content :deep(h4:first-child),
.markdown-content :deep(h5:first-child),
.markdown-content :deep(h6:first-child) {
  margin-top: 0;
}

.markdown-content :deep(h1) {
  font-size: 1.5em;
}
.markdown-content :deep(h2) {
  font-size: 1.3em;
}
.markdown-content :deep(h3) {
  font-size: 1.1em;
}
.markdown-content :deep(h4) {
  font-size: 1em;
}
.markdown-content :deep(h5) {
  font-size: 0.9em;
}
.markdown-content :deep(h6) {
  font-size: 0.85em;
}

.markdown-content :deep(p) {
  margin: 0.5em 0;
}

.markdown-content :deep(p:first-child) {
  margin-top: 0;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(ul) {
  margin: 0.5em 0;
  padding-left: 1.5em;
  list-style-type: disc;
}

.markdown-content :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
  list-style-type: decimal;
}

.markdown-content :deep(li) {
  margin: 0.25em 0;
  padding-left: 0.25em;
}

/* Inline code */
.markdown-content :deep(code) {
  background: var(--color-code-bg);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
  font-family:
    "SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, "Liberation Mono",
    monospace;
  font-size: 0.9em;
}

.markdown-content.user :deep(code) {
  background: rgba(0, 0, 0, 0.2);
}

/* Code block wrapper */
.markdown-content :deep(.code-block-wrapper) {
  margin: 0.5em 0;
  border-radius: 0.375rem;
  overflow: hidden;
  background: var(--color-code-bg);
}

.markdown-content :deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3em 0.5em 0.3em 0.75em;
  font-size: 0.75em;
}

.markdown-content :deep(.code-block-lang) {
  color: var(--color-text-secondary);
  font-family:
    "SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, "Liberation Mono",
    monospace;
  user-select: none;
}

.markdown-content :deep(.code-copy-btn) {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0.5em;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  transition: opacity 0.15s;
}

html:not(.is-mobile) .markdown-content :deep(.code-block-wrapper:hover .code-copy-btn) {
  opacity: 1;
}

html:not(.is-mobile) .markdown-content :deep(.code-copy-btn:hover) {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Pre inside code block wrapper — shiki sets inline background, override it */
.markdown-content :deep(pre) {
  background: transparent !important;
  padding: 0 0.75em 0.75em;
  border-radius: 0;
  overflow-x: auto;
  margin: 0;
}

.markdown-content.user :deep(.code-block-wrapper) {
  background: rgba(0, 0, 0, 0.2);
}

/* Shiki code inside pre — reset inline code styles */
.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--color-blockquote-border);
  padding-left: 1em;
  margin: 0.5em 0;
  font-style: italic;
}

.markdown-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  opacity: 0.9;
}

html:not(.is-mobile) .markdown-content :deep(a:hover) {
  opacity: 1;
}

.markdown-content :deep(a.downloading) {
  opacity: 0.6;
  pointer-events: none;
}


.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border-soft);
  margin: 1em 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--color-border-soft);
  padding: 0.5em;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--color-code-bg);
  font-weight: 600;
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}
</style>

<style>
/* Shiki dual-theme: switch to light token colors when light theme is active.
   Unscoped because [data-theme] is on <html>, an ancestor above this component. */
[data-theme="light"] .shiki,
[data-theme="light"] .shiki span {
  color: var(--shiki-light) !important;
  background-color: transparent !important;
}
</style>
