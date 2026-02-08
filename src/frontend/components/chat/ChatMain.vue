<script setup lang="ts">
import { PanelLeft } from "lucide-vue-next";
import EmptyState from "../common/EmptyState.vue";
import ChatMessages from "./ChatMessages.vue";
import InputArea from "./InputArea.vue";
import Button from "../ui/Button.vue";

defineProps<{
  sidebarCollapsed: boolean;
  connected: boolean;
  error: string | null;
  visibleMessages: Array<{
    role: "user" | "assistant" | "agent";
    content: string;
  }>;
  loading: boolean;
  compacting: boolean;
  queuedMessages: Array<{
    content: string;
    timestamp: number;
  }>;
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
  contextPercent: number;
}>();

const emit = defineEmits<{
  submit: [message: string];
  "tool-call-click": [
    toolCall: { toolName: string; toolInput: Record<string, any> },
  ];
  "agent-message-click": [content: string];
  "remove-queued": [index: number];
  "toggle-sidebar": [];
}>();
</script>

<template>
  <div
    class="main-container flex-1 min-w-0 flex flex-col relative bg-bg-primary overflow-hidden"
  >
    <!-- Mobile top bar with sidebar toggle -->
    <div
      v-if="sidebarCollapsed"
      class="md:hidden flex items-center px-3 py-2 bg-bg-secondary border-b border-border-primary z-20"
    >
      <Button
        variant="ghost"
        icon
        size="sm"
        class="opacity-50"
        title="Show sidebar"
        @click="emit('toggle-sidebar')"
      >
        <PanelLeft :size="18" />
      </Button>
    </div>

    <!-- Desktop sidebar toggle when collapsed -->
    <div class="hidden md:block absolute top-4 left-4 z-20 opacity-50">
      <Transition
        enter-active-class="transition-opacity duration-300 delay-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <Button
          v-if="sidebarCollapsed"
          variant="ghost"
          icon
          size="sm"
          title="Show sidebar"
          @click="emit('toggle-sidebar')"
        >
          <PanelLeft :size="18" />
        </Button>
      </Transition>
    </div>

    <div
      v-if="error"
      class="absolute top-0 left-0 right-0 z-10 bg-error-bg text-error-text px-6 py-3 text-center text-sm m-4 rounded-radius border border-border-primary"
    >
      {{ error }}
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="connected && visibleMessages.length === 0"
      @submit="(msg) => emit('submit', msg)"
    />

    <!-- Chat Messages -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <ChatMessages
        :visibleMessages="visibleMessages"
        :loading="loading"
        :compacting="compacting"
        :toolCalls="toolCalls"
        :originalMessages="originalMessages"
        @tool-call-click="(tc) => emit('tool-call-click', tc)"
        @agent-message-click="(content) => emit('agent-message-click', content)"
      >
        <template #default="{ pinnedToBottom, scrollToBottom }">
          <InputArea
            class="sticky bottom-0 mt-auto"
            :queuedMessages="queuedMessages"
            :pinnedToBottom="pinnedToBottom"
            :contextPercent="contextPercent"
            @submit="(msg) => emit('submit', msg)"
            @remove-queued="(idx) => emit('remove-queued', idx)"
            @scroll-to-bottom="scrollToBottom"
          />
        </template>
      </ChatMessages>
    </div>
  </div>
</template>
