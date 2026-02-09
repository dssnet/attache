<script setup lang="ts">
import { ref } from "vue";
import QueueIndicator from "../common/QueueIndicator.vue";
import MessageInput from "./MessageInput.vue";
import Button from "../ui/Button.vue";
import { ArrowDown } from "lucide-vue-next";

const props = defineProps<{
  queuedMessages: Array<{
    content: string;
    timestamp: number;
  }>;
  pinnedToBottom?: boolean;
  contextPercent?: number;
}>();

const emit = defineEmits<{
  submit: [message: string];
  "remove-queued": [index: number];
  "scroll-to-bottom": [];
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
  <div class="input-area py-4 z-10">
    <!-- Scroll to bottom button -->
    <Button
      icon
      size="sm"
      variant="secondary"
      :class="[
        'mx-auto mb-8 shadow-md rounded-full!',
        pinnedToBottom ? 'invisible' : '',
      ]"
      @click="emit('scroll-to-bottom')"
    >
      <ArrowDown :size="16" />
    </Button>

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
