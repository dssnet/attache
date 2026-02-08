<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import SidebarHeader from "./SidebarHeader.vue";
import AgentsList from "../agents/AgentsList.vue";
import Button from "../ui/Button.vue";

defineProps<{
  connected: boolean;
  copied: boolean;
  collapsed: boolean;
  agents: Array<{
    id: string;
    task: string;
    status: "running" | "completed";
    messages: string[];
  }>;
}>();

const emit = defineEmits<{
  copy: [];
  "clear-context": [];
  "agent-click": [agentId: string];
  "clear-agents": [];
  "open-settings": [];
  "collapse-sidebar": [];
}>();
</script>

<template>
  <div
    :class="[
      'shrink-0 flex flex-col bg-bg-secondary transition-transform duration-300 ease-in-out',
      'w-full md:w-65 md:m-4 md:rounded-radius md:border md:border-border-primary',
      collapsed ? 'md:-translate-x-full' : 'translate-x-0',
    ]"
  >
    <SidebarHeader
      :copied="copied"
      @copy="emit('copy')"
      @clear-context="emit('clear-context')"
      @collapse-sidebar="emit('collapse-sidebar')"
    />

    <div class="flex-1 overflow-y-auto p-2">
      <AgentsList
        :agents="agents"
        @agent-click="(id: string) => emit('agent-click', id)"
        @clear-agents="emit('clear-agents')"
      />
    </div>

    <div class="p-3">
      <Button
        variant="secondary"
        full-width
        class="flex items-center justify-center gap-2 mb-2"
        @click="emit('open-settings')"
      >
        <Settings :size="16" />
        Settings
      </Button>
      <div
        class="flex items-center justify-center gap-2 text-xs text-text-secondary py-2"
      >
        <span
          :class="[
            'w-2 h-2 rounded-full',
            connected ? 'bg-emerald-500' : 'bg-red-500',
          ]"
        ></span>
        {{ connected ? "Connected" : "Disconnected" }}
      </div>
    </div>
  </div>
</template>
