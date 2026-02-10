<script setup lang="ts">
import { Trash2 } from "lucide-vue-next";
import AgentItem from "./AgentItem.vue";
import Button from "../ui/Button.vue";
import type { AgentDisplayMessage } from "../../composables/useWebSocket";

defineProps<{
  agents: Array<{
    id: string;
    task: string;
    status: "running" | "completed";
    displayMessages: AgentDisplayMessage[];
  }>;
}>();

const emit = defineEmits<{
  "agent-click": [agentId: string];
  "clear-agents": [];
}>();
</script>

<template>
  <div v-if="agents.length > 0" class="mb-4">
    <div class="flex items-center justify-between pr-3">
      <h3
        class="text-xs font-semibold text-text-primary uppercase py-2 px-3 m-0 flex-1"
      >
        Active Agents
      </h3>
      <Button
        variant="ghost"
        icon
        size="sm"
        class="w-6 h-6"
        @click="emit('clear-agents')"
        title="Clear all agents"
      >
        <Trash2 :size="14" />
      </Button>
    </div>
    <div class="flex flex-col gap-1">
      <AgentItem
        v-for="agent in agents"
        :key="agent.id"
        :agent="agent"
        @click="emit('agent-click', agent.id)"
      />
    </div>
  </div>
  <div v-else class="px-3 py-4 text-center">
    <p class="text-text-secondary text-sm">No active agents</p>
  </div>
</template>
