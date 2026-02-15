<script setup lang="ts">
import {
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  Info,
  X,
} from "lucide-vue-next";
import { useToast, type ToastType } from "../../composables/useToast";

const { toasts, dismiss } = useToast();

const icons: Record<ToastType, any> = {
  error: CircleAlert,
  success: CircleCheck,
  warning: TriangleAlert,
  info: Info,
};

const typeClasses: Record<ToastType, string> = {
  error:
    "bg-toast-error-bg/90 text-toast-error-text border-toast-error-text/20",
  success:
    "bg-toast-success-bg/90 text-toast-success-text border-toast-success-text/20",
  warning:
    "bg-toast-warning-bg/90 text-toast-warning-text border-toast-warning-text/20",
  info: "bg-toast-info-bg/90 text-toast-info-text border-toast-info-text/20",
};
</script>

<template>
  <div
    class="absolute left-0 right-0 top-[max(3.5rem,calc(env(safe-area-inset-top)+3rem))] md:top-0 z-30 flex flex-col gap-2 pointer-events-none px-4 pt-2 md:pt-4 max-w-200 mx-auto"
  >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
        move-class="transition-all duration-200 ease-in-out"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto backdrop-blur-sm px-4 py-2.5 text-sm rounded-radius border flex items-center gap-2.5 shadow-lg cursor-pointer',
            typeClasses[toast.type],
          ]"
          @click="dismiss(toast.id)"
        >
          <component
            :is="icons[toast.type]"
            :size="16"
            class="shrink-0 opacity-80"
          />
          <span class="flex-1">{{ toast.message }}</span>
          <X
            :size="14"
            class="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      </TransitionGroup>
  </div>
</template>
