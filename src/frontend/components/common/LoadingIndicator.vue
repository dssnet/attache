<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import spinners from "unicode-animations";

const messages = [
  "hold on a sec",
  "one moment",
  "working on it",
  "brb",
  "cooking",
  "crunching numbers",
  "doing math",
  "loading brain.dll",
  "downloading more RAM",
  "asking the cloud",
  "untangling tokens",
  "shuffling weights",
  "grepping the void",
  "compiling thoughts.exe",
  "defragmenting neurons",
  "git pull --brain",
  "npm install answer",
  "sudo think harder",
  "404 patience not found",
  "spinning up hamsters",
];

const spinnerNames = Object.keys(spinners) as (keyof typeof spinners)[];
const chosen = spinnerNames[Math.floor(Math.random() * spinnerNames.length)]!;
const { frames, interval } = spinners[chosen];
const message = messages[Math.floor(Math.random() * messages.length)];

const frame = ref(0);
let timer: ReturnType<typeof setInterval>;

onMounted(() => {
  timer = setInterval(() => {
    frame.value = (frame.value + 1) % frames.length;
  }, interval);
});

onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <div class="flex justify-start py-2 px-3">
    <div class="flex items-center gap-2">
      <span class="braille-spinner text-primary text-base leading-6">{{ frames[frame] }}</span>
      <span class="text-xs text-text-secondary">{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
@font-face {
  font-family: "Braille";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/noto-sans-symbols-2-braille.woff2") format("woff2");
  unicode-range: U+2800-28FF;
}

.braille-spinner {
  font-family: "Braille", monospace;
}
</style>
