import { overlay, keysPressed } from "./game.js";

let touchStartX = 0;
let touchStartY = 0;
let lastTapTime = 0;

const SWIPE_MIN_DISTANCE = 20;
const TAP_MAX_DISTANCE = 20;
const TAP_MAX_TIME = 350;

let touchDirection = null;

function updateTouchDirection(direction) {
  if (direction !== touchDirection) {
    if (touchDirection) {
        keysPressed[touchDirection] = false;
    }
    if (direction) {
        keysPressed[direction] = true;
    }
    touchDirection = direction;
  }
}

function beginMouseMove(event) {
  lastTapTime = Date.now();
  overlay.setPointerCapture(event.pointerId);
  updateTouchDirection(null);
  updateMouseMove(event);
}

function updateMouseMove(event) {
  touchStartX = event.clientX;
  touchStartY = event.clientY;
}

function endMouseMove(event) {
  overlay.releasePointerCapture(event.pointerId);
}

function isTrackingMouseMove(event) {
  return overlay.hasPointerCapture(event.pointerId);
}

overlay.addEventListener("pointerdown", (event) => {
  if (event.target !== overlay) return;

  event.preventDefault();
  beginMouseMove(event);
});

overlay.addEventListener("pointermove", (event) => {
  if (!isTrackingMouseMove(event)) return;

  event.preventDefault();

  const dx = event.clientX - touchStartX;
  const dy = event.clientY - touchStartY;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) < SWIPE_MIN_DISTANCE) return;

  if (absX > absY) {
    updateTouchDirection(dx > 0 ? "ArrowRight" : "ArrowLeft");
  } else {
    updateTouchDirection(dy > 0 ? "ArrowDown" : "ArrowUp");
  }
});

overlay.addEventListener("pointerup", (event) => {
  event.preventDefault();
  endMouseMove(event);

  const now = Date.now();
  const timeSinceLastTap = now - lastTapTime;
  
  if (timeSinceLastTap > TAP_MAX_TIME) return;

  const dx = event.clientX - touchStartX;
  const dy = event.clientY - touchStartY;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  // Detect tap (not swipe)
  const isTap = absX < TAP_MAX_DISTANCE && absY < TAP_MAX_DISTANCE;

  if (isTap) {
    keysPressed.Space = true;
  }
});

overlay.addEventListener("pointercancel", (event) => {
  event.preventDefault();
  endMouseMove(event);
  updateTouchDirection(null);
});