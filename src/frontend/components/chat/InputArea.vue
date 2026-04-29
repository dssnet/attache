<script setup lang="ts">
import { ref, computed } from "vue";
import QueueIndicator from "../common/QueueIndicator.vue";
import MessageInput from "./MessageInput.vue";
import { useConfig } from "../../composables/useConfig";

const props = defineProps<{
  queuedMessages: Array<{
    content: string;
    timestamp: number;
  }>;
  contextPercent?: number;
  pinnedToBottom?: boolean;
  isGenerating?: boolean;
}>();

const emit = defineEmits<{
  submit: [message: string];
  "remove-queued": [index: number];
  stop: [];
}>();

const message = ref("");
const inputComponent = ref<InstanceType<typeof MessageInput> | null>(null);

const { config } = useConfig();
const currentInfo = computed(() => {
  const cfg = config.value;
  if (!cfg) return null;
  const name = cfg.models.default;
  const provider = cfg.models.providers[name];
  if (!provider) return null;
  return {
    provider: name,
    model: provider.model,
    maxTokens: provider.maxTokens,
    temperature: provider.temperature,
  };
});

function handleSubmit(msg: string) {
  emit("submit", msg);
  message.value = "";
}

defineExpose({ inputElement: () => inputComponent.value?.inputElement });
</script>

<template>
  <div class="relative">
    <div
      class="pointer-events-none absolute bottom-full left-0 right-0 h-6 bg-linear-to-t from-bg-primary to-transparent transition-opacity duration-200"
      :class="pinnedToBottom ? 'opacity-0' : 'opacity-100'"
    />
    <div
      class="relative z-30 pt-2 pb-3 px-4 pr-[max(1rem,env(safe-area-inset-right))] bg-bg-primary/80 backdrop-blur-xl"
    >
      <QueueIndicator
        :queuedMessages="queuedMessages"
        @remove="(idx) => emit('remove-queued', idx)"
      />
      <div class="max-w-200 mx-auto">
        <MessageInput
          ref="inputComponent"
          v-model="message"
          :contextPercent="contextPercent"
          :isGenerating="isGenerating"
          @submit="handleSubmit"
          @stop="emit('stop')"
        />
        <div
          v-if="currentInfo"
          class="text-[10px] text-text-secondary text-center mt-1.5 truncate flex items-center justify-center gap-1.5"
        >
          <span>{{ currentInfo.model || "no model" }}</span>
          <span class="opacity-50">·</span>
          <span>{{ currentInfo.provider }}</span>
          <span class="opacity-50">·</span>
          <span>temp {{ currentInfo.temperature }}</span>
          <span class="opacity-50">·</span>
          <span>{{ currentInfo.maxTokens.toLocaleString() }} tok</span>
        </div>
      </div>
    </div>
  </div>
</template>
