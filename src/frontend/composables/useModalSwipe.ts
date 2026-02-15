import { ref, onMounted, onUnmounted } from "vue";

const SWIPE_THRESHOLD = 0.3; // 30% of modal height to dismiss
const VELOCITY_THRESHOLD = 0.5; // px/ms for a fast flick

export function useModalSwipe(onClose: () => void) {
  const modalRef = ref<HTMLElement | null>(null);
  const isDragging = ref(false);

  let startY = 0;
  let startX = 0;
  let currentY = 0;
  let startTime = 0;
  let modalHeight = 0;
  let dragActive = false;
  let directionLocked = false;
  let isVertical = false;

  function onTouchStart(e: TouchEvent) {
    if (window.innerWidth >= 768) return;
    const modal = modalRef.value;
    if (!modal || !modal.contains(e.target as Node)) return;

    // Only start drag from the handle area (top 48px) or when scroll is at top
    const touch = e.touches[0];
    if (!touch) return;
    const rect = modal.getBoundingClientRect();
    const offsetY = touch.clientY - rect.top;
    const scrollContainer = modal.querySelector(".overflow-y-auto");
    const isScrolledToTop = !scrollContainer || scrollContainer.scrollTop <= 0;

    if (offsetY <= 48 || isScrolledToTop) {
      startY = touch.clientY;
      startX = touch.clientX;
      startTime = Date.now();
      currentY = startY;
      modalHeight = modal.offsetHeight;
      dragActive = true;
      directionLocked = false;
      isVertical = false;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!dragActive || window.innerWidth >= 768) return;

    const touch = e.touches[0];
    if (!touch) return;
    const dy = touch.clientY - startY;
    const dx = touch.clientX - startX;

    if (!directionLocked && (Math.abs(dy) > 10 || Math.abs(dx) > 10)) {
      directionLocked = true;
      isVertical = Math.abs(dy) > Math.abs(dx);
      if (!isVertical) {
        dragActive = false;
        return;
      }
    }

    if (!directionLocked || !isVertical) return;

    // Only allow dragging downward
    const offset = Math.max(0, dy);
    if (offset === 0) return;

    if (!isDragging.value) {
      isDragging.value = true;
      if (modalRef.value) {
        modalRef.value.style.transition = "none";
      }
    }

    currentY = touch.clientY;

    if (modalRef.value) {
      modalRef.value.style.translate = `0 ${offset}px`;
    }

    e.preventDefault();
  }

  function onTouchEnd() {
    if (!dragActive || !isDragging.value) {
      dragActive = false;
      return;
    }

    dragActive = false;
    isDragging.value = false;

    const modal = modalRef.value;
    if (!modal) return;

    const dy = Math.max(0, currentY - startY);
    const elapsed = Date.now() - startTime;
    const velocity = dy / Math.max(elapsed, 1);
    const progress = dy / modalHeight;

    const shouldClose =
      velocity > VELOCITY_THRESHOLD || progress >= SWIPE_THRESHOLD;

    // Re-enable transition
    modal.style.transition = "";

    if (shouldClose) {
      modal.style.translate = `0 100%`;
      // Wait for slide-out animation, then close.
      // Keep inline translate so the modal stays off-screen while
      // Vue's leave transition runs — prevents the flash/jump.
      const finish = () => {
        modal.removeEventListener("transitionend", onEnd);
        onClose();
      };
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName === "translate") finish();
      };
      modal.addEventListener("transitionend", onEnd);
      setTimeout(() => finish(), 350);
    } else {
      // Snap back
      modal.style.translate = "0 0";
      const reset = () => {
        modal.removeEventListener("transitionend", onReset);
        modal.style.translate = "";
        modal.style.transition = "";
      };
      const onReset = (e: TransitionEvent) => {
        if (e.propertyName === "translate") reset();
      };
      modal.addEventListener("transitionend", onReset);
      setTimeout(() => reset(), 350);
    }
  }

  onMounted(() => {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
  });

  onUnmounted(() => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  });

  return { modalRef, isDragging };
}
