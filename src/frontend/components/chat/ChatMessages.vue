<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, onUpdated } from "vue";
import MessageBubble from "./MessageBubble.vue";
import AgentMessageLabel from "./components/AgentMessageLabel.vue";
import ToolCallLabel from "./components/ToolCallLabel.vue";
import LoadingIndicator from "../common/LoadingIndicator.vue";

type ContentBlock =
  | { type: "text"; content: string }
  | {
      type: "toolCall";
      toolCall: { toolName: string; toolInput: Record<string, any> };
    };

defineProps<{
  visibleMessages: Array<{
    role: "user" | "assistant" | "agent";
    content: string;
  }>;
  loading: boolean;
  compacting: boolean;
  toolCalls: Array<{
    messageIndex: number;
    contentPosition: number;
    toolName: string;
    toolInput: Record<string, any>;
  }>;
  originalMessages: Array<{
    role: "user" | "assistant" | "agent";
    content: string;
  }>;
}>();

const emit = defineEmits<{
  "tool-call-click": [
    toolCall: { toolName: string; toolInput: Record<string, any> },
  ];
  "agent-message-click": [content: string];
}>();

const messagesContainer = ref<HTMLElement | null>(null);

function getMessageContentBlocks(
  messageIndex: number,
  content: string,
  toolCalls: Array<{
    messageIndex: number;
    contentPosition: number;
    toolName: string;
    toolInput: Record<string, any>;
  }>,
): ContentBlock[] {
  const messageToolCalls = toolCalls
    .filter((tc) => tc.messageIndex === messageIndex)
    .sort((a, b) => a.contentPosition - b.contentPosition);

  if (messageToolCalls.length === 0) {
    return [{ type: "text", content }];
  }

  const blocks: ContentBlock[] = [];
  let lastPosition = 0;

  for (const tc of messageToolCalls) {
    if (tc.contentPosition > lastPosition) {
      const textContent = content.slice(lastPosition, tc.contentPosition);
      if (textContent.trim()) {
        blocks.push({ type: "text", content: textContent });
      }
    }

    blocks.push({
      type: "toolCall",
      toolCall: { toolName: tc.toolName, toolInput: tc.toolInput },
    });

    lastPosition = tc.contentPosition;
  }

  if (lastPosition < content.length) {
    const remainingContent = content.slice(lastPosition);
    if (remainingContent.trim()) {
      blocks.push({ type: "text", content: remainingContent });
    }
  }

  return blocks;
}

function getOriginalMessageIndex(
  visibleIndex: number,
  visibleMessages: Array<{
    role: "user" | "assistant" | "agent";
    content: string;
  }>,
  originalMessages: Array<{
    role: "user" | "assistant" | "agent";
    content: string;
  }>,
  toolCalls: Array<{
    messageIndex: number;
    contentPosition: number;
    toolName: string;
    toolInput: Record<string, any>;
  }>,
): number {
  let visibleIdx = 0;
  for (let i = 0; i < originalMessages.length; i++) {
    const msg = originalMessages[i];
    if (!msg) continue;
    const isVisible = (() => {
      if (msg.role === "user" || msg.role === "agent") return true;
      if (msg.content && msg.content.trim().length > 0) return true;
      if (msg.role === "assistant") {
        const hasToolCalls = toolCalls.some((tc) => tc.messageIndex === i);
        if (hasToolCalls) return true;
      }
      return false;
    })();
    if (isVisible) {
      if (visibleIdx === visibleIndex) {
        return i;
      }
      visibleIdx++;
    }
  }
  return visibleIndex;
}

const pinnedToBottom = ref(true);

function scrollToBottom() {
  const el = messagesContainer.value;
  if (el) el.scrollTop = el.scrollHeight;
}

function onScroll() {
  const el = messagesContainer.value;
  if (!el) return;
  // Consider "pinned" if within 5px of the bottom
  pinnedToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 5;
}

onMounted(() => {
  messagesContainer.value?.addEventListener("scroll", onScroll);
  scrollToBottom();
});

onBeforeUnmount(() => {
  messagesContainer.value?.removeEventListener("scroll", onScroll);
});

onUpdated(() => {
  if (pinnedToBottom.value) scrollToBottom();
});

defineExpose({ messagesContainer });
</script>

<template>
  <div
    ref="messagesContainer"
    class="flex flex-1 overflow-y-auto w-full flex-col relative"
  >
    <slot :pinnedToBottom="pinnedToBottom" :scrollToBottom="scrollToBottom" />

    <div class="max-w-200 mx-auto w-full gap-2 flex flex-col p-5 order-first">
      <template v-for="(msg, msgIndex) in visibleMessages" :key="msgIndex">
        <!-- Agent messages: always show as a clickable label -->
        <AgentMessageLabel
          v-if="msg.role === 'agent'"
          :content="msg.content"
          @click="emit('agent-message-click', msg.content)"
        />
        <!-- For assistant messages, render content blocks with inline tool calls -->
        <template v-else-if="msg.role === 'assistant'">
          <template
            v-for="(block, blockIndex) in getMessageContentBlocks(
              getOriginalMessageIndex(
                msgIndex,
                visibleMessages,
                originalMessages,
                toolCalls,
              ),
              msg.content,
              toolCalls,
            )"
            :key="`${msgIndex}-${blockIndex}`"
          >
            <!-- Text Block -->
            <MessageBubble
              v-if="block.type === 'text'"
              :role="msg.role"
              :content="block.content"
            />
            <!-- Inline Tool Call Label -->
            <ToolCallLabel
              v-else-if="block.type === 'toolCall'"
              :toolCall="block.toolCall"
              @click="emit('tool-call-click', block.toolCall)"
            />
          </template>
        </template>
        <!-- User messages -->
        <MessageBubble v-else :role="msg.role" :content="msg.content" />
      </template>
      <div v-if="compacting" class="flex justify-start py-2 px-6">
        <div class="flex items-center gap-2 text-sm text-text-secondary">
          <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" class="opacity-20" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          Compacting conversation...
        </div>
      </div>
      <LoadingIndicator v-else-if="loading" />
    </div>
  </div>
</template>
