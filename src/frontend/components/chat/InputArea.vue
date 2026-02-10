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
  <div class="input-area pt-2 pb-3 px-4 pr-[max(1rem,env(safe-area-inset-right))] z-10">
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
</template>
