<script setup lang="ts">
import { PanelLeft, ArrowUpCircle } from "lucide-vue-next";
import Button from "../ui/Button.vue";
import { useConfig } from "../../composables/useConfig";

const { updateAvailable, latestVersion, upgrading, upgradeStep, startUpgrade } =
  useConfig();

const emit = defineEmits<{
  copy: [];
  "clear-context": [];
  "collapse-sidebar": [];
}>();

function handleUpgrade() {
  if (
    confirm(
      `Update to v${latestVersion.value}? The server will restart after upgrading.`,
    )
  ) {
    startUpgrade();
  }
}
</script>

<template>
  <div class="p-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <img
        src="/logo.svg"
        alt="Attaché"
        class="w-8 h-8 object-contain filter-(--logo-filter)"
      />
      <span class="font-semibold text-base text-text-primary">Attaché</span>
    </div>
    <div class="flex gap-1 items-center">
      <Button
        v-if="updateAvailable"
        variant="ghost"
        icon
        size="sm"
        :loading="upgrading"
        :title="
          upgrading
            ? (upgradeStep ?? 'Upgrading...')
            : `Update available: v${latestVersion}`
        "
        @click="handleUpgrade"
        class="text-primary relative"
      >
        <ArrowUpCircle :size="18" />
        <span
          v-if="!upgrading"
          class="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"
        />
      </Button>
      <Button
        variant="ghost"
        icon
        size="sm"
        @click="emit('collapse-sidebar')"
        title="Hide sidebar"
      >
        <PanelLeft :size="18" />
      </Button>
    </div>
  </div>
</template>
