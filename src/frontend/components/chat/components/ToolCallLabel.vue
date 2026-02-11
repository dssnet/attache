<script setup lang="ts">
import { Wrench } from "lucide-vue-next";
import Label from "./Label.vue";

defineProps<{
  toolCall: {
    toolName: string;
    toolInput: Record<string, any>;
  };
}>();

const emit = defineEmits<{
  click: [];
}>();

function formatToolName(toolName: string): string {
  return toolName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getToolDescription(
  toolName: string,
  toolInput: Record<string, any>,
): string {
  switch (toolName) {
    case "start_agent":
      return toolInput.task
        ? `Starting agent: ${toolInput.task}`
        : "Starting agent";
    case "send_to_agent":
      return "Sending message to agent";
    case "get_active_agents":
      return "Checking active agents";
    default:
      return formatToolName(toolName);
  }
}
</script>

<template>
  <Label
    :label="getToolDescription(toolCall.toolName, toolCall.toolInput)"
    @click="emit('click')"
  >
    <Wrench class="size-4 shrink-0" />
  </Label>
</template>
