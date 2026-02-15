<script setup lang="ts">
import { ref } from "vue";
import { LogOut, RefreshCw, ArrowUpCircle } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import ConfirmDialog from "../../../ui/ConfirmDialog.vue";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Setting from "../../components/Setting.vue";
import { useConfig } from "../../../../composables/useConfig";

declare const __APP_VERSION__: string;
const appVersion = __APP_VERSION__;

const {
  checkUpdate,
  checkingUpdate,
  updateAvailable,
  latestVersion,
  upgrading,
  upgradeStep,
  startUpgrade,
} = useConfig();

const emit = defineEmits<{
  logout: [];
}>();

const showUpgradeConfirm = ref(false);

function handleCheckUpdate() {
  checkUpdate();
}

function handleUpgrade() {
  showUpgradeConfirm.value = true;
}

function confirmUpgrade() {
  showUpgradeConfirm.value = false;
  startUpgrade();
}
</script>

<template>
  <Container>
    <Header> Account </Header>

    <Setting
      name="Version"
      :description="`Currently running Attaché Server version`"
    >
      <span class="text-xs text-text-secondary font-mono"
        >v{{ appVersion }}</span
      >
    </Setting>

    <Setting name="Updates" description="Check for new versions of Attaché">
      <div class="flex items-center gap-2">
        <span
          v-if="updateAvailable && latestVersion"
          class="text-xs text-green-500 whitespace-nowrap"
        >
          v{{ latestVersion }} available
        </span>
        <Button
          v-if="updateAvailable"
          variant="primary"
          class="flex items-center justify-center gap-2"
          size="sm"
          :loading="upgrading"
          @click="handleUpgrade"
        >
          <ArrowUpCircle :size="16" />
          {{ upgrading ? (upgradeStep ?? "Upgrading...") : "Update" }}
        </Button>
        <Button
          v-else
          variant="secondary"
          class="flex items-center justify-center gap-2"
          size="sm"
          :loading="checkingUpdate"
          @click="handleCheckUpdate"
        >
          <RefreshCw :size="16" />
          Check for Updates
        </Button>
      </div>
    </Setting>

    <Setting
      name="Sign Out"
      description="Log out of your account on this device"
    >
      <Button
        variant="danger"
        full-width
        size="sm"
        class="flex items-center justify-center gap-2"
        @click="emit('logout')"
      >
        <LogOut :size="16" />
        Logout
      </Button>
    </Setting>
  </Container>

  <ConfirmDialog
    :show="showUpgradeConfirm"
    title="Update Available"
    :message="`Update to v${latestVersion}? The server will restart after upgrading.`"
    confirm-text="Update"
    @confirm="confirmUpgrade"
    @cancel="showUpgradeConfirm = false"
  />
</template>
