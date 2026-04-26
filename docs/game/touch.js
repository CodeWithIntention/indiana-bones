import { overlay, keysPressed } from "./game.js";

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

const SWIPE_MIN_DISTANCE = 30;
const TAP_MAX_DISTANCE = 10;
const TAP_MAX_TIME = 250;

let lastDirection = null;

function updateDirection(direction) {
  if (direction !== lastDirection) {
    if (lastDirection) {
        keysPressed[lastDirection] = false;
    }
    if (direction) {
        keysPressed[direction] = true;
    }
    lastDirection = direction;
  }
}

overlay.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
}, { passive: true });

overlay.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];

  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  const elapsed = Date.now() - touchStartTime;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  // Tap = action
  if (absX < TAP_MAX_DISTANCE && absY < TAP_MAX_DISTANCE && elapsed < TAP_MAX_TIME) {
    keysPressed["Space"] = true; // same logic as Space
    return;
  }

  // Swipe = movement
  if (Math.max(absX, absY) < SWIPE_MIN_DISTANCE) return;

  if (absX > absY) {
    if (dx > 0) {
      updateDirection("ArrowRight");
    } else {
      updateDirection("ArrowLeft");
    }
  } else {
    if (dy > 0) {
      updateDirection("ArrowDown");
    } else {
      updateDirection("ArrowUp");
    }
  }
}, { passive: true });

overlay.addEventListener("touchcancel", () => {
  updateDirection(null);
});

overlay.addEventListener("touchstart", () => {
  updateDirection(null);
});
