<script setup lang="ts">
import { ref, watch } from "vue";
import { Cpu, Wrench, Palette, User, Plug, Brain } from "lucide-vue-next";
import Modal from "../Modal.vue";
import ModalSidebar from "../components/ModalSidebar.vue";
import AppearanceSection from "./pages/Appearance.vue";
import AccountSection from "./pages/Account.vue";
import ModelSection from "./pages/Model.vue";
import ToolsSection from "./pages/Tools.vue";
import McpServersSection from "./pages/MCP-Severs.vue";
import MemorySection from "./pages/Memory.vue";
import { useConfig } from "../../../composables/useConfig";

const { getConfig, getMcpStatus } = useConfig();

const props = defineProps<{
  show: boolean;
  theme: "dark" | "light" | "system";
}>();

const emit = defineEmits<{
  close: [];
  "set-theme": [theme: "dark" | "light" | "system"];
  logout: [];
}>();

type Section = "model" | "tools" | "memory" | "mcp" | "appearance" | "account";

const activeSection = ref<Section>("appearance");

const sections: { id: Section; label: string; icon: any }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "model", label: "Model", icon: Cpu },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "mcp", label: "MCP Servers", icon: Plug },
  { id: "account", label: "Account", icon: User },
];

// Request config when modal opens
watch(
  () => props.show,
  (show) => {
    if (show) {
      getConfig();
      getMcpStatus();
    }
  },
);
</script>

<template>
  <Modal :show="show" title="Settings" no-padding @close="emit('close')">
    <div class="flex flex-col md:flex-row md:h-[60vh] flex-1 min-h-0">
      <ModalSidebar
        :sections="sections"
        v-model:active-section="activeSection"
      />

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Config sections use v-show to stay mounted (preserves state) -->
        <ModelSection v-show="activeSection === 'model'" />

        <ToolsSection v-show="activeSection === 'tools'" />

        <MemorySection v-show="activeSection === 'memory'" />

        <McpServersSection v-show="activeSection === 'mcp'" />

        <!-- Simple sections use v-if (no state to preserve) -->
        <AppearanceSection
          v-if="activeSection === 'appearance'"
          :theme="theme"
          @set-theme="emit('set-theme', $event)"
        />

        <AccountSection
          v-if="activeSection === 'account'"
          @logout="emit('logout')"
        />
      </div>
    </div>
  </Modal>
</template>
