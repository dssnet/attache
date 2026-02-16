<script setup lang="ts">
import { ref } from "vue";
import { LogOut, RefreshCw, ArrowUpCircle, QrCode } from "lucide-vue-next";
import QRCode from "qrcode";
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
const qrDataUrl = ref<string | null>(null);
const showQr = ref(false);

async function toggleQrCode() {
  if (showQr.value) {
    showQr.value = false;
    return;
  }
  if (!qrDataUrl.value) {
    const payload = JSON.stringify({
      url: window.location.origin + "/",
      token: localStorage.getItem("authToken") ?? "",
    });
    qrDataUrl.value = await QRCode.toDataURL(payload, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }
  showQr.value = true;
}

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
      name="QR Code"
      description="Scan to log in on another device"
    >
      <Button
        variant="secondary"
        size="sm"
        class="flex items-center justify-center gap-2"
        @click="toggleQrCode"
      >
        <QrCode :size="16" />
        {{ showQr ? "Hide" : "Show" }} QR Code
      </Button>
    </Setting>
    <div
      v-if="showQr && qrDataUrl"
      class="flex justify-center py-4"
    >
      <img
        :src="qrDataUrl"
        alt="Login QR Code"
        class="w-48 h-48 rounded-lg"
      />
    </div>

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
