<script setup lang="ts">
import { ref, onMounted } from "vue";
import LoginScreen from "./views/LoginScreen.vue";
import ChatScreen from "./views/ChatScreen.vue";

const authToken = ref<string | null>(null);
const isAuthenticated = ref(false);

onMounted(() => {
  const savedToken = localStorage.getItem("authToken");
  if (savedToken) {
    authToken.value = savedToken;
    isAuthenticated.value = true;
  }
});

function handleLogin(token: string) {
  authToken.value = token;
  localStorage.setItem("authToken", token);
  isAuthenticated.value = true;
}

function handleLogout() {
  authToken.value = null;
  localStorage.removeItem("authToken");
  isAuthenticated.value = false;
}
</script>

<template>
  <LoginScreen v-if="!isAuthenticated" @login="handleLogin" />
  <ChatScreen v-else :auth-token="authToken!" @logout="handleLogout" />
</template>
