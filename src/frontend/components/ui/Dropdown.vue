<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { ChevronDown } from "lucide-vue-next";
import Button from "./Button.vue";
const props = defineProps<{
  options: { label: string; value: string }[];
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  align?: "left" | "right";
}>();

const modelValue = defineModel<string>({ required: true });

const open = ref(false);
const focusedIndex = ref(-1);
const wrapperRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const itemRefs = ref<HTMLElement[]>([]);
const dropdownStyle = ref<Record<string, string>>({});

const selectedOption = computed(() =>
  props.options.find((o) => o.value === modelValue.value),
);

function updatePosition() {
  const el = wrapperRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const align = props.align ?? "left";
  dropdownStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: align === "left" ? `${rect.left}px` : "auto",
    right: align === "right" ? `${window.innerWidth - rect.right}px` : "auto",
    minWidth: `${rect.width}px`,
  };
}

function toggle() {
  if (!open.value) updatePosition();
  open.value = !open.value;
}

function select(option: { label: string; value: string }) {
  modelValue.value = option.value;
  open.value = false;
  wrapperRef.value?.querySelector("button")?.focus();
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (
    !wrapperRef.value?.contains(target) &&
    !dropdownRef.value?.contains(target)
  ) {
    open.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open.value = true;
      return;
    }
    return;
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      focusedIndex.value = Math.min(
        focusedIndex.value + 1,
        props.options.length - 1,
      );
      break;
    case "ArrowUp":
      e.preventDefault();
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      if (focusedIndex.value >= 0 && focusedIndex.value < props.options.length) {
        select(props.options[focusedIndex.value]!);
      }
      break;
    case "Escape":
      e.preventDefault();
      open.value = false;
      wrapperRef.value?.querySelector("button")?.focus();
      break;
  }
}

watch(open, (val) => {
  if (val) {
    updatePosition();
    const idx = props.options.findIndex((o) => o.value === modelValue.value);
    focusedIndex.value = idx >= 0 ? idx : 0;
    nextTick(() => {
      itemRefs.value[focusedIndex.value]?.scrollIntoView({ block: "nearest" });
    });
  }
});

watch(focusedIndex, () => {
  nextTick(() => {
    itemRefs.value[focusedIndex.value]?.scrollIntoView({ block: "nearest" });
  });
});

onMounted(() => {
  document.addEventListener("mousedown", onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onClickOutside);
});
</script>

<template>
  <div ref="wrapperRef" class="relative">
      <Button
        variant="secondary"
        :size="size"
        :disabled="disabled"
        full-width
        class="flex items-center justify-between font-normal!"
        @click="toggle"
        @keydown="onKeydown"
      >
        <span
          class="truncate text-left"
          :class="!selectedOption && placeholder ? 'text-text-secondary' : ''"
        >
          {{ selectedOption?.label ?? placeholder ?? "Select..." }}
        </span>
        <ChevronDown
          :size="16"
          class="shrink-0 ml-2 text-text-secondary transition-transform duration-200"
          :class="open ? 'rotate-180' : ''"
        />
      </Button>

      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="open"
            ref="dropdownRef"
            class="fixed z-9999 w-max rounded-xl border border-border-primary bg-bg-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-auto max-h-48 p-2"
            :style="dropdownStyle"
          >
            <div
              v-for="(option, i) in options"
              :key="option.value"
              :ref="(el) => { if (el) itemRefs[i] = el as HTMLElement }"
              :class="[
                'px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100 truncate rounded-md',
                option.value === modelValue
                  ? 'text-primary font-medium'
                  : 'text-text-primary',
                focusedIndex === i ? 'bg-bg-hover' : '',
              ]"
              @click="select(option)"
              @mouseenter="focusedIndex = i"
            >
              {{ option.label }}
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
</template>
