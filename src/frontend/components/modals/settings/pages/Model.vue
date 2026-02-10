<script setup lang="ts">
import { ref, watch, computed, nextTick } from "vue";
import { Eye, EyeOff, Plus, Trash2, Check, Save, Pencil, Copy, RotateCw } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import Input from "../../../ui/Input.vue";
import Dropdown from "../../../ui/Dropdown.vue";
import ListSelect from "../../../ui/ListSelect.vue";
import { useConfig } from "../../../../composables/useConfig";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Setting from "../../components/Setting.vue";
import SettingLabel from "../../components/SettingLabel.vue";
import Separator from "../../components/Separator.vue";
import ModalFooter from "../../components/ModalFooter.vue";

interface ProviderForm {
  type: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const { config, configSaving, updateConfig, restartServer } = useConfig();

const providers = ref<Record<string, ProviderForm>>({});
const defaultProvider = ref("");
const selectedProvider = ref<string | null>(null);
const addingProvider = ref(false);
const newProviderName = ref("");
const showApiKey = ref(false);
const editingProvider = ref<string | null>(null);
const editProviderName = ref("");

const providerNames = computed(() => Object.keys(providers.value));

const selectedProviderData = computed(() => {
  if (!selectedProvider.value) return null;
  return providers.value[selectedProvider.value] || null;
});

// Sync config to local state
watch(
  config,
  (val) => {
    if (!val) return;
    defaultProvider.value = val.models.default;

    const p: Record<string, ProviderForm> = {};
    for (const [name, prov] of Object.entries(val.models.providers)) {
      p[name] = {
        type: prov.type,
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        model: prov.model,
        maxTokens: prov.maxTokens,
        temperature: prov.temperature,
      };
    }
    providers.value = p;

    if (!selectedProvider.value || !p[selectedProvider.value]) {
      selectedProvider.value = val.models.default;
    }
  },
  { immediate: true },
);

const hasChanges = computed(() => {
  if (!config.value) return false;

  if (defaultProvider.value !== config.value.models.default) return true;

  const origNames = Object.keys(config.value.models.providers).sort();
  const currNames = Object.keys(providers.value).sort();
  if (origNames.join(",") !== currNames.join(",")) return true;

  for (const name of currNames) {
    const orig = config.value.models.providers[name];
    const curr = providers.value[name];
    if (!orig || !curr) return true;
    if (curr.type !== orig.type) return true;
    if (curr.apiUrl !== orig.apiUrl) return true;
    if (curr.apiKey !== orig.apiKey) return true;
    if (curr.model !== orig.model) return true;
    if (curr.maxTokens !== orig.maxTokens) return true;
    if (curr.temperature !== orig.temperature) return true;
  }

  return false;
});

function buildConfig() {
  const builtProviders: Record<string, any> = {};
  for (const [name, prov] of Object.entries(providers.value)) {
    builtProviders[name] = {
      type: prov.type,
      apiUrl: prov.type === "custom-openai" ? prov.apiUrl : null,
      apiKey: prov.apiKey,
      model: prov.model,
      maxTokens: Number(prov.maxTokens),
      temperature: Number(prov.temperature),
    };
  }
  return {
    models: {
      default: defaultProvider.value,
      providers: builtProviders,
    },
  };
}

function addProvider() {
  const name = newProviderName.value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!name || providers.value[name]) return;

  providers.value[name] = {
    type: "custom-openai",
    apiUrl: "",
    apiKey: "",
    model: "",
    maxTokens: 8192,
    temperature: 1,
  };
  selectedProvider.value = name;
  addingProvider.value = false;
  newProviderName.value = "";

  if (Object.keys(providers.value).length === 1) {
    defaultProvider.value = name;
  }
}

function startEditProvider(name: string) {
  editingProvider.value = name;
  editProviderName.value = name;
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(".provider-edit-input");
    input?.focus();
    input?.select();
  });
}

function renameProvider() {
  const oldName = editingProvider.value;
  if (!oldName) return;

  const newName = editProviderName.value.trim().toLowerCase().replace(/\s+/g, "-");
  editingProvider.value = null;

  if (!newName || newName === oldName || providers.value[newName]) return;

  const data = providers.value[oldName]!;
  const entries = Object.entries(providers.value)
    .filter(([k]) => k !== oldName)
    .concat([[newName, data]]);
  providers.value = Object.fromEntries(entries);

  if (defaultProvider.value === oldName) {
    defaultProvider.value = newName;
  }
  if (selectedProvider.value === oldName) {
    selectedProvider.value = newName;
  }

  if (!config.value) return;
  const built = buildConfig();
  (built.models.providers as any)[oldName] = null;
  updateConfig({ ...config.value, ...built });
}

function removeProvider(name: string) {
  if (Object.keys(providers.value).length <= 1) return;

  providers.value = Object.fromEntries(
    Object.entries(providers.value).filter(([k]) => k !== name),
  );

  if (defaultProvider.value === name) {
    defaultProvider.value = Object.keys(providers.value)[0] ?? "";
  }
  if (selectedProvider.value === name) {
    selectedProvider.value = Object.keys(providers.value)[0] ?? null;
  }

  if (!config.value) return;
  const built = buildConfig();
  (built.models.providers as any)[name] = null;
  updateConfig({ ...config.value, ...built });
}

function cloneProvider(name: string) {
  const data = providers.value[name];
  if (!data) return;

  let copyName = `${name}-copy`;
  let i = 2;
  while (providers.value[copyName]) {
    copyName = `${name}-copy-${i++}`;
  }

  providers.value[copyName] = { ...data };
  selectedProvider.value = copyName;
  save();
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
    <!-- Default Provider -->
    <Container>
      <Header>Model Providers</Header>
      <Setting
        name="Default Provider"
        description="The provider used for new conversations"
      >
        <Dropdown
          v-model="defaultProvider"
          :options="providerNames.map((n) => ({ label: n, value: n }))"
          align="right"
        />
      </Setting>
    </Container>

    <Separator />

    <!-- Provider List -->
    <Container>
      <Header>Providers</Header>
      <ListSelect v-model="selectedProvider" :items="providerNames">
        <template #label="{ item }">
          <input
            v-if="editingProvider === item"
            v-model="editProviderName"
            class="provider-edit-input font-medium bg-bg-input text-text-primary rounded px-1.5 py-0.5 text-sm border border-border-primary focus:border-primary focus:outline-none w-32"
            @click.stop
            @keydown.enter="renameProvider"
            @keydown.escape="editingProvider = null"
            @blur="renameProvider"
          />
          <span v-else class="font-medium">{{ item }}</span>
        </template>
        <template #badge="{ item }">
          <span
            v-if="item === defaultProvider"
            class="text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold"
            >default</span
          >
        </template>
        <template #action="{ item }">
          <div class="flex items-center gap-0.5">
            <button
              class="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              @click.stop="cloneProvider(item)"
            >
              <Copy :size="14" />
            </button>
            <button
              class="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              @click.stop="startEditProvider(item)"
            >
              <Pencil :size="14" />
            </button>
            <button
              v-if="providerNames.length > 1"
              class="p-1 rounded text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
              @click.stop="removeProvider(item)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </template>
      </ListSelect>

      <!-- Add Provider -->
      <div v-if="addingProvider" class="flex gap-2">
        <input
          v-model="newProviderName"
          placeholder="Provider name..."
          class="flex-1 bg-bg-secondary text-text-primary placeholder-text-secondary rounded-lg border border-border-primary focus:border-border-secondary focus:outline-none px-3 py-2 text-sm"
          @keydown.enter="addProvider"
          @keydown.escape="addingProvider = false"
        />
        <Button
          variant="primary"
          size="sm"
          :disabled="!newProviderName.trim()"
          @click="addProvider"
        >
          <Check :size="14" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          @click="
            addingProvider = false;
            newProviderName = '';
          "
        >
          Cancel
        </Button>
      </div>
      <button
        v-else
        class="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors"
        @click="addingProvider = true"
      >
        <Plus :size="14" />
        Add provider
      </button>
    </Container>

    <Separator />

    <!-- Selected Provider Editor -->
    <Container v-if="selectedProviderData && selectedProvider">
      <Header>{{ selectedProvider }}</Header>

      <Setting name="Type" description="The API format this provider uses">
        <Dropdown
          v-model="selectedProviderData.type"
          :options="[
            { label: 'Custom OpenAI Compatible', value: 'custom-openai' },
            { label: 'OpenAI', value: 'openai' },
            { label: 'Claude', value: 'claude' },
          ]"
          align="right"
        />
      </Setting>

      <SettingLabel v-if="selectedProviderData.type === 'custom-openai'" label="API URL">
        <Input
          v-model="selectedProviderData.apiUrl"
          placeholder="https://api.example.com/v1"
        />
      </SettingLabel>

      <SettingLabel label="API Key">
        <div class="relative flex items-center">
          <input
            v-model="selectedProviderData.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="sk-..."
            class="bg-bg-secondary text-text-primary placeholder-text-secondary w-full rounded-lg font-inherit transition-all duration-200 focus:outline-none border border-border-primary focus:border-border-secondary px-4 py-3 text-sm pr-10"
          />
          <button
            class="absolute right-3 text-text-secondary hover:text-text-primary transition-colors"
            @click="showApiKey = !showApiKey"
          >
            <EyeOff v-if="showApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </SettingLabel>

      <SettingLabel label="Model">
        <Input
          v-model="selectedProviderData.model"
          placeholder="e.g. gpt-4, claude-3-opus"
        />
      </SettingLabel>

      <Setting
        name="Max Tokens"
        description="Maximum number of tokens in the response"
      >
        <Input
          v-model="selectedProviderData.maxTokens"
          type="number"
          placeholder="8192"
        />
      </Setting>

      <Setting
        name="Temperature"
        description="Controls randomness of the output"
      >
        <Input
          v-model="selectedProviderData.temperature"
          type="number"
          placeholder="0.0 - 2.0"
        />
      </Setting>
    </Container>

    <Container v-else>
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
