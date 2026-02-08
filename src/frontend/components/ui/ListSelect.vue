<script setup lang="ts">
defineProps<{
  items: string[];
  modelValue: string | null;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="border border-border-primary rounded-lg overflow-hidden">
    <button
      v-for="item in items"
      :key="item"
      :class="[
        'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border-primary last:border-b-0',
        modelValue === item
          ? 'bg-primary/10 text-primary'
          : 'text-text-primary hover:bg-bg-hover',
      ]"
      @click="$emit('update:modelValue', item)"
    >
      <div class="flex items-center gap-2">
        <slot name="label" :item="item">
          <span class="font-medium">{{ item }}</span>
        </slot>
        <slot name="badge" :item="item" />
      </div>
      <slot name="action" :item="item" />
    </button>
  </div>
</template>
