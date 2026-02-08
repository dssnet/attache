<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Save } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import Input from "../../../ui/Input.vue";
import Switch from "../../../ui/Switch.vue";
import { useConfig } from "../../../../composables/useConfig";
import SettingLabel from "../../components/SettingLabel.vue";
import Setting from "../../components/Setting.vue";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Label from "../../../ui/Label.vue";
import ModalFooter from "../../components/ModalFooter.vue";

const { config, configSaving, updateConfig } = useConfig();

const braveKey = ref("");
const filesystem = ref(true);
const terminal = ref(true);
const workingDir = ref("");
const limitWorkingDir = ref(false);
const commandWhitelist = ref("");

// Sync config to local state
watch(
  config,
  (val) => {
    if (!val) return;
    const tools = val.tools || {};
    braveKey.value = tools.braveSearchApiKey || "";
    filesystem.value = tools.filesystem ?? true;
    terminal.value = tools.terminal ?? true;
    workingDir.value = tools.workingDir || "";
    limitWorkingDir.value = tools.limitWorkingDir ?? false;
    commandWhitelist.value = (tools.commandWhitelist || []).join("\n");
  },
  { immediate: true },
);

const hasChanges = computed(() => {
  if (!config.value) return false;
  const tools = config.value.tools || {};
  if (braveKey.value !== (tools.braveSearchApiKey || "")) return true;
  if (filesystem.value !== (tools.filesystem ?? true)) return true;
  if (terminal.value !== (tools.terminal ?? true)) return true;
  if (workingDir.value !== (tools.workingDir || "")) return true;
  if (limitWorkingDir.value !== (tools.limitWorkingDir ?? false)) return true;
  if (commandWhitelist.value !== (tools.commandWhitelist || []).join("\n")) return true;
  return false;
});

function buildConfig() {
  const wl = commandWhitelist.value.split("\n").map(s => s.trim()).filter(Boolean);
  return {
    tools: {
      braveSearchApiKey: braveKey.value || undefined,
      filesystem: filesystem.value,
      terminal: terminal.value,
      workingDir: workingDir.value || undefined,
      limitWorkingDir: limitWorkingDir.value,
      commandWhitelist: wl.length > 0 ? wl : undefined,
    },
  };
}

function save() {
  if (!config.value) return;
  updateConfig({
    ...config.value,
    ...buildConfig(),
  });
}
</script>

<template>
  <Container>
    <Header> Tools </Header>

    <template v-if="config">
      <SettingLabel label="Brave Search API Key">
        <Input v-model="braveKey" placeholder="BSA..." secret />
      </SettingLabel>

      <SettingLabel label="Working Directory">
        <Input v-model="workingDir" placeholder="~/attache-workspace" />
      </SettingLabel>

      <Setting
        name="Filesystem Access"
        description="Allow the agent to read and write files"
      >
        <Switch v-model="filesystem" />
      </Setting>

      <Setting
        name="Limit to Working Directory"
        description="Restrict filesystem access to the working directory only"
      >
        <Switch v-model="limitWorkingDir" />
      </Setting>

      <Setting
        name="Terminal Access"
        description="Allow the agent to execute terminal commands"
      >
        <Switch v-model="terminal" />
      </Setting>

      <SettingLabel label="Command Whitelist (one per line)">
        <textarea
          v-model="commandWhitelist"
          placeholder="*&#10;ls&#10;cat&#10;grep"
          rows="3"
          class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm resize-y font-mono"
        />
        <p class="text-xs text-text-secondary mt-1">
          Use * to allow all commands. Leave empty to block all.
        </p>
      </SettingLabel>
    </template>

    <div v-else class="text-text-secondary text-sm">
      Loading configuration...
    </div>

    <ModalFooter v-if="config">
      <span v-if="hasChanges" class="text-xs text-text-secondary"
        >You have unsaved changes</span
      >
      <span v-else></span>
      <Button
        variant="primary"
        :disabled="!hasChanges"
        :loading="configSaving"
        class="flex items-center gap-2"
        @click="save"
      >
        <Save :size="16" />
        Save Changes
      </Button>
    </ModalFooter>
  </Container>
</template>
