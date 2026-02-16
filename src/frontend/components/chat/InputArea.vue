<script setup lang="ts">
import { ref } from "vue";
import QueueIndicator from "../common/QueueIndicator.vue";
import MessageInput from "./MessageInput.vue";

const props = defineProps<{
  queuedMessages: Array<{
    content: string;
    timestamp: number;
  }>;
  contextPercent?: number;
}>();

const emit = defineEmits<{
  submit: [message: string];
  "remove-queued": [index: number];
}>();

const message = ref("");
const inputComponent = ref<InstanceType<typeof MessageInput> | null>(null);

function handleSubmit(msg: string) {
  emit("submit", msg);
  message.value = "";
}

defineExpose({ inputElement: () => inputComponent.value?.inputElement });
</script>

<template>
  <div class="relative z-10">
    <div class="pointer-events-none absolute bottom-full left-0 right-0 h-12 bg-gradient-to-t from-bg-primary to-transparent" />
    <div class="pt-2 pb-3 px-4 pr-[max(1rem,env(safe-area-inset-right))] bg-bg-primary/80 backdrop-blur-xl">
    <QueueIndicator
      :queuedMessages="queuedMessages"
      @remove="(idx) => emit('remove-queued', idx)"
    />
    <div class="max-w-200 mx-auto">
      <MessageInput
        ref="inputComponent"
        v-model="message"
        :contextPercent="contextPercent"
        @submit="handleSubmit"
      />
    </div>
    </div>
  </div>
</template>
