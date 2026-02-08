<script setup lang="ts">
import { LogOut } from "lucide-vue-next";
import Button from "../../../ui/Button.vue";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Setting from "../../components/Setting.vue";

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <Container>
    <Header> Account </Header>
    <Setting name="Sign Out" description="Log out of your account on this device"
      ><Button
        variant="danger"
        full-width
        class="flex items-center justify-center gap-2"
        @click="emit('logout')"
      >
        <LogOut :size="16" />
        Logout
      </Button></Setting
    >
  </Container>
</template>
