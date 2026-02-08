<script setup lang="ts">
import { Bot } from "lucide-vue-next";
import Label from "./Label.vue";

defineProps<{
  content: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <Label label="Agent message" @click="emit('click')">
    <Bot class="size-4 shrink-0" />
  </Label>
</template>
