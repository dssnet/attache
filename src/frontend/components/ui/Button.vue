<script setup lang="ts">
import { computed } from "vue";
import { Loader2 } from "lucide-vue-next";

const props = defineProps<{
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: boolean;
}>();

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const sizeClasses = computed(() => {
  if (props.icon) {
    const sizes = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-12 h-12",
    };
    return sizes[props.size ?? "md"];
  }
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  };
  return sizes[props.size ?? "md"];
});

const variantClasses = computed(() => {
  const variants = {
    primary:
      "bg-primary text-white [&:hover:not(:disabled)]:bg-primary-hover [&:active:not(:disabled)]:bg-primary-active",
    secondary:
      "bg-bg-secondary border border-border-primary text-text-primary [&:hover:not(:disabled)]:bg-bg-hover",
    ghost:
      "bg-transparent text-text-primary [&:hover:not(:disabled)]:bg-bg-hover",
    danger:
      "bg-red-500/10 text-red-500 border border-red-500/20 [&:hover:not(:disabled)]:bg-red-500/20",
  };
  return variants[props.variant ?? "primary"];
});

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit("click", event);
  }
}
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    :class="[
      'rounded-lg font-semibold transition-all duration-200',
      'disabled:opacity-60 disabled:cursor-not-allowed shrink-0',
      sizeClasses,
      variantClasses,
      fullWidth ? 'w-full' : '',
      icon ? 'flex items-center justify-center' : '',
    ]"
    @click="handleClick"
  >
    <span v-if="loading" class="flex items-center justify-center gap-2">
      <Loader2 :size="16" class="animate-spin" />
      <slot />
    </span>
    <slot v-else />
  </button>
</template>
