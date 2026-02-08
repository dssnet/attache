<script setup lang="ts">
import ModalHeader from "./components/ModalHeader.vue";

defineProps<{
  show: boolean;
  title: string;
  noPadding?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-overlay flex items-center justify-center z-1000"
    @click="emit('close')"
  >
    <div
      class="modal-content overflow-hidden bg-bg-secondary border border-border-primary rounded-2xl w-[90%] max-w-200 max-h-[80vh] flex flex-col shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)]"
      @click.stop
    >
      <ModalHeader :title="title" @close="emit('close')">
        <template #icon>
          <slot name="title-icon" />
        </template>
      </ModalHeader>
      <div :class="['overflow-y-auto flex-1', noPadding ? '' : 'p-6']">
        <slot />
      </div>
    </div>
  </div>
</template>
