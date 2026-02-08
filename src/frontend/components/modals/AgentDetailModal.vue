<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { Send } from "lucide-vue-next";
import Modal from "./Modal.vue";
import Button from "../ui/Button.vue";

const props = defineProps<{
  agent: {
    id: string;
    task: string;
    status: "running" | "completed";
    messages: string[];
  } | null;
}>();

const emit = defineEmits<{
  close: [];
  "send-message": [agentId: string, message: string];
}>();

const agentMessageInput = ref("");
const agentLogContainer = ref<HTMLElement | null>(null);

function sendAgentMessage() {
  if (!props.agent) return;

  const message = agentMessageInput.value.trim();
  if (!message) return;

  emit("send-message", props.agent.id, message);
  agentMessageInput.value = "";
}

function scrollAgentLogToBottom() {
  if (agentLogContainer.value) {
    agentLogContainer.value.scrollTop = agentLogContainer.value.scrollHeight;
  }
}

watch(
  () => props.agent?.messages,
  async () => {
    await nextTick();
    scrollAgentLogToBottom();
  },
  { deep: true },
);
</script>

<template>
  <Modal :show="agent !== null" title="Agent Details" @close="emit('close')">
    <template #title-icon>
      <span
        :class="[
          'text-[10px] leading-none shrink-0',
          agent?.status === 'running'
            ? 'text-primary animate-pulse-fast'
            : 'text-emerald-500',
        ]"
        >●</span
      >
    </template>
    <template v-if="agent">
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Agent ID
        </h3>
        <p
          class="font-mono text-[13px] bg-bg-input py-2 px-3 rounded-md border border-border-primary text-text-secondary m-0"
        >
          {{ agent.id }}
        </p>
      </div>
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Task
        </h3>
        <p class="text-text-primary m-0 leading-relaxed">{{ agent.task }}</p>
      </div>
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Status
        </h3>
        <p
          :class="[
            'inline-block py-1.5 px-3 rounded-md text-sm font-medium uppercase m-0',
            agent.status === 'running'
              ? 'bg-status-running-bg text-status-running-text'
              : 'bg-status-completed-bg text-status-completed-text',
          ]"
        >
          {{ agent.status }}
        </p>
      </div>
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Activity Log
        </h3>
        <div
          ref="agentLogContainer"
          class="bg-bg-input border border-border-primary rounded-lg p-4 max-h-100 overflow-y-auto"
        >
          <div
            v-for="(msg, idx) in agent.messages"
            :key="idx"
            class="p-3 mb-2 last:mb-0 bg-bg-card border-l-3 border-l-primary rounded text-text-primary text-sm leading-normal whitespace-pre-wrap wrap-break-word"
          >
            {{ msg }}
          </div>
          <div
            v-if="!agent.messages.length"
            class="text-center text-border-secondary italic py-8"
          >
            No activity yet...
          </div>
        </div>
      </div>
      <div v-if="agent.status === 'running'">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Send Message to Agent
        </h3>
        <form @submit.prevent="sendAgentMessage" class="mt-2">
          <div class="relative flex items-center">
            <input
              v-model="agentMessageInput"
              type="text"
              placeholder="Type a message to the agent..."
              class="w-full py-3 pl-4 pr-12 bg-bg-input border border-border-primary rounded-lg text-text-primary text-sm font-inherit transition-colors focus:outline-none focus:border-border-secondary"
            />
            <Button
              type="submit"
              :disabled="!agentMessageInput.trim()"
              icon
              size="sm"
              class="absolute right-2"
            >
              <Send :size="18" />
            </Button>
          </div>
        </form>
      </div>
    </template>
  </Modal>
</template>
