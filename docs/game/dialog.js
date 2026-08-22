import { gameScreen, keysPressed } from "./game-ui.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export class Dialog {
  static #container = null;
  static #controls = [];
  static #selectedIndex = -1;
  static #previousFocus = null;

  static #previousSpaceHook = null;
  static #previousArrowHook = null;

  static bind(dialog) {
    if (!(dialog instanceof Element)) {
      throw new TypeError(
        "Dialog.bind(dialog) requires a container element."
      );
    }

    if (Dialog.#container) {
      Dialog.dismiss(Dialog.#container, {
        restoreFocus: false
      });
    }

    Dialog.#container = dialog;
    Dialog.#previousFocus = document.activeElement;

    Dialog.#previousSpaceHook =
      keysPressed.onSpacePressed;

    Dialog.#previousArrowHook =
      keysPressed.onArrowKeyPressed;

    keysPressed.onSpacePressed =
      Dialog.#onSpacePressed;

    keysPressed.onArrowKeyPressed =
      Dialog.#onArrowKeyPressed;

    Dialog.#refreshControls();

    /*
    * If something inside the dialog already has focus, retain
    * that selection. Otherwise, select the first control.
    */
    const focusedIndex = Dialog.#controls.indexOf(
        document.activeElement
    );

    if (focusedIndex !== -1) {
        Dialog.#selectedIndex = focusedIndex;
    } else {
        Dialog.#focusControl(0);
    }
  }

  static unbind(dialog, restoreFocus = true) {
    if (!(dialog instanceof Element)) {
      throw new TypeError(
        "Dialog.dismiss(dialog) requires a container element."
      );
    }

    /*
     * Do not allow one dialog to dismiss a different active
     * dialog accidentally.
     */
    if (dialog !== Dialog.#container) {
      return false;
    }

    const previousFocus = Dialog.#previousFocus;

    keysPressed.onSpacePressed =
      Dialog.#previousSpaceHook;

    keysPressed.onArrowKeyPressed =
      Dialog.#previousArrowHook;

    Dialog.#container = null;
    Dialog.#controls = [];
    Dialog.#selectedIndex = -1;
    Dialog.#previousFocus = null;
    Dialog.#previousSpaceHook = null;
    Dialog.#previousArrowHook = null;

    if (
      restoreFocus &&
      previousFocus instanceof HTMLElement &&
      previousFocus.isConnected
    ) {
      previousFocus.focus({
        preventScroll: true
      });
    }

    return true;
  }

  static isShown(dialog) {
    if (dialog === undefined) {
      return Dialog.#container !== null;
    }

    return Dialog.#container === dialog;
  }

  static #onSpacePressed = () => {
    if (!Dialog.#container) {
      return false;
    }

    Dialog.#refreshControls();

    const selectedControl =
      Dialog.#controls[Dialog.#selectedIndex];

    if (selectedControl) {
      selectedControl.click();
    }

    /*
     * The dialog consumed the Space or controller-A action.
     */
    return true;
  };

  static #onArrowKeyPressed = direction => {
    if (!Dialog.#container) {
      return false;
    }

    if (direction === "ArrowLeft") {
      Dialog.#moveSelection(-1);
    } else if (direction === "ArrowRight") {
      Dialog.#moveSelection(1);
    }

    /*
     * Consume every arrow direction while the dialog is active.
     * Up and Down do nothing, but cannot move the player behind
     * the dialog.
     */
    return true;
  };

  static #moveSelection(offset) {
    const selectedControl =
      Dialog.#controls[Dialog.#selectedIndex];

    Dialog.#refreshControls();

    if (Dialog.#controls.length === 0) {
      return;
    }

    const currentIndex =
      Dialog.#controls.indexOf(selectedControl);

    if (currentIndex !== -1) {
      Dialog.#selectedIndex = currentIndex;
    }

    Dialog.#focusControl(
      Dialog.#selectedIndex + offset
    );
  }

  static #focusControl(index) {
    if (Dialog.#controls.length === 0) {
      Dialog.#selectedIndex = -1;
      return;
    }

    Dialog.#selectedIndex =
      (
        index +
        Dialog.#controls.length
      ) % Dialog.#controls.length;

    Dialog.#controls[
      Dialog.#selectedIndex
    ].focus({
      preventScroll: true
    });
  }

  static #refreshControls() {
    if (!Dialog.#container) {
      Dialog.#controls = [];
      Dialog.#selectedIndex = -1;
      return;
    }

    const selectedControl =
      Dialog.#controls[Dialog.#selectedIndex];

    Dialog.#controls = Array.from(
      Dialog.#container.querySelectorAll(
        FOCUSABLE_SELECTOR
      )
    ).filter(Dialog.#isVisible);

    if (Dialog.#controls.length === 0) {
      Dialog.#selectedIndex = -1;
      return;
    }

    const refreshedIndex =
      Dialog.#controls.indexOf(selectedControl);

    if (refreshedIndex !== -1) {
      Dialog.#selectedIndex = refreshedIndex;
    } else if (
      Dialog.#selectedIndex >=
      Dialog.#controls.length
    ) {
      Dialog.#selectedIndex =
        Dialog.#controls.length - 1;
    }
  }

  static #isVisible(element) {
    return Boolean(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  }
}

gameScreen.addEventListener(gameScreen.DialogEvents.show.name, (event) => {
    const dialog = event.detail?.dialog;
    Dialog.bind(dialog);
});

gameScreen.addEventListener(gameScreen.DialogEvents.dismiss.name, (event) => {
    const dialog = event.detail?.dialog;
    Dialog.unbind(dialog);
});
