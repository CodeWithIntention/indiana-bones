const NEXT_MARKER_DELAY = 750;

export class ReplayBar {
  #host;
  #options;
  #timeline;
  #currentTick = 0;
  #playing = false;
  #speed = 1;
  #enabled = true;
  #activeMarker = null;
  
  #element;
  #track;
  #progress;
  #markers;
  #playButton;
  #speedButton;

  constructor(host, options = {}) {
    if (typeof host === "string") {
      host = document.querySelector(host);
    }

    if (!host) {
      throw new Error("ReplayBar requires a host element.");
    }

    this.#host = host;

    this.#options = {
      speeds: [1, 2, 3],

      onSelectMaze: null,
      onSelectEnd: null,
      onPlayPause: null,
      onStop: null,
      onSpeedChange: null,

      ...options
    };

    this.#timeline = {
      totalTicks: 0,
      markers: []
    };

    this.#create();
    this.#renderMarkers();
    this.#update();
  }

  #create() {
    this.#element = document.createElement("div");
    this.#element.className = "replay-bar";

    const timelineRow = document.createElement("div");
    timelineRow.className = "replay-bar__timeline";

    this.#track = document.createElement("div");
    this.#track.className = "replay-bar__track";

    const remaining = document.createElement("div");
    remaining.className = "replay-bar__remaining";

    this.#progress = document.createElement("div");
    this.#progress.className = "replay-bar__progress";

    this.#markers = document.createElement("div");
    this.#markers.className = "replay-bar__markers";

    this.#track.append(
      remaining,
      this.#progress,
      this.#markers
    );

    timelineRow.append(this.#track);

    const controlsRow = document.createElement("div");
    controlsRow.className = "replay-bar__controls";

    const transport = document.createElement("div");
    transport.className = "replay-bar__transport";

    const previousButton = this.#createButton({
      className: "replay-bar__previous",
      text: "◀◀",
      title: "Previous maze",
      label: "Previous maze",
      callback: () => {
        const activeMarkerIndex = Number(this.#activeMarker?.index);
        if (!(activeMarkerIndex >= 0)) return;

        const isApproximatelyAtMarker = (this.#currentTick - this.#activeMarker?.tick) * this.#timeline.msPerTick < NEXT_MARKER_DELAY; 
        const nextMarker = this.#timeline.markers.at( isApproximatelyAtMarker ? Math.max(activeMarkerIndex-1, 0) : activeMarkerIndex)
        this.#onSelectMarker(nextMarker);
      }
    });

    this.#playButton = this.#createButton({
      className: "replay-bar__play",
      text: "▶",
      title: "Play replay",
      label: "Play replay",
      callback: () => {
        const requestedState = !this.#playing;
        const result =
          this.#options.onPlayPause?.(requestedState);

        if (result === false) return;

        this.setPlaying(
          typeof result === "boolean"
            ? result
            : requestedState
        );
      }
    });

    const stopButton = this.#createButton({
      className: "replay-bar__stop",
      text: "■",
      title: "Stop replay",
      label: "Stop replay",
      callback: () => {
        this.setPlaying(false);
        this.#options.onStop?.();
      }
    });

    const nextButton = this.#createButton({
      className: "replay-bar__next",
      text: "▶▶",
      title: "Next maze",
      label: "Next maze",
      callback: () => {
        const activeMarkerIndex = Number(this.#activeMarker?.index);
        if (!(activeMarkerIndex >= 0)) return;

        const nextMarker = this.#timeline.markers.at(activeMarkerIndex+1)
        this.#onSelectMarker(nextMarker);
      }
    });

    transport.append(
      previousButton,
      this.#playButton,
      stopButton,
      nextButton
    );

    this.#speedButton = this.#createButton({
      className: "replay-bar__speed",
      text: "1×",
      title: "Playback speed",
      label: "Playback speed: 1 times",
      callback: () => {
        this.#cycleSpeed();
      }
    });

    controlsRow.append(
      transport,
      this.#speedButton
    );

    this.#element.append(
      timelineRow,
      controlsRow
    );

    this.#host.replaceChildren(this.#element);
  }

  #createButton({
    className,
    text,
    title,
    label,
    callback
  }) {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      `replay-bar__button ${className}`;
    button.textContent = text;
    button.title = title;
    button.setAttribute("aria-label", label);

    button.addEventListener("click", () => {
      if (!this.#enabled) return;
      callback();
    });

    return button;
  }

  setRecording(timeline) {
    this.reset();
    
    const markers = Array.isArray(timeline?.markers)
      ? timeline.markers
      : [];

    this.#timeline = {
      msPerTick: timeline?.msPerTick || 0,
      totalTicks: Math.max(
        0,
        Number(timeline?.totalTicks) || 0
      ),

      markers: markers
        .map((marker, index) => ({
          index:
            marker.index === undefined
              ? index
              : marker.index,

          tick: Math.max(
            0,
            Number(marker.tick) || 0
          ),

          level: marker.level,
          maze: marker.maze,
          type: marker.type ?? "maze"
        }))
        .sort((a, b) => a.tick - b.tick)
    };
    
    this.#currentTick = Math.min(
      this.#currentTick,
      this.#timeline.totalTicks
    );

    this.#renderMarkers();
    this.#update();
  }

  setCurrentTick(tick) {
    const totalTicks = this.#timeline.totalTicks;

    this.#currentTick = Math.max(
      0,
      Math.min(Number(tick) || 0, totalTicks)
    );

    this.#updateProgress();
    this.#updateMarkerStates();
  }

  setPlaying(playing) {
    this.#playing = Boolean(playing);

    this.#playButton.textContent =
      this.#playing ? "⏸" : "▶";

    this.#playButton.title =
      this.#playing
        ? "Pause replay"
        : "Play replay";

    this.#playButton.setAttribute(
      "aria-label",
      this.#playing
        ? "Pause replay"
        : "Play replay"
    );

    this.#playButton.setAttribute(
      "aria-pressed",
      String(this.#playing)
    );
  }

  setSpeed(speed) {
    const speeds = this.#options.speeds;

    if (!speeds.includes(speed)) return false;

    this.#speed = speed;
    this.#speedButton.textContent = `${speed}×`;

    this.#speedButton.setAttribute(
      "aria-label",
      `Playback speed: ${speed} times`
    );

    return true;
  }

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);

    this.#element.classList.toggle(
      "replay-bar--disabled",
      !this.#enabled
    );

    for (
      const button of
      this.#element.querySelectorAll("button")
    ) {
      button.disabled = !this.#enabled;
    }
  }

  reset() {
    this.#currentTick = 0;
    this.setPlaying(false);
    this.setSpeed(this.#options.speeds[0] ?? 1);
    this.#update();
  }

  destroy() {
    this.#element.remove();
  }

  get currentTick() {
    return this.#currentTick;
  }

  get speed() {
    return this.#speed;
  }

  get playing() {
    return this.#playing;
  }

  #cycleSpeed() {
    const speeds = this.#options.speeds;
    if (speeds.length === 0) return;

    const currentIndex = speeds.indexOf(this.#speed);

    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + 1) % speeds.length;

    const nextSpeed = speeds[nextIndex];

    const result =
      this.#options.onSpeedChange?.(nextSpeed);

    if (result === false) return;

    this.setSpeed(
      typeof result === "number"
        ? result
        : nextSpeed
    );
  }

  #renderMarkers() {
    this.#markers.replaceChildren();

    const totalTicks = this.#timeline.totalTicks;

    for (const marker of this.#timeline.markers) {
      const markerButton =
        this.#createMarker(marker, totalTicks);

      this.#markers.append(markerButton);
    }

    this.#updateMarkerStates();
  }

  #createMarker(marker, totalTicks) {
    const button = document.createElement("button");

    const isLarge =
      marker.type === "level" ||
      marker.type === "finish";

    const position =
      totalTicks > 0
        ? marker.tick / totalTicks * 100
        : 0;

    button.type = "button";
    button.className = [
      "replay-bar__marker",
      isLarge
        ? "replay-bar__marker--large"
        : "replay-bar__marker--small",
      marker.type === "finish"
        ? "replay-bar__marker--finish"
        : ""
    ]
      .filter(Boolean)
      .join(" ");

    button.style.left = `${position}%`;
    button.dataset.tick = marker.tick;
    button.dataset.type = marker.type;

    if (marker.index !== null) {
      button.dataset.index = marker.index;
    }

    if (marker.type === "finish") {
      button.title = "End of game";
      button.textContent = "■";
      button.setAttribute(
        "aria-label",
        "Jump to end of game"
      );
      
      button.addEventListener("click", () => {
        this.#onSelectMarker(marker);
      });
    } else {
      const description =
        `Level ${marker.level}, Maze ${marker.maze}`;

      button.title = description;
      if (isLarge) button.textContent = marker.level;
      button.setAttribute(
        "aria-label",
        `Jump to ${description}`
      );

      button.addEventListener("click", () => {
        this.#onSelectMarker(marker);
      });
    }

    return button;
  }

  #onSelectMarker(marker) {
    if (!(this.#enabled && marker)) return;  
    
    this.setCurrentTick(marker.tick);

    if (marker.type === "finish") {
      this.#options.onSelectEnd?.(this.#timeline.totalTicks);
    } else {
      this.#options.onSelectMaze?.(
        marker.index,
        marker
      );
    }
  }

  #update() {
    this.#updateProgress();
    this.#updateMarkerStates();
    this.setPlaying(this.#playing);
    this.setSpeed(this.#speed);
  }

  #updateProgress() {
    const totalTicks = this.#timeline.totalTicks;

    const percentage =
      totalTicks > 0
        ? this.#currentTick / totalTicks * 100
        : 0;

    this.#progress.style.width = `${percentage}%`;

    this.#track.setAttribute(
      "aria-valuemin",
      "0"
    );

    this.#track.setAttribute(
      "aria-valuemax",
      String(totalTicks)
    );

    this.#track.setAttribute(
      "aria-valuenow",
      String(this.#currentTick)
    );
  }

  #updateMarkerStates() {
    const markerButtons =
      this.#markers.querySelectorAll(
        ".replay-bar__marker"
      );

    let activeMarker = null;

    for (const button of markerButtons) {
      const tick = Number(button.dataset.tick);

      button.classList.toggle(
        "replay-bar__marker--passed",
        tick <= this.#currentTick
      );

      button.classList.remove(
        "replay-bar__marker--active"
      );

      if (tick <= this.#currentTick) {
        activeMarker = button;
      }
    }

    activeMarker?.classList.add(
      "replay-bar__marker--active"
    );

    this.#activeMarker = activeMarker?.dataset;
  }
}