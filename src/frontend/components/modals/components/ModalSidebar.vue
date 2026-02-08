<script setup lang="ts">
defineProps<{
  sections: { id: string; label: string; icon: any }[];
  activeSection: string;
}>();

const emit = defineEmits<{
  "update:activeSection": [value: string];
}>();
</script>

<template>
  <nav
    class="w-48 shrink-0 border-r border-border-primary bg-bg-primary p-2 flex flex-col gap-px"
  >
    <button
      v-for="section in sections"
      :key="section.id"
      :class="[
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left w-full',
        activeSection === section.id
          ? 'bg-primary text-white'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      ]"
      @click="emit('update:activeSection', section.id)"
    >
      <component :is="section.icon" :size="16" />
      {{ section.label }}
    </button>
  </nav>
</template>
