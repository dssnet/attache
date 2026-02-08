<script setup lang="ts">
import { Monitor, Moon, Sun } from "lucide-vue-next";
import { markRaw } from "vue";
import SegmentedControl from "../../../ui/SegmentedControl.vue";
import Container from "../../components/Container.vue";
import Header from "../../components/Header.vue";
import Setting from "../../components/Setting.vue";

defineProps<{
  theme: "dark" | "light" | "system";
}>();

const emit = defineEmits<{
  "set-theme": [theme: "dark" | "light" | "system"];
}>();

const themeOptions = [
  { label: "", value: "system", icon: markRaw(Monitor) },
  { label: "", value: "dark", icon: markRaw(Moon) },
  { label: "", value: "light", icon: markRaw(Sun) },
];
</script>

<template>
  <Container>
    <Header>Appearance</Header>
    <Setting name="Theme" description="Choose your preferred color scheme">
      <SegmentedControl
        :options="themeOptions"
        :model-value="theme"
        @update:model-value="
          emit('set-theme', $event as 'dark' | 'light' | 'system')
        "
      />
    </Setting>
  </Container>
</template>
