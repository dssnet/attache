<script setup lang="ts">
import { ref } from "vue";
import MessageInput from "../chat/MessageInput.vue";

const emit = defineEmits<{
  submit: [message: string];
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
  <div class="flex-1 flex items-center justify-center p-8">
    <div class="max-w-3xl w-full flex flex-col items-center gap-8">
      <h1 class="text-3xl font-normal text-center text-text-primary m-0">
        How can I help you today?
      </h1>
      <div class="w-full max-w-3xl">
        <MessageInput
          ref="inputComponent"
          v-model="message"
          variant="empty-state"
          @submit="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>
