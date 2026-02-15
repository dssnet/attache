<script setup lang="ts">
import { PanelLeft } from "lucide-vue-next";
import Button from "../ui/Button.vue";

const emit = defineEmits<{
  copy: [];
  "clear-context": [];
  "collapse-sidebar": [];
}>();
</script>

<template>
  <div class="p-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <img
        src="/logo.svg"
        alt="Attaché"
        class="w-8 h-8 object-contain filter-(--logo-filter)"
      />
      <span class="font-semibold text-base text-text-primary">Attaché</span>
    </div>
    <div class="flex gap-2">
      <Button
        variant="ghost"
        icon
        size="sm"
        @click="emit('collapse-sidebar')"
        title="Hide sidebar"
      >
        <PanelLeft :size="18" />
      </Button>
    </div>
  </div>
</template>
