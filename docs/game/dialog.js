import { Keyboard } from "./keyboard.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

const DEFAULT_BUTTON_SELECTOR = "button[data-default], a[data-default]";

export class Dialog {
  static #container = null;
  static #controls = [];
  static #selectedIndex = -1;
  static #previousFocus = null;

  static #previousSpaceHook = null;
  static #previousArrowHook = null;

  static initWith(gameScreen) {
    gameScreen.addEventListener(gameScreen.DialogEvents.show.name, (event) => {
        const dialog = event.detail?.dialog;
        Dialog.bind(dialog);
    });

    gameScreen.addEventListener(gameScreen.DialogEvents.dismiss.name, (event) => {
        const dialog = event.detail?.dialog;
        Dialog.unbind(dialog);
    });
  }

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
      Keyboard.onSpacePressed;

    Dialog.#previousArrowHook =
      Keyboard.onArrowKeyPressed;

    Keyboard.onSpacePressed =
      Dialog.#onSpacePressed;

    Keyboard.onArrowKeyPressed =
      Dialog.#onArrowKeyPressed;

    Dialog.#refreshControls();
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

    Keyboard.onSpacePressed =
      Dialog.#previousSpaceHook;

    Keyboard.onArrowKeyPressed =
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

    if (direction === "ArrowLeft" || direction === "ArrowUp") {
      Dialog.#moveSelection(-1);
    } else if (direction === "ArrowRight" || direction === "ArrowDown") {
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

    // Retain previous selection
    const selectedControl =
        Dialog.#controls[Dialog.#selectedIndex];

    // Refresh controls
    Dialog.#controls = Array.from(
        Dialog.#container.querySelectorAll(
        FOCUSABLE_SELECTOR
        )
    ).filter(Dialog.#isVisible);

    // If no controls yet, then schedule another refresh later
    if (Dialog.#controls.length === 0) {
        Dialog.#selectedIndex = -1;

        const dialogWindow = Dialog.#container.ownerDocument.defaultView;

        dialogWindow?.requestAnimationFrame(Dialog.#refreshControls);

        return;
    }

    const refreshedIndex = Dialog.#controls.indexOf(selectedControl);

    if (refreshedIndex !== -1) {
        /*
        * Preserve the currently selected control.
        */
        Dialog.#selectedIndex = refreshedIndex;
        return;
    }

    /*
    * Search the filtered controls for the default
    */
    let focusIndex = Dialog.#controls.findIndex(control =>
        control.matches(DEFAULT_BUTTON_SELECTOR)
    );

    if (focusIndex === -1) {
        /*
        * Retain the previously selected control's approximate
        * position. For a newly opened dialog, select the first one.
        */
        focusIndex = Dialog.#selectedIndex >= 0
        ? Math.min(
            Dialog.#selectedIndex,
            Dialog.#controls.length - 1
            )
        : 0;
    }

    Dialog.#focusControl(focusIndex);
  }

  static #isVisible(element) {
    return Boolean(
      element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length
    );
  }
}
