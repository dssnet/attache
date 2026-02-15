<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";

defineProps<{
  sections: { id: string; label: string; icon: any }[];
  activeSection: string;
  /** Mobile drill-down: true when showing a section's content */
  mobileOpen: boolean;
}>();

const emit = defineEmits<{
  "update:activeSection": [value: string];
  "update:mobileOpen": [value: boolean];
}>();

function selectSection(id: string) {
  emit("update:activeSection", id);
  emit("update:mobileOpen", true);
}
</script>

<template>
  <!-- Mobile: full-screen menu list (always rendered for slide animation) -->
  <nav
    class="md:hidden w-full shrink-0 overflow-y-scroll p-3"
  >
    <div class="min-h-[calc(100%+1px)] flex flex-col gap-0.5">
      <button
        v-for="section in sections"
        :key="section.id"
        class="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors w-full text-left text-text-primary"
        @click="selectSection(section.id)"
      >
        <component :is="section.icon" :size="18" class="text-text-secondary" />
        {{ section.label }}
        <ChevronRight :size="16" class="ml-auto text-text-muted" />
      </button>
    </div>
  </nav>

  <!-- Desktop: vertical sidebar (always visible) -->
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
