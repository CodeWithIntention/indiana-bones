import { Direction, Timer } from "./util.js";
import { CHARACTERS, OBJECTS } from "./config.js";
import { GameRecorder } from "./recorder.js";
import { Keyboard } from "./keyboard.js";

export class GameController {
  constructor(gameRules) {
    this.gameRules = gameRules;
    this.playbackSpeed = 1;
    this.playbackPaused = false;
  }

  get game() {
    return this.gameRules.game;
  }

  get gameModel() {
    return this.game.model;
  }

  get player() {
    return this.gameModel.player;
  }

  get grid() {
    return this.gameModel.grid;
  }

  get characters() {
    return this.gameModel.characters;
  }

  movePlayer(direction, delta) {
    if (this.player.isBuried || this.player.exitMaze) return;

    // This is where gameModel.player is at
    const currentRow = this.player.row;
    const currentCol = this.player.col;

    // This is where gameModel.player is going
    const nextRow = currentRow + direction[0];
    const nextCol = currentCol + direction[1];

    // Special case for initial gameModel.player movement
    if (
      Direction.isNone(this.player.direction) &&
      currentRow === 1 &&
      currentCol === 0 &&
      this.grid.canCharacterMoveTo(this.player, nextRow, nextCol)
    ) {
      this.player.row = nextRow;
      this.player.col = nextCol;
      this.grid.placeCharacter(this.player);
      this.player.onMoved(this.grid.objectAt(this.player));
    } else {
      // If gameModel.player is trapped, then end the game.
      const playerTrapped =
        this.grid.objectAt(currentRow, currentCol) === OBJECTS.wall;

      if (playerTrapped) {
        this.gameRules.playerKilled(true);
        this.game.update(this.player);
      } else if (this.player.isAlive) {
        this.grid.moveCharacter(
          this.player,
          direction,
          delta,
          nextRow,
          nextCol,
        );
      }
    }
  }

  moveCharacters(delta) {
    this.characters.forEach((character) =>
      this.moveCharacter(character, delta),
    );
  }

  moveCharacter(character, delta) {
    if (
      character.disabled === true ||
      this.grid.isCharacterEnroute(character, delta)
    ) {
      if (this.grid.haveCollided(this.player, character)) {
        this.player.onCollided(character);
      }
      return;
    }

    function getDirections(direction) {
      // The default is to pick a random direction
      const directions = [...Direction.ALL];
      Direction.shuffle(directions, this.gameModel.random);
      const dirs = [Direction.NONE, ...directions];

      // If the character is already moving in a direction, then favor
      // that before the randomized ones.
      if (Direction.isGood(direction)) {
        const canSeePlayer = this.grid.canCharacterSeeTheOther(
          character,
          this.player,
        );

        // When the character can see the gameModel.player, don't favor the same
        // direction if its a prey or the gameModel.player is powered up.
        if (
          this.player.powerUp
            ? false
            : !(canSeePlayer && character.priority < 1)
        ) {
          dirs.push(direction);
        }

        // Don't introduce a random turn if a hunter sees the gameModel.player
        if (!(character.priority >= this.player.priority && canSeePlayer)) {
          // Add a random turn before the perferred direction.
          const turns = Direction.turnsFor(direction);
          const randomTurnIndex = Math.floor(this.gameModel.random() * 10);
          if (randomTurnIndex < 5) {
            dirs.push(turns[randomTurnIndex % turns.length]);
          }
        }

        // Hunt down the gameModel.player by favoring the gameModel.player's location.
        // The vision distance is random up to on the gameModel.player's level.
        if (
          character.canKill(this.player) &&
          this.player.isAlive &&
          this.gameModel.random() *
            (this.gameModel.settings.oddsOfBeingHunted +
              this.characters.killers(this.player).length) <
            1
        ) {
          const huntDistance =
            this.gameModel.random() *
              character.manhattanDistanceTo(this.player) +
            this.gameModel.random() * this.player.level;
          if (huntDistance < this.player.level) {
            const huntUD =
              this.player.row < character.row ? Direction.UP : Direction.DOWN;
            const huntLR =
              this.player.col < character.col
                ? Direction.LEFT
                : Direction.RIGHT;
            const huntDir =
              Math.abs(character.row - this.player.row) >
              Math.abs(character.col - this.player.col)
                ? huntUD
                : huntLR;

            if (huntDir !== direction) {
              dirs.push(huntDir);
            }
          }
        }
      }
      return dirs;
    }

    const dirs = getDirections.call(this, character.direction);
    let direction = Direction.NONE;

    while (dirs.length > 0) {
      direction = dirs.pop();

      if (
        Direction.isGood(direction) &&
        character.allowedDirections.includes(direction)
      ) {
        const nextRow = character.row + direction[0];
        const nextCol = character.col + direction[1];

        if (this.grid.canCharacterMoveTo(character, nextRow, nextCol)) {
          this.grid.moveCharacter(
            character,
            direction,
            delta,
            nextRow,
            nextCol,
          );
          break;
        }
      }
    }

    // Guard against a character already removed from the maze by now.
    if (!this.characters.contains(character)) return;

    if (this.grid.haveCollided(this.player, character)) {
      this.player.onCollided(character);
    }

    this.characters.killables(character).forEach((other) => {
      if (
        character.canKill(other) &&
        this.grid.haveCollided(character, other)
      ) {
        character.onCollided(other);
      }
    });

    if (
      character.kind === CHARACTERS.rock.kind &&
      Direction.isNone(direction)
    ) {
      character.remove();

      // When a rock stops moving, it can become a wall if position is
      // not occupied by a fixed object. Otherwise try the row above.
      let object = this.grid.objectAt(character.row, character.col);
      let row = character.row;

      if (!object || object.fixed === true) {
        object = this.grid.objectAt(--row, character.col);
      }
      if (object && object.fixed !== true) {
        this.grid.placeObjectAt(row, character.col, OBJECTS.wall, {
          rock: true,
        });
        this.game.view.update();
      }
    }
  }

  play() {
    const sequence = this.gameModel.sequence;
    const self = this;
    const game = this.game;

    let lastTicks = game.model.ticks;
    let lastTime = performance.now();
    let timeSlice = 0;

    function gameSpeed() {
      return GameRecorder.isReplaying ? self.playbackSpeed : 1;
    }

    function gameLoop(time) {
      function canContinue() {
        return (
          sequence === game.model.sequence &&
          lastTicks <= game.model.ticks &&
          self.playbackPaused !== true &&
          !(
            game.model.isGameOver ||
            game.model.player.isBuried ||
            game.model.player.exitMaze
          )
        );
      }

      if (!canContinue()) return;

      lastTicks = game.model.ticks;

      if (Keyboard.NextMaze) {
        Keyboard.NextMaze = false;
        game.endMaze();
        game.nextMaze();
        return;
      }

      timeSlice +=
        Math.min(game.model.settings.maxTimeSlice, time - lastTime) * gameSpeed();
      lastTime = time;

      const stepInterval =
        Timer.stepInterval || game.model.settings.gameStepInterval;
      while (timeSlice >= stepInterval && canContinue()) {
        timeSlice -= stepInterval;
        const delta = stepInterval / 1000;
        self.playGameStep(delta);
      }

      if (canContinue()) {
        game.view.gameWindow.requestAnimationFrame(gameLoop);
      } else if (game.model.player.exitMaze) {
        game.playerExitMaze();
      }
    }
    game.view.gameWindow.requestAnimationFrame(gameLoop);
  }

  playGameStep(delta) {
    Timer.update(this.gameModel.ticks);

    this.moveCharacters(delta);
    this.updateInputMask();

    const inputMask = this.handleInput();
    const moveDirection =
      Keyboard.getDirection() || this.player.direction || Direction.NONE;

    this.movePlayer(moveDirection, delta);

    GameRecorder.recordGameStep(this.gameModel.ticks, inputMask);
    this.game.view.gameScreen.replayBar.setCurrentTick(this.gameModel.ticks);
    this.gameModel.ticks++;
  }

  updateInputMask() {
    if (GameRecorder.isReplaying) {
      const inputMask = GameRecorder.replayInputMask(this.gameModel.ticks);
      Keyboard.applyMask(inputMask);
    }
  }

  handleInput() {
    const inputMask = Keyboard.getMask();

    if (Keyboard.Space) {
      if (this.player.isAlive) {
        this.gameRules.playerTNT(this.player);
      } else {
        this.gameRules.playerRespawn();
      }
      // Don't let it repeat
      Keyboard.Space = false;
    }
    return inputMask;
  }
}
