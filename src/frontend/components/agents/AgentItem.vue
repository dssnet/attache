<script setup lang="ts">
defineProps<{
  agent: {
    id: string;
    task: string;
    status: "running" | "completed";
    messages: string[];
  };
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <div
    :class="[
      'flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors duration-200 text-sm hover:bg-bg-hover',
      agent.status === 'completed' ? 'opacity-60' : '',
    ]"
    @click="emit('click')"
  >
    <span
      :class="[
        'text-[10px] leading-none shrink-0',
        agent.status === 'running'
          ? 'text-primary animate-pulse-fast'
          : 'text-emerald-500',
      ]"
      >●</span
    >
    <span
      class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-primary"
    >
      {{ agent.task }}
    </span>
  </div>
</template>
