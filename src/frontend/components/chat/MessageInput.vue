<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { Send } from "lucide-vue-next";
import { useSlashCommands } from "../../composables/useSlashCommands";
import ContextIndicator from "../common/ContextIndicator.vue";

defineProps<{
  placeholder?: string;
  variant?: "default" | "empty-state";
  contextPercent?: number;
}>();

const emit = defineEmits<{
  submit: [message: string];
}>();

const message = defineModel<string>({ required: true });
const inputElement = ref<HTMLTextAreaElement | null>(null);
const highlightedIndex = ref(0);
const dismissed = ref(false);

const slashCommands = useSlashCommands();

// matches "/" optionally followed by non-space chars, nothing else
const slashPrefix = computed(() => {
  const match = message.value.match(/^\/(\S*)$/);
  return match?.[1] ?? null;
});

const filteredCommands = computed(() => {
  if (slashPrefix.value === null) return [];
  const prefix = slashPrefix.value.toLowerCase();
  return Object.keys(slashCommands).filter((name) => name.startsWith(prefix));
});

const showAutocomplete = computed(
  () =>
    !dismissed.value &&
    slashPrefix.value !== null &&
    filteredCommands.value.length > 0,
);

function autoResize() {
  const el = inputElement.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
  el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
}

function onInput() {
  dismissed.value = false;
  highlightedIndex.value = 0;
  autoResize();
}

function runCommand(name: string) {
  dismissed.value = true;
  slashCommands[name]?.run();
  message.value = "";
}

function selectCommand(name: string) {
  dismissed.value = true;
  message.value = "/" + name;
  inputElement.value?.focus();
}

function handleKeydown(e: KeyboardEvent) {
  if (showAutocomplete.value) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex.value =
        (highlightedIndex.value + 1) % filteredCommands.value.length;
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex.value =
        (highlightedIndex.value - 1 + filteredCommands.value.length) %
        filteredCommands.value.length;
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      dismissed.value = true;
      return;
    }
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      const selected = filteredCommands.value[highlightedIndex.value];
      if (selected) runCommand(selected);
      return;
    }
  }

  if (
    e.key === "Enter" &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  ) {
    e.preventDefault();
    handleSubmit();
  }
}

function handleSubmit() {
  const msg = message.value.trim();
  if (!msg) return;

  const slashMatch = msg.match(/^\/(\S+)/);
  const name = slashMatch?.[1];
  if (name) {
    const command = slashCommands[name];
    if (command) {
      command.run();
      message.value = "";
      return;
    }
  }

  emit("submit", msg);
}

// Auto-focus input when user starts typing anywhere on the page
function handleGlobalKeydown(e: KeyboardEvent) {
  // Skip if already focused on an input/textarea, or if modifier keys are held
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;

  // Only capture printable characters
  if (e.key.length !== 1) return;

  inputElement.value?.focus();
}

watch(message, () => {
  nextTick(autoResize);
});

onMounted(() => {
  document.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalKeydown);
});

defineExpose({ inputElement });
</script>

<template>
  <form @submit.prevent="handleSubmit" class="relative w-full">
    <div
      :class="[
        'relative flex items-center',
        variant === 'empty-state' && 'max-w-3xl',
      ]"
    >
      <!-- slash-command autocomplete -->
      <div
        v-if="showAutocomplete"
        class="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border-primary bg-bg-secondary shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-hidden z-10 p-2"
      >
        <div
          v-for="(cmd, index) in filteredCommands"
          :key="cmd"
          :class="[
            'px-4 py-2.5 cursor-pointer text-sm transition-colors duration-100 text-text-primary rounded-md flex',
            index === highlightedIndex && 'bg-bg-hover',
          ]"
          @mousedown.prevent="selectCommand(cmd)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="font-medium">/{{ cmd }}</span>
          <span class="ml-3 text-text-secondary">{{
            slashCommands[cmd]?.description
          }}</span>
        </div>
      </div>

      <textarea
        ref="inputElement"
        v-model="message"
        rows="1"
        :placeholder="placeholder || 'Send a message...'"
        @keydown="handleKeydown"
        @input="onInput"
        class="w-full py-4 pl-5 pr-24 rounded-3xl text-base resize-none font-inherit max-h-50 transition-colors duration-200 focus:outline-none bg-bg-secondary border border-border-primary text-text-primary placeholder-text-secondary focus:border-border-secondary"
      ></textarea>
      <div class="absolute right-2 bottom-2 flex items-center gap-1.5">
        <ContextIndicator
          v-if="contextPercent != null && contextPercent > 0"
          :percent="contextPercent"
        />
        <button
          type="submit"
          :disabled="!message.trim()"
          class="w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-button-inverse text-button-inverse-text [&:hover:not(:disabled)]:bg-button-inverse-hover"
        >
          <Send :size="16" />
        </button>
      </div>
    </div>
  </form>
</template>

<style scoped>
textarea {
  scrollbar-width: none;
}
textarea::-webkit-scrollbar {
  display: none;
}
</style>
