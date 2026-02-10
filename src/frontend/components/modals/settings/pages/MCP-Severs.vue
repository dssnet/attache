<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Eye, EyeOff, Plus, Trash2, Check, Save, RotateCw } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import Input from "../../../ui/Input.vue";
import Dropdown from "../../../ui/Dropdown.vue";
import ListSelect from "../../../ui/ListSelect.vue";
import Switch from "../../../ui/Switch.vue";
import { useConfig } from "../../../../composables/useConfig";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Setting from "../../components/Setting.vue";
import SettingLabel from "../../components/SettingLabel.vue";
import Separator from "../../components/Separator.vue";
import ModalFooter from "../../components/ModalFooter.vue";

interface McpServerForm {
  type: "sse" | "stdio";
  description: string;
  url: string;
  command: string;
  args: string;
  env: string;
  headers: string;
  oauthEnabled: boolean;
  oauthClientId: string;
  oauthClientSecret: string;
  oauthTokenUrl: string;
  oauthScopes: string;
}

const { config, configSaving, updateConfig, mcpStatus, restartServer } = useConfig();

const mcpServers = ref<Record<string, McpServerForm>>({});
const selectedMcpServer = ref<string | null>(null);
const addingMcpServer = ref(false);
const newMcpServerName = ref("");
const showOAuthSecret = ref(false);

const mcpServerNames = computed(() => Object.keys(mcpServers.value));

const selectedMcpServerData = computed(() => {
  if (!selectedMcpServer.value) return null;
  return mcpServers.value[selectedMcpServer.value] || null;
});

function getMcpServerStatus(name: string) {
  return mcpStatus.value.find((s) => s.name === name);
}

// Sync config to local state
watch(
  config,
  (val) => {
    if (!val) return;
    const mcpRaw = val.mcpServers || {};
    const mcp: Record<string, McpServerForm> = {};
    for (const [name, srv] of Object.entries(mcpRaw)) {
      mcp[name] = {
        type: srv.type,
        description: srv.description || "",
        url: srv.url || "",
        command: srv.command || "",
        args: (srv.args || []).join("\n"),
        env: Object.entries(srv.env || {})
          .map(([k, v]) => `${k}=${v}`)
          .join("\n"),
        headers: Object.entries(srv.headers || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
        oauthEnabled: !!srv.oauth,
        oauthClientId: srv.oauth?.clientId || "",
        oauthClientSecret: srv.oauth?.clientSecret || "",
        oauthTokenUrl: srv.oauth?.tokenUrl || "",
        oauthScopes: (srv.oauth?.scopes || []).join(", "),
      };
    }
    mcpServers.value = mcp;

    if (!selectedMcpServer.value || !mcp[selectedMcpServer.value]) {
      selectedMcpServer.value = Object.keys(mcp)[0] || null;
    }
  },
  { immediate: true },
);

const hasChanges = computed(() => {
  if (!config.value) return false;

  const origMcpNames = Object.keys(config.value.mcpServers || {}).sort();
  const currMcpNames = Object.keys(mcpServers.value).sort();
  if (origMcpNames.join(",") !== currMcpNames.join(",")) return true;

  for (const name of currMcpNames) {
    const orig = (config.value.mcpServers || {})[name];
    const curr = mcpServers.value[name];
    if (!orig || !curr) return true;
    if (curr.type !== orig.type) return true;
    if (curr.description !== (orig.description || "")) return true;
    if (curr.url !== (orig.url || "")) return true;
    if (curr.command !== (orig.command || "")) return true;
    if (curr.args !== (orig.args || []).join("\n")) return true;
    const origEnv = Object.entries(orig.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    if (curr.env !== origEnv) return true;
    const origHeaders = Object.entries(orig.headers || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (curr.headers !== origHeaders) return true;
    if (curr.oauthEnabled !== !!orig.oauth) return true;
    if (curr.oauthEnabled && orig.oauth) {
      if (curr.oauthClientId !== (orig.oauth.clientId || "")) return true;
      if (curr.oauthClientSecret !== (orig.oauth.clientSecret || ""))
        return true;
      if (curr.oauthTokenUrl !== (orig.oauth.tokenUrl || "")) return true;
      if (curr.oauthScopes !== (orig.oauth.scopes || []).join(", "))
        return true;
    }
  }

  return false;
});

function buildConfig() {
  const builtMcpServers: Record<string, any> = {};
  for (const [name, srv] of Object.entries(mcpServers.value)) {
    const base: any = { type: srv.type };
    if (srv.description.trim()) {
      base.description = srv.description.trim();
    }
    if (srv.type === "sse") {
      base.url = srv.url;
      if (srv.headers.trim()) {
        base.headers = {};
        for (const line of srv.headers.split("\n")) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            base.headers[line.slice(0, colonIndex).trim()] = line
              .slice(colonIndex + 1)
              .trim();
          }
        }
      }
      if (srv.oauthEnabled) {
        base.oauth = {
          clientId: srv.oauthClientId,
          clientSecret: srv.oauthClientSecret,
          tokenUrl: srv.oauthTokenUrl,
          ...(srv.oauthScopes.trim()
            ? {
                scopes: srv.oauthScopes
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean),
              }
            : {}),
        };
      }
    } else {
      base.command = srv.command;
      base.args = srv.args
        .split("\n")
        .map((a: string) => a.trim())
        .filter(Boolean);
      if (srv.env.trim()) {
        base.env = {};
        for (const line of srv.env.split("\n")) {
          const eqIndex = line.indexOf("=");
          if (eqIndex > 0) {
            base.env[line.slice(0, eqIndex).trim()] = line
              .slice(eqIndex + 1)
              .trim();
          }
        }
      }
    }
    builtMcpServers[name] = base;
  }
  return { mcpServers: builtMcpServers };
}

function addMcpServer() {
  const name = newMcpServerName.value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!name || mcpServers.value[name]) return;

  mcpServers.value[name] = {
    type: "stdio",
    description: "",
    url: "",
    command: "",
    args: "",
    env: "",
    headers: "",
    oauthEnabled: false,
    oauthClientId: "",
    oauthClientSecret: "",
    oauthTokenUrl: "",
    oauthScopes: "",
  };
  selectedMcpServer.value = name;
  addingMcpServer.value = false;
  newMcpServerName.value = "";
}

function removeMcpServer(name: string) {
  const { [name]: _, ...rest } = mcpServers.value;
  mcpServers.value = rest;
  if (selectedMcpServer.value === name) {
    selectedMcpServer.value = Object.keys(rest)[0] || null;
  }
}

function save() {
  if (!config.value) return;
  updateConfig({
    ...config.value,
    ...buildConfig(),
  });
}

function saveAndRestart() {
  save();
  setTimeout(() => restartServer(), 500);
}
</script>

<template>
  <div>
    <!-- Server List -->
    <Container>
      <Header>MCP Servers</Header>

      <ListSelect
        v-if="mcpServerNames.length > 0"
        v-model="selectedMcpServer"
        :items="mcpServerNames"
      >
        <template #badge="{ item }">
          <span
            :class="[
              'w-2 h-2 rounded-full',
              getMcpServerStatus(item)?.status === 'connected'
                ? 'bg-green-500'
                : getMcpServerStatus(item)?.status === 'error'
                  ? 'bg-red-500'
                  : getMcpServerStatus(item)?.status === 'connecting'
                    ? 'bg-yellow-500'
                    : 'bg-text-secondary',
            ]"
          />
          <span
            v-if="getMcpServerStatus(item)?.toolCount"
            class="text-[10px] text-text-secondary"
          >
            {{ getMcpServerStatus(item)?.toolCount }} tools
          </span>
        </template>
        <template #action="{ item }">
          <button
            class="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
            @click.stop="removeMcpServer(item)"
          >
            <Trash2 :size="14" />
          </button>
        </template>
      </ListSelect>

      <div v-else class="text-sm text-text-secondary py-3">
        No MCP servers configured. Add one below.
      </div>

      <!-- Add Server -->
      <div v-if="addingMcpServer" class="flex gap-2">
        <input
          v-model="newMcpServerName"
          placeholder="Server name..."
          class="flex-1 bg-bg-secondary text-text-primary placeholder-text-secondary rounded-lg border border-border-primary focus:border-border-secondary focus:outline-none px-3 py-2 text-sm"
          @keydown.enter="addMcpServer"
          @keydown.escape="addingMcpServer = false"
        />
        <Button
          variant="primary"
          size="sm"
          :disabled="!newMcpServerName.trim()"
          @click="addMcpServer"
        >
          <Check :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="
            addingMcpServer = false;
            newMcpServerName = '';
          "
        >
          Cancel
        </Button>
      </div>
      <button
        v-else
        class="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
        @click="addingMcpServer = true"
      >
        <Plus :size="14" />
        Add MCP server
      </button>
    </Container>

    <Separator />

    <!-- Selected Server Editor -->
    <Container v-if="selectedMcpServerData && selectedMcpServer">
      <Header>{{ selectedMcpServer }}</Header>

      <!-- Status display -->
      <div
        v-if="getMcpServerStatus(selectedMcpServer)"
        class="text-xs"
      >
        <span
          :class="[
            getMcpServerStatus(selectedMcpServer)?.status === 'connected'
              ? 'text-green-500'
              : getMcpServerStatus(selectedMcpServer)?.status === 'error'
                ? 'text-red-500'
                : 'text-yellow-500',
          ]"
        >
          {{ getMcpServerStatus(selectedMcpServer)?.status }}
        </span>
        <span
          v-if="getMcpServerStatus(selectedMcpServer)?.error"
          class="text-red-400 ml-2"
        >
          {{ getMcpServerStatus(selectedMcpServer)?.error }}
        </span>
      </div>

      <SettingLabel label="Description">
        <Input
          v-model="selectedMcpServerData.description"
          placeholder="What this server does..."
        />
      </SettingLabel>

      <Setting
        name="Transport Type"
        description="How to connect to the server"
      >
        <Dropdown
          v-model="selectedMcpServerData.type"
          :options="[
            { label: 'SSE / Streamable HTTP', value: 'sse' },
            { label: 'Stdio (Local)', value: 'stdio' },
          ]"
          align="right"
        />
      </Setting>

      <!-- SSE fields -->
      <template v-if="selectedMcpServerData.type === 'sse'">
        <SettingLabel label="Server URL">
          <Input
            v-model="selectedMcpServerData.url"
            placeholder="https://example.com/mcp"
          />
        </SettingLabel>

        <SettingLabel label="Custom Headers (one per line, KEY: VALUE)">
          <textarea
            v-model="selectedMcpServerData.headers"
            placeholder="Authorization: Bearer sk-xxx&#10;X-Custom: value"
            rows="2"
            class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm resize-y font-mono"
          />
        </SettingLabel>

        <Setting
          name="OAuth Authentication"
          description="Use OAuth for server authentication"
        >
          <Switch v-model="selectedMcpServerData.oauthEnabled" />
        </Setting>

        <!-- OAuth fields -->
        <template v-if="selectedMcpServerData.oauthEnabled">
          <SettingLabel label="Client ID">
            <Input
              v-model="selectedMcpServerData.oauthClientId"
              placeholder="my-client-id"
            />
          </SettingLabel>

          <SettingLabel label="Client Secret">
            <div class="relative flex items-center">
              <input
                v-model="selectedMcpServerData.oauthClientSecret"
                :type="showOAuthSecret ? 'text' : 'password'"
                placeholder="client-secret..."
                class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm pr-10"
              />
              <button
                class="absolute right-3 text-text-secondary hover:text-text-primary transition-colors"
                @click="showOAuthSecret = !showOAuthSecret"
              >
                <EyeOff v-if="showOAuthSecret" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </SettingLabel>

          <SettingLabel label="Token URL">
            <Input
              v-model="selectedMcpServerData.oauthTokenUrl"
              placeholder="https://auth.example.com/token"
            />
          </SettingLabel>

          <SettingLabel label="Scopes (comma-separated)">
            <Input
              v-model="selectedMcpServerData.oauthScopes"
              placeholder="read, write"
            />
          </SettingLabel>
        </template>
      </template>

      <!-- Stdio fields -->
      <template v-if="selectedMcpServerData.type === 'stdio'">
        <SettingLabel label="Command">
          <Input
            v-model="selectedMcpServerData.command"
            placeholder="npx"
          />
        </SettingLabel>

        <SettingLabel label="Arguments (one per line)">
          <textarea
            v-model="selectedMcpServerData.args"
            placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/tmp"
            rows="3"
            class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm resize-y font-mono"
          />
        </SettingLabel>

        <SettingLabel label="Environment Variables (KEY=VALUE, one per line)">
          <textarea
            v-model="selectedMcpServerData.env"
            placeholder="API_KEY=your-key-here"
            rows="2"
            class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm resize-y font-mono"
          />
        </SettingLabel>
      </template>
    </Container>

    <Container v-else-if="!config">
      <div class="text-text-secondary text-sm">Loading configuration...</div>
    </Container>

    <ModalFooter v-if="config">
      <span v-if="hasChanges" class="text-xs text-text-secondary"
        >You have unsaved changes</span
      >
      <span v-else></span>
      <div class="flex items-center gap-2">
        <Button
          variant="primary"
          :disabled="!hasChanges"
          :loading="configSaving"
          class="flex items-center gap-2"
          @click="save"
        >
          <Save :size="16" />
          Save
        </Button>
        <Button
          variant="ghost"
          :disabled="!hasChanges"
          :loading="configSaving"
          class="flex items-center gap-2"
          @click="saveAndRestart"
        >
          <RotateCw :size="16" />
          Save & Restart
        </Button>
      </div>
    </ModalFooter>
  </div>
</template>
