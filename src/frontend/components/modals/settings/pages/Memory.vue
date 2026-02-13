<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Save, RotateCw } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import Input from "../../../ui/Input.vue";
import Dropdown from "../../../ui/Dropdown.vue";
import { useConfig } from "../../../../composables/useConfig";
import SettingLabel from "../../components/SettingLabel.vue";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import ModalFooter from "../../components/ModalFooter.vue";

const { config, configSaving, updateConfig, restartServer } = useConfig();

const memoryType = ref<string>("bm25");
const embeddingApiUrl = ref("");
const embeddingApiKey = ref("");
const embeddingModel = ref("");

const typeOptions = [
  { label: "BM25 (Full-Text Search)", value: "bm25" },
  { label: "Vector (Embeddings)", value: "vector" },
];

// Sync config to local state
watch(
  config,
  (val) => {
    if (!val) return;
    const memory = val.memory;
    memoryType.value = memory?.type || "bm25";
    embeddingApiUrl.value = memory?.embedding?.apiUrl || "";
    embeddingApiKey.value = memory?.embedding?.apiKey || "";
    embeddingModel.value = memory?.embedding?.model || "";
  },
  { immediate: true },
);

const isVector = computed(() => memoryType.value === "vector");

const hasChanges = computed(() => {
  if (!config.value) return false;
  const memory = config.value.memory;
  if (memoryType.value !== (memory?.type || "bm25")) return true;
  if (embeddingApiUrl.value !== (memory?.embedding?.apiUrl || "")) return true;
  if (embeddingApiKey.value !== (memory?.embedding?.apiKey || "")) return true;
  if (embeddingModel.value !== (memory?.embedding?.model || "")) return true;
  return false;
});

function buildConfig() {
  const memoryConfig: any = {
    type: memoryType.value,
  };
  if (memoryType.value === "vector") {
    memoryConfig.embedding = {
      apiUrl: embeddingApiUrl.value || undefined,
      apiKey: embeddingApiKey.value || undefined,
      model: embeddingModel.value || undefined,
    };
  }
  return { memory: memoryConfig };
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
  <Container>
    <Header> Memory </Header>

    <template v-if="config">
      <SettingLabel label="Search Type">
        <Dropdown v-model="memoryType" :options="typeOptions" />
      </SettingLabel>

      <template v-if="isVector">
        <SettingLabel label="Embedding API URL">
          <Input
            v-model="embeddingApiUrl"
            placeholder="https://api.openai.com/v1/embeddings"
          />
        </SettingLabel>

        <SettingLabel label="Embedding API Key">
          <Input v-model="embeddingApiKey" placeholder="sk-..." secret />
        </SettingLabel>

        <SettingLabel label="Embedding Model">
          <Input
            v-model="embeddingModel"
            placeholder="text-embedding-3-small"
          />
        </SettingLabel>
      </template>

      <p class="text-xs text-text-secondary">
        <template v-if="isVector">
          Vector search uses embeddings for semantic similarity. Requires an
          OpenAI-compatible embedding API.
        </template>
        <template v-else>
          BM25 uses full-text search. No external API needed.
        </template>
      </p>
    </template>

    <div v-else class="text-text-secondary text-sm">
      Loading configuration...
    </div>

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
  </Container>
</template>
