import { gameWindow, keysPressed } from "./game-ui.js";

const AXIS_DEAD_ZONE = 0.45;

const BUTTON_A = 0;
const BUTTON_Y = 3;
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

let activeGamepadIndex = null;
let controllerDirection = null;
let primaryButtonPressed = false;

function updateControllerDirection(direction) {
  if (!direction || (direction === controllerDirection && keysPressed[controllerDirection])) return;

  if (controllerDirection) {
    keysPressed[controllerDirection] = false;
  }

  keysPressed[direction] = true;
  controllerDirection = direction;
}

function clearControllerInput() {
  if (controllerDirection) {
    keysPressed[controllerDirection] = false;
  }

  controllerDirection = null;
  primaryButtonPressed = false;
}

function isButtonPressed(gamepad, buttonIndex) {
  return gamepad.connected && gamepad.buttons[buttonIndex]?.pressed === true;
}

function getDPadDirection(gamepad) {
  if (isButtonPressed(gamepad, BUTTON_DPAD_UP)) return "ArrowUp";
  if (isButtonPressed(gamepad, BUTTON_DPAD_DOWN)) return "ArrowDown";
  if (isButtonPressed(gamepad, BUTTON_DPAD_LEFT)) return "ArrowLeft";
  if (isButtonPressed(gamepad, BUTTON_DPAD_RIGHT)) return "ArrowRight";

  return null;
}

function getJoystickDirection(gamepad) {
  const horizontal = gamepad.axes[0] ?? 0;
  const vertical = gamepad.axes[1] ?? 0;

  const absHorizontal = Math.abs(horizontal);
  const absVertical = Math.abs(vertical);

  if (Math.max(absHorizontal, absVertical) < AXIS_DEAD_ZONE) {
    return null;
  }

  if (absHorizontal > absVertical) {
    return horizontal > 0 ? "ArrowRight" : "ArrowLeft";
  }

  return vertical > 0 ? "ArrowDown" : "ArrowUp";
}

function updatePrimaryButton(gamepad) {
  const isPressed = isButtonPressed(gamepad, BUTTON_A);

  // Generate one Space press when the primary button is initially pressed.
  // The game handles clearing keysPressed.Space after consuming the action.
  if (isPressed && !primaryButtonPressed) {
    if (keysPressed.onSpacePressed()) return;
    keysPressed.Space = true;
  }

  primaryButtonPressed = isPressed;
}

function getActiveGamepad() {
  const gamepads = navigator.getGamepads();

  if (activeGamepadIndex !== null) {
    const activeGamepad = gamepads[activeGamepadIndex];

    if (activeGamepad?.connected) {
      return activeGamepad;
    }
  }

  const selectedGamepad = (() => {
    // Only interested in connected gamepads
    const connectedGamepads = Array.from(gamepads).filter(gamepad => gamepad?.connected);

    // If more than one then Y button on controller will select it
    if (connectedGamepads.length == 1) return connectedGamepads[0];
    return connectedGamepads.find(gamepad => isButtonPressed(gamepad, BUTTON_Y));
  })();

  if (selectedGamepad) {
    activeGamepadIndex = selectedGamepad.index;
  }

  return selectedGamepad;
}

function updateController() {
  const gamepad = getActiveGamepad();

  if (gamepad) {
    const direction =
      getDPadDirection(gamepad) ??
      getJoystickDirection(gamepad);

    // Like touch.js, returning the control to center does not stop movement.
    // The last chosen direction remains active until a new one is selected.
    updateControllerDirection(direction);
    updatePrimaryButton(gamepad);
  }

  requestAnimationFrame(updateController);
}

gameWindow.addEventListener("gamepadconnected", (event) => {
  if (activeGamepadIndex === null) {
    updateController();
  }
});

gameWindow.addEventListener("gamepaddisconnected", (event) => {
  if (event.gamepad.index !== activeGamepadIndex) return;

  activeGamepadIndex = null;
  clearControllerInput();
});

if ("getGamepads" in navigator) {
  requestAnimationFrame(updateController);
}
