import { ref } from "vue";

export type ToastType = "error" | "success" | "warning" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

let nextId = 0;
const toasts = ref<Toast[]>([]);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  error: 8000,
  success: 4000,
  warning: 5000,
  info: 4000,
};

function addToast(type: ToastType, message: string, duration?: number): number {
  const id = nextId++;
  const toast: Toast = {
    id,
    type,
    message,
    duration: duration ?? DEFAULT_DURATIONS[type],
  };
  toasts.value.push(toast);

  if (toast.duration > 0) {
    setTimeout(() => dismiss(id), toast.duration);
  }

  return id;
}

function dismiss(id: number) {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (message: string, duration?: number) =>
      addToast("success", message, duration),
    error: (message: string, duration?: number) =>
      addToast("error", message, duration),
    warning: (message: string, duration?: number) =>
      addToast("warning", message, duration),
    info: (message: string, duration?: number) =>
      addToast("info", message, duration),
  };
}
