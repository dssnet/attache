<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { Send, OctagonX } from "lucide-vue-next";
import Modal from "./Modal.vue";
import Button from "../ui/Button.vue";
import { useMarkdown } from "../../composables/useMarkdown";
import type { AgentDisplayMessage } from "../../composables/useWebSocket";

const md = useMarkdown();

const props = defineProps<{
  agent: {
    id: string;
    task: string;
    status: "running" | "completed";
    displayMessages: AgentDisplayMessage[];
  } | null;
}>();

const emit = defineEmits<{
  close: [];
  "send-message": [agentId: string, message: string];
  "kill-agent": [agentId: string];
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

function renderMarkdown(content: string): string {
  return md.value.render(content);
}

function formatToolInput(input: Record<string, any> | undefined): string {
  if (!input) return "";
  return JSON.stringify(input, null, 2);
}

function isShortOutput(output: string | undefined): boolean {
  if (!output) return true;
  return output.length < 300;
}

watch(
  () => props.agent?.displayMessages,
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
        >&#9679;</span
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
        <div class="flex items-center gap-3">
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
          <Button
            v-if="agent.status === 'running'"
            variant="danger"
            size="sm"
            @click="emit('kill-agent', agent.id)"
          >
            <span class="flex items-center gap-1.5">
              <OctagonX :size="14" />
              Kill Agent
            </span>
          </Button>
        </div>
      </div>
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Conversation
        </h3>
        <div
          ref="agentLogContainer"
          class="bg-bg-input border border-border-primary rounded-lg p-4 max-h-[500px] overflow-y-auto"
        >
          <div
            v-for="(msg, idx) in agent.displayMessages"
            :key="idx"
            class="mb-3 last:mb-0"
          >
            <!-- Thinking: left-aligned agent bubble -->
            <div v-if="msg.type === 'thinking'" class="flex justify-start">
              <div
                class="bg-bg-message rounded-lg py-2.5 px-3.5 max-w-[85%] text-text-primary text-sm leading-relaxed"
              >
                <div
                  class="markdown-content whitespace-normal"
                  v-html="renderMarkdown(msg.content)"
                ></div>
              </div>
            </div>

            <!-- Tool call: left-aligned block with input + output -->
            <div v-else-if="msg.type === 'tool_call'" class="flex justify-start">
              <div
                class="bg-bg-card border border-border-primary rounded-lg py-2 px-3 max-w-[85%] text-sm"
              >
                <div class="flex items-center gap-1.5 text-text-secondary">
                  <span class="text-xs">&#128295;</span>
                  <span class="font-mono font-semibold text-text-primary text-xs">{{ msg.toolName }}</span>
                </div>
                <details
                  v-if="msg.toolInput && Object.keys(msg.toolInput).length > 0"
                  class="mt-1.5"
                >
                  <summary
                    class="text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none"
                  >
                    Input
                  </summary>
                  <pre
                    class="mt-1 p-2 bg-bg-input rounded text-[11px] max-h-40 overflow-auto whitespace-pre-wrap text-text-secondary"
                  >{{ formatToolInput(msg.toolInput) }}</pre>
                </details>
                <details
                  v-if="msg.toolOutput"
                  :open="isShortOutput(msg.toolOutput)"
                  class="mt-1.5"
                >
                  <summary
                    class="text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none"
                  >
                    Output
                  </summary>
                  <pre
                    class="mt-1 p-2 bg-bg-input rounded text-[11px] max-h-60 overflow-auto whitespace-pre-wrap text-text-secondary"
                  >{{ msg.toolOutput }}</pre>
                </details>
              </div>
            </div>

            <!-- Send to main: right-aligned highlighted bubble -->
            <div
              v-else-if="msg.type === 'send_to_main'"
              class="flex justify-end"
            >
              <div
                class="bg-primary text-white rounded-lg py-2.5 px-3.5 max-w-[85%] text-sm leading-relaxed"
              >
                <div
                  class="text-[10px] uppercase tracking-wider opacity-70 mb-1"
                >
                  Sent to Main
                </div>
                <div
                  class="markdown-content whitespace-normal"
                  v-html="renderMarkdown(msg.content)"
                ></div>
              </div>
            </div>

            <!-- User message (from main): right-aligned bubble -->
            <div
              v-else-if="msg.type === 'user_message'"
              class="flex justify-end"
            >
              <div
                class="bg-bg-tertiary rounded-lg py-2.5 px-3.5 max-w-[85%] text-text-primary text-sm leading-relaxed"
              >
                <div
                  class="text-[10px] uppercase tracking-wider text-text-secondary mb-1"
                >
                  From Main
                </div>
                {{ msg.content }}
              </div>
            </div>

            <!-- System message: centered, muted -->
            <div v-else-if="msg.type === 'system'" class="flex justify-center">
              <div class="text-text-secondary text-xs italic py-1 px-3">
                {{ msg.content }}
              </div>
            </div>
          </div>
          <div
            v-if="!agent.displayMessages.length"
            class="text-center text-text-secondary italic py-8"
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
