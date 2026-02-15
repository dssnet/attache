<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Cpu, Wrench, Palette, User, Plug, Brain, ChevronLeft, X } from "lucide-vue-next";
import Modal from "../Modal.vue";
import ModalSidebar from "../components/ModalSidebar.vue";
import Button from "../../ui/Button.vue";
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
/** Mobile drill-down: true when showing a section's content */
const mobileOpen = ref(false);

const sections: { id: Section; label: string; icon: any }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "model", label: "Model", icon: Cpu },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "mcp", label: "MCP Servers", icon: Plug },
  { id: "account", label: "Account", icon: User },
];

const activeSectionLabel = computed(
  () => sections.find((s) => s.id === activeSection.value)?.label ?? "Settings",
);

// Reset mobile drill-down when modal opens
watch(
  () => props.show,
  (show) => {
    if (show) {
      mobileOpen.value = false;
      getConfig();
      getMcpStatus();
    }
  },
);
</script>

<template>
  <Modal
    :show="show"
    :title="mobileOpen ? activeSectionLabel : 'Settings'"
    no-padding
    @close="emit('close')"
  >
    <template v-if="mobileOpen" #header-left-action>
      <Button
        variant="ghost"
        icon
        size="sm"
        class="text-2xl leading-none md:hidden"
        @click="mobileOpen = false"
      >
        <ChevronLeft :size="18" />
      </Button>
      <Button
        variant="ghost"
        icon
        size="sm"
        class="text-2xl leading-none hidden md:flex"
        @click="emit('close')"
      >
        <X :size="14" />
      </Button>
    </template>
    <div class="h-full min-h-0 overflow-hidden md:overflow-visible">
      <div
        :class="[
          'flex h-full md:h-[60vh]',
          'max-md:transition-[translate] max-md:duration-300 max-md:ease-out',
          mobileOpen ? 'max-md:-translate-x-full' : '',
        ]"
      >
        <ModalSidebar
          :sections="sections"
          v-model:active-section="activeSection"
          v-model:mobile-open="mobileOpen"
        />

        <!-- Content panel -->
        <div
          class="max-md:w-full max-md:shrink-0 md:flex-1 flex flex-col h-full min-h-0"
        >
          <div class="flex-1 overflow-y-scroll">
            <div class="min-h-[calc(100%+1px)]">
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
        </div>
      </div>
    </div>
  </Modal>
</template>
