<script setup lang="ts">
import { ref } from "vue";
import { PanelLeft, Menu, SquarePen, ArrowDown } from "lucide-vue-next";
import EmptyState from "../common/EmptyState.vue";
import ChatMessages from "./ChatMessages.vue";
import InputArea from "./InputArea.vue";
import Button from "../ui/Button.vue";
import ToastContainer from "../ui/ToastContainer.vue";

const chatMessagesRef = ref<InstanceType<typeof ChatMessages> | null>(null);

defineProps<{
  sidebarCollapsed: boolean;
  connected: boolean;
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
      class="md:hidden flex items-center justify-between px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] bg-bg-secondary/80 backdrop-blur-md border-b border-border-primary z-20"
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

    <ToastContainer />

    <!-- Empty State -->
    <EmptyState
      v-if="connected && visibleMessages.length === 0"
      @submit="(msg) => emit('submit', msg)"
    />

    <!-- Chat Messages -->
    <div v-else class="flex-1 flex flex-col overflow-hidden relative">
      <ChatMessages
        ref="chatMessagesRef"
        :visibleMessages="visibleMessages"
        :loading="loading"
        :compacting="compacting"
        :toolCalls="toolCalls"
        :originalMessages="originalMessages"
        @tool-call-click="(tc) => emit('tool-call-click', tc)"
        @agent-message-click="(content) => emit('agent-message-click', content)"
      />
      <!-- Scroll to bottom button -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200"
        leave-to-class="opacity-0"
      >
        <Button
          v-if="chatMessagesRef && !chatMessagesRef.pinnedToBottom"
          icon
          size="sm"
          variant="secondary"
          class="absolute bottom-24 left-1/2 -translate-x-1/2 shadow-md rounded-full! z-10"
          @click="chatMessagesRef?.scrollToBottom()"
        >
          <ArrowDown :size="16" />
        </Button>
      </Transition>
      <InputArea
        :queuedMessages="queuedMessages"
        :contextPercent="contextPercent"
        @submit="(msg) => emit('submit', msg)"
        @remove-queued="(idx) => emit('remove-queued', idx)"
      />
    </div>
  </div>
</template>
