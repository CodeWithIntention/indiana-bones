import { RNG } from "./util.js";
import { Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { Characters } from "./characters.js";
import { Player } from "./player.js";
import { GAME_RNG, CHARACTERS} from "./config.js";

export class GameModel {
  #gameNumber = null;

  constructor(settings) {
    this.settings = settings;
    this.randomizer = null;
    this.player = new Player(CHARACTERS.player, settings);
    this.characters = new Characters();

    this.reset();
  }

  reset() {
    this.grid?.destroy();
    this.characters.removeAll();

    this.isGameOver = false; 
    this.caveInStarted = false;
    this.keysNeeded = 0;
    this.currentLevel = 0;
    this.currentMaze = 0;
    this.relicChamberFormation = null;
    this.playbackSpeed = 1;
    this.levelRelicFound = false;
    this.random = null;
    this.grid = null;
  }

  get isLastMaze() {
    return this.currentMaze === this.settings.mazesPerLevel;
  }

  get isCaveInThreshold() { 
    const pathCount = this.caveInStarted ? this.grid.pathCount + this.random() * 10 : this.grid.pathCount;
    return pathCount / this.grid.cellCount > this.settings.caveInThreshold;
  }

  get levelRelic() {
    if (!this.isLastMaze) return null;

    const relicKind = Relic.kindForLevel(this.currentLevel);
    const relicSymbolDescription = Relic.parse(Grid.symbolFor(relicKind));

    return {kind: relicKind, level: this.currentLevel, points: CHARACTERS.relic.points, symbol: relicSymbolDescription[0], description: relicSymbolDescription[1]};
  }

  get sequence() {
    return this.currentLevel * 100 + this.currentMaze;
  }

  get gameNumber() {
    return this.#gameNumber;
  }

  set gameNumber(value) {
    this.#gameNumber = value;

    if (GAME_RNG.isValidGameNumber(value)) {
      this.#gameNumber = value;
      this.seed = value;
    } else {
      this.#gameNumber = null;
    }
  }

  get actors() {
    return [this.player, ...this.characters.all()];
  }

  startGame(seed) {
    this.reset();

    this.seed = seed;
    this.randomizer = RNG.randomizer(seed);
    this.ticks = 0;
  }

  gameOver() {
    this.isGameOver = true;
  }

  startMaze(rows, cols) {
    this.player.restart();

    const record = {
      level: this.currentLevel,
      maze: this.currentMaze,
      tick: this.ticks,
      randomizerState: this.randomizer.getState(),
      playerState: this.player.state
    };

    this.random = RNG.randomizer(
      RNG.deriveSeed(this.randomizer.getState())
    );

    this.grid = new Grid(rows, cols, this.settings.cellSize, {grid: this.randomizer, game: this.random});
    this.grid.addCharacter(this.player);

    return record;
  }
  
  exitMaze() {
    if (this.player.exitMaze) return;
    
    this.player.exitMaze = true;
    this.player.isMazeCleared = this.grid.isMazeCleared && this.characters.killables(this.player).length === 0;
    this.player.mazeBonus = this.grid.mazeBonus;
  }
    
  createTagRecord(outcome) {
    const record = {
      tick: this.ticks,
      currentLevel: this.currentLevel,
      currentMaze: this.currentMaze,
      randomizerState: this.randomizer.getState(),
      playerState: this.player.state,
      outcome: outcome
    };

    return record;
  }

  initWithRecording(recording) {
    this.reset();

    this.seed = recording.seed;
    this.currentLevel = recording.currentLevel;
    this.currentMaze = recording.currentMaze;
    this.ticks = recording.ticks;
    this.randomizer = RNG.randomizer(recording.randomizerState);

    this.player.state = recording.playerState;
  }

  initWithMazeRecording(mazeRecording) {
    this.reset();

    this.currentLevel = mazeRecording.level;
    this.currentMaze = mazeRecording.maze;
    this.ticks = mazeRecording.startTick;
    this.randomizer = RNG.randomizer(mazeRecording.randomizerState);

    this.player.state = mazeRecording.playerState;
  }
}
