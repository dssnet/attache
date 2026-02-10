<script setup lang="ts">
import { PanelLeft, CircleAlert, Menu, SquarePen } from "lucide-vue-next";
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
  "clear-context": [];
}>();
</script>

<template>
  <div
    class="main-container flex-1 min-w-0 flex flex-col relative bg-bg-primary overflow-hidden"
  >
    <!-- Mobile top bar -->
    <div
      class="md:hidden flex items-center justify-between px-3 py-2 bg-bg-secondary border-b border-border-primary z-20"
    >
      <Button
        variant="ghost"
        icon
        size="sm"
        title="Show sidebar"
        @click="emit('toggle-sidebar')"
      >
        <Menu :size="18" />
      </Button>
      <span class="font-semibold text-sm text-text-primary">Attaché</span>
      <Button
        variant="ghost"
        icon
        size="sm"
        title="Clear chat"
        @click="emit('clear-context')"
      >
        <SquarePen :size="18" />
      </Button>
    </div>

    <!-- Desktop sidebar toggle when collapsed -->
    <div
      class="hidden md:block absolute top-4 left-4 z-20 bg-bg-primary/60 backdrop-blur-sm rounded-lg"
    >
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
      class="bg-error-bg/90 backdrop-blur-sm text-error-text px-4 py-2.5 text-sm mx-4 mt-4 rounded-radius border border-error-text/20 flex items-center gap-2.5 shadow-lg md:absolute md:left-0 md:right-0 md:top-0 md:z-10"
    >
      <CircleAlert :size="16" class="shrink-0 opacity-80" />
      <span>{{ error }}</span>
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
