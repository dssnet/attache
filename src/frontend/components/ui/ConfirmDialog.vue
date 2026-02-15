<script setup lang="ts">
import Button from "./Button.vue";

defineProps<{
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger";
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Teleport to="body">
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 bg-overlay flex items-center justify-center z-1000 px-4"
      @click="emit('cancel')"
    >
      <div
        class="bg-bg-secondary border border-border-primary rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] w-full max-w-72 overflow-hidden"
        @click.stop
      >
        <div class="p-5 pb-3">
          <h3 class="text-base font-semibold text-text-primary mb-1">
            {{ title }}
          </h3>
          <p class="text-sm text-text-secondary">{{ message }}</p>
        </div>
        <div class="flex gap-3 px-5 pb-5 *:flex-1 *:min-w-0">
          <Button
            variant="secondary"
            full-width
            size="sm"
            @click="emit('cancel')"
          >
            {{ cancelText ?? "Cancel" }}
          </Button>
          <Button
            :variant="variant ?? 'primary'"
            full-width
            size="sm"
            @click="emit('confirm')"
          >
            {{ confirmText ?? "Confirm" }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
