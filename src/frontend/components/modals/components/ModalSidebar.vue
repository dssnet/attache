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
  <!-- Mobile: horizontal scrollable tabs -->
  <nav
    class="md:hidden shrink-0 border-b border-border-primary bg-bg-primary px-2 pt-1 flex gap-1 overflow-x-auto"
  >
    <button
      v-for="section in sections"
      :key="section.id"
      :class="[
        'flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap',
        activeSection === section.id
          ? 'bg-primary text-white'
          : 'text-text-secondary',
      ]"
      @click="emit('update:activeSection', section.id)"
    >
      <component :is="section.icon" :size="14" />
      {{ section.label }}
    </button>
  </nav>

  <!-- Desktop: vertical sidebar -->
  <nav
    class="hidden md:flex w-48 shrink-0 border-r border-border-primary bg-bg-primary p-2 flex-col gap-px"
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
