import { ref, nextTick, onMounted, onUnmounted, type Ref } from "vue";

const EDGE_THRESHOLD = 30; // px from left edge to start open swipe
const VELOCITY_THRESHOLD = 0.3; // px/ms for a fast flick
const SWIPE_THRESHOLD = 0.4; // 40% progress to snap open/closed

export function useSidebarSwipe(
  sidebarCollapsed: Ref<boolean>,
  toggleSidebar: () => void,
) {
  const sidebarRef = ref<HTMLElement | null>(null);
  const overlayRef = ref<HTMLElement | null>(null);
  const isSwiping = ref(false);

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let currentX = 0;
  let sidebarWidth = 0;
  let swipeActive = false;
  let directionLocked = false;
  let isHorizontal = false;
  let cleaning = false;

  function onTouchStart(e: TouchEvent) {
    if (window.innerWidth >= 768 || cleaning) return;

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    currentX = startX;
    directionLocked = false;
    isHorizontal = false;

    if (sidebarCollapsed.value && startX <= EDGE_THRESHOLD) {
      swipeActive = true;
    } else if (!sidebarCollapsed.value) {
      swipeActive = true;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!swipeActive || window.innerWidth >= 768) return;

    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Lock direction after sufficient movement
    if (!directionLocked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      directionLocked = true;
      isHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!isHorizontal) {
        swipeActive = false;
        return;
      }
      if (sidebarRef.value) {
        sidebarWidth = sidebarRef.value.offsetWidth;
      }
    }

    if (!directionLocked || !isHorizontal) return;

    // Calculate progress: 0 = closed, 1 = fully open
    let progress: number;
    if (sidebarCollapsed.value) {
      progress = Math.max(0, Math.min(1, dx / sidebarWidth));
    } else {
      progress = Math.max(0, Math.min(1, 1 + dx / sidebarWidth));
    }

    if (!isSwiping.value) {
      isSwiping.value = true;
      if (sidebarRef.value) {
        sidebarRef.value.style.transition = "none";
      }
    }

    currentX = touch.clientX;

    // Use CSS `translate` property (Tailwind 4 uses native translate, not transform)
    // -100% 0 = closed, 0 0 = open
    if (sidebarRef.value) {
      const pct = (progress - 1) * 100;
      sidebarRef.value.style.translate = `${pct}% 0`;
    }

    // Apply overlay opacity (element has bg-black/30, we scale element opacity 0→1)
    if (overlayRef.value) {
      overlayRef.value.style.opacity = String(progress);
      overlayRef.value.style.pointerEvents = progress > 0 ? "auto" : "none";
    }

    e.preventDefault();
  }

  function onTouchEnd() {
    if (!swipeActive || !isSwiping.value) {
      swipeActive = false;
      return;
    }

    swipeActive = false;
    isSwiping.value = false;

    const sidebar = sidebarRef.value;
    if (!sidebar) return;

    const elapsed = Date.now() - startTime;
    const velocity = (currentX - startX) / Math.max(elapsed, 1);
    const dx = currentX - startX;

    let progress: number;
    if (sidebarCollapsed.value) {
      progress = Math.max(0, Math.min(1, dx / sidebarWidth));
    } else {
      progress = Math.max(0, Math.min(1, 1 + dx / sidebarWidth));
    }

    const shouldOpen =
      Math.abs(velocity) > VELOCITY_THRESHOLD
        ? velocity > 0
        : progress >= SWIPE_THRESHOLD;

    // Re-enable transition and animate to final position
    sidebar.style.transition = "";
    sidebar.style.translate = shouldOpen ? "0 0" : "-100% 0";

    if (overlayRef.value) {
      overlayRef.value.style.transition = "opacity 0.2s ease-in-out";
      overlayRef.value.style.opacity = shouldOpen ? "1" : "0";
      overlayRef.value.style.pointerEvents = shouldOpen ? "auto" : "none";
    }

    // After transition, sync state and clear inline styles
    cleaning = true;

    const cleanup = () => {
      sidebar.removeEventListener("transitionend", onEnd);

      // Toggle state first, then clear inline styles after Vue updates DOM
      const needsToggle =
        (shouldOpen && sidebarCollapsed.value) ||
        (!shouldOpen && !sidebarCollapsed.value);

      if (needsToggle) {
        toggleSidebar();
      }

      nextTick(() => {
        sidebar.style.translate = "";
        sidebar.style.transition = "";
        if (overlayRef.value) {
          overlayRef.value.style.opacity = "";
          overlayRef.value.style.pointerEvents = "";
          overlayRef.value.style.transition = "";
        }
        cleaning = false;
      });
    };

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "translate") cleanup();
    };

    sidebar.addEventListener("transitionend", onEnd);
    // Safety timeout if transitionend doesn't fire
    setTimeout(() => {
      if (cleaning) cleanup();
    }, 350);
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

  return { sidebarRef, overlayRef, isSwiping };
}
