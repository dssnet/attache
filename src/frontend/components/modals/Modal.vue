<script setup lang="ts">
import ModalHeader from "./components/ModalHeader.vue";
import { useModalSwipe } from "../../composables/useModalSwipe";

defineProps<{
  show: boolean;
  title: string;
  noPadding?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { modalRef } = useModalSwipe(() => emit("close"));
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-200"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 bg-overlay flex items-end md:items-center justify-center z-1000"
      @click="emit('close')"
    >
      <Transition
        appear
        enter-active-class="transition-transform duration-300 ease-out md:transition-none"
        enter-from-class="translate-y-full md:translate-y-0"
        leave-active-class="transition-transform duration-150 ease-in md:transition-none"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full md:translate-y-0"
      >
        <div
          v-if="show"
          ref="modalRef"
          class="modal-content overflow-hidden bg-bg-secondary border border-border-primary flex flex-col shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] w-full h-[calc(100dvh-env(safe-area-inset-top))] rounded-t-2xl md:rounded-2xl md:h-auto md:w-[90%] md:max-w-200 md:max-h-[80vh]"
          @click.stop
        >
          <ModalHeader :title="title" @close="emit('close')">
            <template v-if="$slots['header-left-action']" #left-action>
              <slot name="header-left-action" />
            </template>
            <template #icon>
              <slot name="title-icon" />
            </template>
          </ModalHeader>
          <div :class="['overflow-y-scroll flex-1', noPadding ? '' : 'p-6']">
            <slot />
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
