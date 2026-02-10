<script setup lang="ts">
import { ref } from "vue";
import Input from "../components/ui/Input.vue";
import Button from "../components/ui/Button.vue";

const emit = defineEmits<{
  login: [token: string];
}>();

const token = ref("");

function handleSubmit() {
  if (token.value.trim()) {
    emit("login", token.value.trim());
  }
}
</script>

<template>
  <div class="flex items-center justify-center h-full bg-linear-to-b from-gradient-start to-gradient-end p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]">
    <div
      class="bg-white p-8 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-[90%] max-w-100"
      data-theme="light"
    >
      <h1 class="text-slate-800 mb-2 text-2xl font-bold">Attaché</h1>
      <p class="text-slate-500 mb-6 text-sm">Enter your authentication token to continue</p>
      <form @submit.prevent="handleSubmit">
        <Input
          v-model="token"
          type="password"
          placeholder="Authentication Token"
          class="mb-4"
        />
        <Button type="submit" :disabled="!token.trim()" full-width>Login</Button>
      </form>
    </div>
  </div>
</template>
