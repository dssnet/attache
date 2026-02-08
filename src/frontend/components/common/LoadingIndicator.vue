<template>
  <div class="flex justify-start py-2 px-6">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1 h-6">
        <span class="loading-bar w-1 h-2 bg-primary rounded-sm"></span>
        <span class="loading-bar w-1 h-4 bg-primary rounded-sm"></span>
        <span class="loading-bar w-1 h-5 bg-primary rounded-sm"></span>
        <span class="loading-bar w-1 h-3 bg-primary rounded-sm"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-bar {
  animation: bar-wave 1.2s ease-in-out infinite;
}

.loading-bar:nth-child(1) {
  animation-delay: 0s;
}
.loading-bar:nth-child(2) {
  animation-delay: 0.1s;
}
.loading-bar:nth-child(3) {
  animation-delay: 0.2s;
}
.loading-bar:nth-child(4) {
  animation-delay: 0.3s;
}

@keyframes bar-wave {
  0%, 100% {
    transform: scaleY(1);
    opacity: 0.6;
  }
  50% {
    transform: scaleY(1.5);
    opacity: 1;
  }
}
</style>
