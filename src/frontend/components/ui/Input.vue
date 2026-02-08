<script setup lang="ts">
import { computed, ref } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";

const props = defineProps<{
  type?: "text" | "password" | "email" | "number" | "search" | "tel" | "url";
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  secret?: boolean;
}>();

const modelValue = defineModel<string | number>({ required: true });

const showSecret = ref(false);

const resolvedType = computed(() => {
  if (props.secret) return showSecret.value ? "text" : "password";
  return props.type ?? "text";
});

const sizeClasses = computed(() => {
  const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  };
  return sizes[props.size ?? "md"];
});

const leftPaddingClasses = computed(() => {
  const sizes = {
    sm: "pl-9",
    md: "pl-10",
    lg: "pl-11",
  };
  return sizes[props.size ?? "md"];
});

const rightPaddingClasses = computed(() => {
  const sizes = {
    sm: "pr-9",
    md: "pr-10",
    lg: "pr-11",
  };
  return sizes[props.size ?? "md"];
});
</script>

<template>
  <div class="relative flex items-center w-full">
      <span
        v-if="$slots.left"
        class="absolute left-3 text-text-secondary pointer-events-none"
      >
        <slot name="left" />
      </span>
      <input
        v-model="modelValue"
        :type="resolvedType"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200',
          'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
          error
            ? 'border border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
            : 'border border-border-primary focus:border-border-secondary',
          sizeClasses,
          $slots.left ? leftPaddingClasses : '',
          ($slots.right || secret) ? rightPaddingClasses : '',
        ]"
      />
      <button
        v-if="secret"
        type="button"
        class="absolute right-3 text-text-secondary hover:text-text-primary transition-colors"
        @click="showSecret = !showSecret"
      >
        <EyeOff v-if="showSecret" :size="16" />
        <Eye v-else :size="16" />
      </button>
      <span
        v-else-if="$slots.right"
        class="absolute right-3 text-text-secondary pointer-events-none"
      >
        <slot name="right" />
      </span>
    </div>
    <span v-if="error" class="text-xs text-red-500">{{ error }}</span>
</template>
