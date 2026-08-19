import { flushSync } from "react-dom";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const PRECISE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const pointerFrames = new WeakMap();
let transitionSequence = 0;

function matchesMedia(query) {
  return typeof window !== "undefined" && window.matchMedia?.(query).matches;
}

export function runPortalTransition(update, kind = "page") {
  if (
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    matchesMedia(REDUCED_MOTION_QUERY)
  ) {
    update();
    return null;
  }

  const transitionId = String(++transitionSequence);
  document.documentElement.dataset.portalTransition = kind;
  document.documentElement.dataset.portalTransitionId = transitionId;

  const cleanTransitionMarker = () => {
    if (document.documentElement.dataset.portalTransitionId !== transitionId) return;
    delete document.documentElement.dataset.portalTransition;
    delete document.documentElement.dataset.portalTransitionId;
  };

  try {
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });

    transition.finished.then(cleanTransitionMarker, cleanTransitionMarker);

    return transition;
  } catch {
    cleanTransitionMarker();
    update();
    return null;
  }
}

export function getReportTransitionName(reportId) {
  const safeId = String(reportId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `report-${safeId}`;
}

export function handlePremiumPointerMove(event) {
  if (event.pointerType === "touch" || matchesMedia(REDUCED_MOTION_QUERY) || !matchesMedia(PRECISE_POINTER_QUERY)) return;

  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
  const tiltY = ((x / rect.width) - 0.5) * 1.6;
  const tiltX = (0.5 - (y / rect.height)) * 1.2;

  const pendingFrame = pointerFrames.get(element);
  if (pendingFrame) cancelAnimationFrame(pendingFrame);

  const frame = requestAnimationFrame(() => {
    element.style.setProperty("--pointer-x", `${x}px`);
    element.style.setProperty("--pointer-y", `${y}px`);
    element.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    element.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    pointerFrames.delete(element);
  });

  pointerFrames.set(element, frame);
}

export function resetPremiumPointer(event) {
  const element = event.currentTarget;
  const pendingFrame = pointerFrames.get(element);
  if (pendingFrame) cancelAnimationFrame(pendingFrame);
  pointerFrames.delete(element);
  element.style.setProperty("--tilt-x", "0deg");
  element.style.setProperty("--tilt-y", "0deg");
}
