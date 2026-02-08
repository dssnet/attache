<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";

const props = defineProps<{
  options: { label: string; value: string; icon?: object }[];
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const buttons = ref<HTMLButtonElement[]>([]);
const indicatorStyle = ref({ width: "0px", left: "0px" });
const animated = ref(false);

const activeIndex = computed(() =>
  props.options.findIndex((o) => o.value === props.modelValue)
);

function updateIndicator() {
  const btn = buttons.value[activeIndex.value];
  if (!btn) return;
  indicatorStyle.value = {
    width: `${btn.offsetWidth}px`,
    left: `${btn.offsetLeft}px`,
  };
}

watch(activeIndex, () => {
  animated.value = true;
  nextTick(updateIndicator);
});
onMounted(updateIndicator);
</script>

<template>
  <div class="relative inline-flex bg-bg-secondary rounded-lg p-1 border border-border-primary">
    <div
      class="absolute top-1 bottom-1 rounded-md bg-primary ease-out"
      :class="animated ? 'transition-all duration-200' : ''"
      :style="indicatorStyle"
    />
    <button
      v-for="(option, i) in options"
      :key="option.value"
      :ref="(el) => { if (el) buttons[i] = el as HTMLButtonElement }"
      type="button"
      class="relative z-10 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 whitespace-nowrap"
      :class="
        modelValue === option.value
          ? 'text-white'
          : 'text-text-secondary hover:text-text-primary'
      "
      @click="emit('update:modelValue', option.value)"
    >
      <component v-if="option.icon" :is="option.icon" :size="16" />
      <span v-if="option.label">{{ option.label }}</span>
    </button>
  </div>
</template>
