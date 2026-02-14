<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, type Ref } from "vue";
import { useWebSocket } from "../composables/useWebSocket";
import { provideConfig } from "../composables/useConfig";
import { provideSlashCommands } from "../composables/useSlashCommands";
import { useSidebarSwipe } from "../composables/useSidebarSwipe";
import Sidebar from "../components/sidebar/Sidebar.vue";
import ChatMain from "../components/chat/ChatMain.vue";
import AgentDetailModal from "../components/modals/AgentDetailModal.vue";
import AgentMessageDetailModal from "../components/modals/AgentMessageDetailModal.vue";
import SettingsModal from "../components/modals/settings/SettingsModal.vue";
import ToolCallDetailModal from "../components/modals/ToolCallDetailModal.vue";

const props = defineProps<{
  authToken: string;
}>();

const emit = defineEmits<{
  logout: [];
}>();

const selectedAgent = ref<string | null>(null);
const showSettings = ref(false);
const copied = ref(false);
const sidebarCollapsed = ref(
  localStorage.getItem("sidebarCollapsed") !== null
    ? localStorage.getItem("sidebarCollapsed") === "true"
    : window.innerWidth < 768
);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed.value));
}

const { sidebarRef, overlayRef, isSwiping } = useSidebarSwipe(
  sidebarCollapsed,
  toggleSidebar,
);

const selectedToolCall = ref<{
  toolName: string;
  toolInput: Record<string, any>;
} | null>(null);
const selectedAgentMessage = ref<string | null>(null);

// Settings state with localStorage persistence
type ThemeSetting = "dark" | "light" | "system";

const theme = ref<ThemeSetting>(
  (localStorage.getItem("theme") as ThemeSetting) || "system",
);

const {
  connected,
  messages,
  agents,
  error,
  loading,
  compacting,
  queuedMessages,
  toolCalls,
  config,
  configSaving,
  mcpStatus,
  connect,
  sendMessage: wsSendMessage,
  clearContext: wsClearContext,
  clearAgents: wsClearAgents,
  sendToAgent: wsSendToAgent,
  killAgent: wsKillAgent,
  getConfig: wsGetConfig,
  updateConfig: wsUpdateConfig,
  getMcpStatus: wsGetMcpStatus,
  removeQueuedMessage: wsRemoveQueuedMessage,
  compactContext: wsCompactContext,
  subscribeAgent: wsSubscribeAgent,
  unsubscribeAgent: wsUnsubscribeAgent,
  stopGeneration: wsStopGeneration,
  restartServer: wsRestartServer,
} = useWebSocket();

provideConfig({
  config,
  configSaving,
  mcpStatus,
  getConfig: wsGetConfig,
  updateConfig: wsUpdateConfig,
  getMcpStatus: wsGetMcpStatus,
  restartServer: wsRestartServer,
});

// Filter out empty assistant messages
const visibleMessages = computed(() => {
  return messages.value.filter((msg, index) => {
    if (msg.role === "user" || msg.role === "agent") {
      return true;
    }
    if (msg.content && msg.content.trim().length > 0) {
      return true;
    }
    if (msg.role === "assistant") {
      const hasToolCalls = toolCalls.value.some(
        (tc) => tc.messageIndex === index,
      );
      if (hasToolCalls) {
        return true;
      }
    }
    return false;
  });
});

// Get agents as an array for the component
const agentsArray = computed(() => Array.from(agents.value.values()));

// Context usage percentage based on estimated tokens vs maxTokens
const contextPercent = computed(() => {
  if (!config.value) return 0;
  const provider = config.value.models.providers[config.value.models.default];
  if (!provider || !provider.maxTokens) return 0;
  const estimatedTokens = messages.value.reduce(
    (sum, msg) => sum + Math.ceil(msg.content.length / 4),
    0,
  );
  return Math.min(Math.round((estimatedTokens / provider.maxTokens) * 100), 100);
});

// Get selected agent data
const selectedAgentData = computed(() => {
  if (!selectedAgent.value) return null;
  return agents.value.get(selectedAgent.value) || null;
});

async function sendMessage(message: string) {
  wsSendMessage(message);
}

function clearContext() {
  wsClearContext();
}

function clearAgents() {
  if (!confirm("Are you sure you want to remove all agents?")) {
    return;
  }
  wsClearAgents();
}

function sendAgentMessage(agentId: string, message: string) {
  wsSendToAgent(agentId, message);
}

function killAgentHandler(agentId: string) {
  wsKillAgent(agentId);
}

function copyToClipboard() {
  const chatText = messages.value
    .map((msg, index) => {
      if (msg.role === "user") {
        return `# User\n${msg.content}`;
      }

      const msgToolCalls = toolCalls.value
        .filter((tc) => tc.messageIndex === index)
        .sort((a, b) => a.contentPosition - b.contentPosition);

      let parts: string[] = [];
      if (msg.content?.trim()) {
        parts.push(msg.content);
      }
      for (const tc of msgToolCalls) {
        parts.push(`[Tool: ${tc.toolName}]\nInput: ${JSON.stringify(tc.toolInput, null, 2)}`);
      }

      if (parts.length === 0) return null;

      const role = msg.role === "agent" ? "Agent" : "Assistant";
      return `# ${role}\n${parts.join("\n\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(chatText)
      .then(() => {
        copied.value = true;
        setTimeout(() => {
          copied.value = false;
        }, 2000);
      })
      .catch((err: unknown) => {
        console.error("Failed to copy chat:", err);
        fallbackCopy(chatText);
      });
  } else {
    fallbackCopy(chatText);
  }
}

function fallbackCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand("copy");
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Fallback copy failed:", err);
  } finally {
    document.body.removeChild(textArea);
  }
}

provideSlashCommands({
  stop: {
    description: "Stop the current process",
    run: () => wsStopGeneration(),
  },
  clear: {
    description: "Clear conversation history",
    run: () => clearContext(),
  },
  copy: {
    description: "Copy chat to clipboard",
    run: () => copyToClipboard(),
  },
  compact: {
    description: "Compact conversation history",
    run: () => wsCompactContext(),
  },
});

async function openAgentDetail(agentId: string) {
  wsSubscribeAgent(agentId);
  selectedAgent.value = agentId;
}

function closeAgentDetail() {
  if (selectedAgent.value) {
    wsUnsubscribeAgent(selectedAgent.value);
  }
  selectedAgent.value = null;
}

function openToolCallDetail(toolCall: {
  toolName: string;
  toolInput: Record<string, any>;
}) {
  selectedToolCall.value = toolCall;
}

function closeToolCallDetail() {
  selectedToolCall.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  // Handle Escape key to close modals
  if (event.key === "Escape") {
    if (selectedAgentMessage.value !== null) {
      closeAgentMessage();
      return;
    }
    if (selectedToolCall.value) {
      closeToolCallDetail();
      return;
    }
    if (selectedAgent.value) {
      closeAgentDetail();
      return;
    }
    if (showSettings.value) {
      showSettings.value = false;
      return;
    }
  }
}

function openSettings() {
  showSettings.value = true;
}

function closeSettings() {
  showSettings.value = false;
}

function setTheme(newTheme: ThemeSetting) {
  theme.value = newTheme;
  localStorage.setItem("theme", newTheme);
  applyTheme();
}

function openAgentMessage(content: string) {
  selectedAgentMessage.value = content;
}

function closeAgentMessage() {
  selectedAgentMessage.value = null;
}

function resolveTheme(): "dark" | "light" {
  if (theme.value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme.value;
}

function applyTheme() {
  const root = document.documentElement;
  if (resolveTheme() === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

// Re-apply when OS preference changes (only matters when set to "system")
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (theme.value === "system") applyTheme();
  });

// Watch agents for changes and close modal if agent was removed
watch(
  agents,
  () => {
    if (selectedAgent.value) {
      if (!agents.value.has(selectedAgent.value)) {
        wsUnsubscribeAgent(selectedAgent.value);
        selectedAgent.value = null;
      }
    }
  },
  { deep: true },
);

onMounted(() => {
  connect(props.authToken, () => emit("logout"));
  window.addEventListener("keydown", handleKeydown);
  applyTheme();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div
    class="flex h-full bg-bg-primary text-text-primary overflow-hidden"
  >
    <!-- Mobile backdrop -->
    <div
      ref="overlayRef"
      :class="[
        'md:hidden fixed inset-0 z-30 bg-black/30 transition-opacity duration-300',
        sidebarCollapsed && !isSwiping ? 'opacity-0 pointer-events-none' : 'opacity-100',
      ]"
      @click="toggleSidebar"
    />

    <!-- Sidebar wrapper -->
    <div
      ref="sidebarRef"
      :class="[
        'shrink-0 overflow-hidden flex shadow-2xl md:shadow-none',
        'fixed inset-y-0 left-0 z-40 w-4/5 max-w-80 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] bg-bg-secondary',
        'md:relative md:inset-auto md:z-auto md:max-w-none md:pt-0 md:pb-0 md:pl-0 md:bg-transparent',
        'transition-transform duration-300 ease-in-out',
        'md:transition-[width] md:duration-300 md:ease-in-out',
        sidebarCollapsed
          ? '-translate-x-full md:translate-x-0 md:w-0'
          : 'translate-x-0 md:w-74',
      ]"
    >
      <Sidebar
        :connected="connected"
        :copied="copied"
        :collapsed="sidebarCollapsed"
        :agents="agentsArray"
        @copy="copyToClipboard"
        @clear-context="clearContext"
        @agent-click="openAgentDetail"
        @clear-agents="clearAgents"
        @open-settings="openSettings"
        @collapse-sidebar="toggleSidebar"
      />
    </div>

    <ChatMain
      :connected="connected"
      :error="error"
      :visibleMessages="visibleMessages"
      :loading="loading"
      :compacting="compacting"
      :queuedMessages="queuedMessages"
      :toolCalls="toolCalls"
      :originalMessages="messages"
      :contextPercent="contextPercent"
      :sidebarCollapsed="sidebarCollapsed"
      @submit="sendMessage"
      @tool-call-click="openToolCallDetail"
      @agent-message-click="openAgentMessage"
      @remove-queued="(idx) => { const msg = queuedMessages[idx]; if (msg) wsRemoveQueuedMessage(msg.timestamp); }"
      @toggle-sidebar="toggleSidebar"
      @clear-context="clearContext"
    />

    <AgentDetailModal
      :agent="selectedAgentData"
      @close="closeAgentDetail"
      @send-message="sendAgentMessage"
      @kill-agent="killAgentHandler"
    />

    <SettingsModal
      :show="showSettings"
      :theme="theme"
      @close="closeSettings"
      @set-theme="setTheme"
      @logout="emit('logout')"
    />

    <ToolCallDetailModal
      :toolCall="selectedToolCall"
      @close="closeToolCallDetail"
    />

    <AgentMessageDetailModal
      :content="selectedAgentMessage"
      @close="closeAgentMessage"
    />
  </div>
</template>
