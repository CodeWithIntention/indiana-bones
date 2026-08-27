const PLAYBACK_SPEEDS = [1, 2, 3];

export const GameRecorder = {
  recording: null,
  mazeRecording: null,
  gameSteps: [],

  isReplaying: false,
  playbackSpeed: 1,

  replayMazeIndex: -1,
  replayStepIndex: 0,
  replayStep: null,

  startGame(version, seed, msPerTick) {
    this.resetReplay();

    this.recording = {
      version,
      seed,
      msPerTick,
      ticks: 0,
      currentLevel: 0,
      currentMaze: 0,
      playerState: null,
      outcome: null,
      mazeRecordings: []
    };

    this.mazeRecording = null;
    this.gameSteps = [];
  },

  startMaze({
    level,
    maze,
    tick,
    randomizerState,
    playerState
  }) {
    if (this.isReplaying) return;

    this.gameSteps = [];

    this.mazeRecording = {
      level,
      maze,
      startTick: tick,
      endTick: null,
      randomizerState,
      playerState,
      outcome: null,
      gameSteps: []
    };
  },

  recordGameStep(tick, inputMask) {
    if (this.isReplaying || !this.mazeRecording) {
      return;
    }

    const previousMask = this.gameSteps.at(-1)?.[1];

    if (
      this.gameSteps.length === 0 ||
      previousMask !== inputMask
    ) {
      this.gameSteps.push([tick, inputMask]);
    }
  },

  addRecord({
    tick,
    currentLevel,
    currentMaze,
    levelRelic,
    playerState,
    outcome,
  }) {
    if (this.isReplaying) return;

    if (this.recording) {
        this.recording.ticks = tick;
        this.recording.currentLevel = currentLevel;
        this.recording.currentMaze = currentMaze;
        this.recording.levelRelic = levelRelic;
        this.recording.playerState = playerState;
        this.recording.outcome = outcome;
    }

    if (outcome !== 'finished' && this.mazeRecording) {
        this.mazeRecording.endTick = tick;
        this.mazeRecording.outcome = outcome;
        this.mazeRecording.gameSteps = this.gameSteps;

        this.recording.mazeRecordings.push(this.mazeRecording);

        this.mazeRecording = null;
        this.gameSteps = [];
    }
  },

  selectMaze(index) {
    if (index === -1) {
        index = (this.recording?.mazeRecordings.length || 0) - 1;
    }
    const mazeRecording =
      this.recording?.mazeRecordings[index];

    if (!mazeRecording) return null;

    this.isReplaying = true;
    this.replayMazeIndex = index;
    this.replayStepIndex = 0;
    this.replayStep = null;

    return mazeRecording;
  },

  selectPreviousMaze() {
    if (!this.isReplaying) {
      return this.selectMaze(0);
    }

    return this.selectMaze(
      Math.max(0, this.replayMazeIndex - 1)
    );
  },

  selectNextMaze() {
    const lastIndex =
      (this.recording?.mazeRecordings.length ?? 1) - 1;

    if (lastIndex < 0) return null;

    return this.selectMaze(
      Math.min(lastIndex, this.replayMazeIndex + 1)
    );
  },

  replayInputMask(tick) {
    if (!this.isReplaying) return 0;

    const mazeRecording = this.currentReplayMaze;
    const steps = mazeRecording?.gameSteps ?? [];

    while (
      this.replayStepIndex < steps.length &&
      steps[this.replayStepIndex][0] <= tick
    ) {
      this.replayStep =
        steps[this.replayStepIndex++];
    }

    return this.replayStep?.[1] ?? 0;
  },

  resetReplay() {
    this.isReplaying = false;
    this.playbackSpeed = 1;
    this.replayMazeIndex = -1;
    this.replayStepIndex = 0;
    this.replayStep = null;
  },

  setPlaybackSpeed(speed) {
    if (!PLAYBACK_SPEEDS.includes(speed)) {
      return this.playbackSpeed;
    }

    this.playbackSpeed = speed;
    return this.playbackSpeed;
  },

  cyclePlaybackSpeed() {
    const currentIndex =
      PLAYBACK_SPEEDS.indexOf(this.playbackSpeed);

    const nextIndex =
      (currentIndex + 1) % PLAYBACK_SPEEDS.length;

    this.playbackSpeed = PLAYBACK_SPEEDS[nextIndex];
    return this.playbackSpeed;
  },

  isCurrentMazeFinished(tick) {
    const mazeRecording = this.currentReplayMaze;

    return (
      mazeRecording !== null &&
      tick >= mazeRecording.endTick
    );
  },

  get currentReplayMaze() {
    if (!this.isReplaying) return null;

    return (
      this.recording?.mazeRecordings[
        this.replayMazeIndex
      ] ?? null
    );
  },

  get hasPreviousMaze() {
    return this.replayMazeIndex > 0;
  },

  get hasNextMaze() {
    const count =
      this.recording?.mazeRecordings.length ?? 0;

    return (
      this.replayMazeIndex >= 0 &&
      this.replayMazeIndex < count - 1
    );
  },

  get timeline() {
    const mazeRecordings =
      this.recording?.mazeRecordings ?? [];

    const totalTicks =
      this.recording?.ticks ||
      mazeRecordings.at(-1)?.endTick ||
      0;

    const timeline = {
      msPerTick: this.recording?.msPerTick,
      totalTicks,

      markers: mazeRecordings.map(
        (mazeRecording, index) => ({
          index,
          tick: mazeRecording.startTick,
          level: mazeRecording.level,
          maze: mazeRecording.maze,
          type:
            mazeRecording.maze === 1
              ? "level"
              : "maze"
        })
      )
    };
    // Append closing marker
    timeline.markers.push({index: mazeRecordings.length, tick: totalTicks, level: this.recording.currentLevel, maze: this.recording.currentMaze, type: "finish"});

    return timeline;
  }
};
