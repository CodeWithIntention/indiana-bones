import { gameWindow, keysPressed } from "./game-ui.js";

const AXIS_DEAD_ZONE = 0.45;

const BUTTON_A = 0;
const BUTTON_Y = 3;
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

const ARROW_KEYS_MAP = {
  ArrowUp: BUTTON_DPAD_UP,
  ArrowDown: BUTTON_DPAD_DOWN, 
  ArrowLeft: BUTTON_DPAD_LEFT,
  ArrowRight: BUTTON_DPAD_RIGHT
}
Object.entries(ARROW_KEYS_MAP).forEach(([key, value]) => ARROW_KEYS_MAP[value] = key);

let activeGamepadIndex = null;
let controllerDirection = null;
let physicalControllerDirection = null;
let primaryButtonPressed = false;

function updateControllerDirection(direction) {
  /*
   * Returning the stick to center releases the physical-input
   * edge without stopping the player's current movement.
   */
  if (!direction) {
    physicalControllerDirection = null;
    return;
  }

  /*
   * Only generate one arrow-key press per physical movement.
   */
  if (direction === physicalControllerDirection) {
    return;
  }

  physicalControllerDirection = direction;

  /*
   * A dialog or another UI component can consume the input.
   */
  if (keysPressed.onArrowKeyPressed(direction)) {
    return;
  }

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

  physicalControllerDirection = null;
  controllerDirection = null;
  primaryButtonPressed = false;
}

function isButtonPressed(gamepad, buttonIndex) {
  return gamepad.connected && gamepad.buttons[buttonIndex]?.pressed === true;
}

function getDPadDirection(gamepad) {
  if (isButtonPressed(gamepad, BUTTON_DPAD_UP)) return ARROW_KEYS_MAP[BUTTON_DPAD_UP];
  if (isButtonPressed(gamepad, BUTTON_DPAD_DOWN)) return ARROW_KEYS_MAP[BUTTON_DPAD_DOWN];
  if (isButtonPressed(gamepad, BUTTON_DPAD_LEFT)) return ARROW_KEYS_MAP[BUTTON_DPAD_LEFT];
  if (isButtonPressed(gamepad, BUTTON_DPAD_RIGHT)) return ARROW_KEYS_MAP[BUTTON_DPAD_RIGHT];

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
    return ARROW_KEYS_MAP[horizontal > 0 ? BUTTON_DPAD_RIGHT : BUTTON_DPAD_LEFT];
  }

  return ARROW_KEYS_MAP[vertical > 0 ? BUTTON_DPAD_DOWN : BUTTON_DPAD_UP];
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
