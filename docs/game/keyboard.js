const KEY_MAPPINGS = {
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",

    KeyW: "ArrowUp",
    KeyS: "ArrowDown",
    KeyA: "ArrowLeft",
    KeyD: "ArrowRight",

    Space: "Space",
    Enter: "Space",
    NumpadEnter: "Space",

    mappedKey: (keyCode) => {
      return KEY_MAPPINGS[keyCode] ?? keyCode
    }
};

export const Keyboard = {
  // BEGIN: Input Keys (do not change order)
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    NextMaze: false,
  // END

    initWith(gameWindow) {
        gameWindow.document.addEventListener("keydown", e => onKeyEvent(e, true));
        gameWindow.document.addEventListener("keyup", e => onKeyEvent(e, false));
    },

    onSpacePressed: () => false,

    onArrowKeyPressed: (arrowKey) => false,

    clear() {
      this.enumerateInputs(key => this[key] = false);
    },

    getMask() {
        let mask = 0;
        let bit = 0;

        this.enumerateInputs((key, value) => {
          if (value) {
            mask |= (1 << bit);
          }
          bit++;
        });

        return mask;
    },

    applyMask(mask) {
        if (!Number.isInteger(mask) || mask < 0) return;

        let bit = 0;

        this.enumerateInputs(key => {
          this[key] = !!(mask & (1 << bit));
          bit++;
        });
    },

    enumerateInputs(callback) {
      for (const [key, value] of Object.entries(this)) {
        if (typeof value !== 'boolean') break; 
        
        callback(key, value);
      }
    },
}

function onKeyEvent(event, pressed) {
    const keyCode = KEY_MAPPINGS.mappedKey(event.code);

    if (pressed && keyCode === "Space") {
      if (Keyboard.onSpacePressed()) {
        event.preventDefault();
        return;
      }
    }

    if (pressed && keyCode.startsWith("Arrow")) {
      if (Keyboard.onArrowKeyPressed(keyCode)) {
        event.preventDefault();
        return;
      }
    }

    if (keyCode === "Space") {
      event.preventDefault();
      Keyboard[keyCode] = pressed;
    } else if (typeof Keyboard[keyCode] !== "undefined") {
      event.preventDefault();
      Keyboard[keyCode] = pressed;
    }

    // DEBUG: Hidden keystroke for advancing to next maze immediately.
    if (!pressed && keyCode === "ArrowLeft") {
      Keyboard.NextMaze = event.shiftKey && event.ctrlKey;
    } else {
      Keyboard.NextMaze = false;
    }
}
