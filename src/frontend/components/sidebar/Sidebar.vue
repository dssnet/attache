<script setup lang="ts">
import { Settings, LogOut } from "lucide-vue-next";
import SidebarHeader from "./SidebarHeader.vue";
import AgentsList from "../agents/AgentsList.vue";
import Button from "../ui/Button.vue";
import type { AgentDisplayMessage } from "../../composables/useWebSocket";

const isTauri = !!(window as any).__TAURI__;

function disconnect() {
  (window as any).__TAURI__?.core?.invoke("disconnect");
}

defineProps<{
  connected: boolean;
  collapsed: boolean;
  agents: Array<{
    id: string;
    task: string;
    status: "running" | "completed";
    displayMessages: AgentDisplayMessage[];
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

    <div class="border-t border-border-primary p-3 flex flex-col gap-1">
      <Button
        variant="ghost"
        full-width
        class="flex items-center justify-start gap-2"
        @click="emit('open-settings')"
      >
        <Settings :size="20" />
        Settings
      </Button>
      <Button
        v-if="isTauri"
        variant="ghost"
        full-width
        class="flex items-center justify-start gap-2"
        @click="disconnect"
      >
        <LogOut :size="20" />
        Disconnect
      </Button>
    </div>
  </div>
</template>
