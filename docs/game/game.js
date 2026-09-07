import { Timer } from "./util.js";
import {
  GAME_VERSION,
  GAME_RNG,
  CHARACTERS,
  OBJECTS,
  MESSAGES,
  TIMEOUTS,
  RELIC_CHAMBERS,
  MAZE_DROPABLES,
} from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { Player } from "./player.js";
import { Rock, Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { Keyboard } from "./keyboard.js";
import { GameRecorder } from "./recorder.js";
import { GameModel } from "./game-model.js";
import { GameRules } from "./game-rules.js";
import { GameView } from "./game-view.js";
import { GameController } from "./game-controller.js";

function replayMaze(index = -1) {
  gameScreen.setReplayRecording(GameRecorder.timeline);
  gameController.playbackPaused = false;
  replayMazeRecording(index);
}

function goDeeper() {
  GameRecorder.resetReplay();
  gameScreen.hideScoreboard();

  if (game.playerDescend()) {
    Sound.deeper();
    gameWindow.setTimeout(game.nextMaze.bind(game), TIMEOUTS.nextMazeDelay);
  } else {
    game.nextMaze();
  }
}

function playGame() {
  gameController.playbackSpeed = gameScreen.replayBar.speed;
  gameController.play();
}

function setupCharacters() {
  Object.values(CHARACTERS).forEach(createCharacters);
  Object.values(MAZE_DROPABLES).forEach(dropItems);
}

function createCharacters(config) {
  if (!(config.class && config.qty)) return;

  let count = config.qty(gameModel.player.level);

  while (count-- > 0) {
    const position = findRandomPathCell(gameModel.randomizer, false);
    createCharacter(config, position);
  }
}

function createCharacter(config, position) {
  if (!config.class) return;

  const characterType = config.class;
  const character = new characterType(position);
  addCharacter(character);

  return character;
}

function removeCharacter(character) {
  if (gameModel.characters.remove(character)) {
    gameModel.grid.removeCharacter(character);
  }
}

function addCharacter(character) {
  if (!gameModel.characters.add(character)) {
    return false;
  }

  character.onMoved = (object) => {
    gameRules.onCharacterMoved(character, object);
  };

  character.onCollided = (other) => {
    gameRules.onCharacterCollided(character, other);
  };

  character.remove = () => {
    removeCharacter(character);
  };

  character.disable = (duration) => {
    if (duration <= 0 || character.disabled) return;

    character.disabled = true;
    const disabledTime = character.disabledTime;

    Timer.setTimeout(() => {
      if (disabledTime === character.disabledTime) {
        character.disabled = false;
        game.update(character);
      }
    }, duration);

    game.update(character);
  };

  character.addScore = (factor, points) => {
    addScoreForCharacter(character, factor, points);
  };

  gameModel.grid.addCharacter(character);
  return true;
}

function addScoreForCharacter(character, factor, points) {
  const basePoints = Number.isFinite(points) ? points : character.points;
  const score = basePoints * factor;
  
  if (Number.isFinite(score) && game.player.isAlive) {
    // Only half the value is given for chomping
    game.player.score += score;
    game.model.grid.addScoreCharacterFor(
      character,
      score,
      TIMEOUTS.characterPointsLabel,
    );
  }
}

function dropItems(config) {
  if (!config.qty) return;

  let count = config.qty(gameModel.player.level);

  if (config === OBJECTS.key) {
    gameModel.keysNeeded = count;
  }

  while (count-- > 0) {
    const position = findRandomPathCell(gameModel.randomizer, config.inWalls);
    gameModel.grid.placeObjectAt(position.row, position.col, config);
  }
}

function showRelicChamber() {
  const positions = gameModel.grid.placeObjectFormation(
    gameModel.relicChamberFormation,
    OBJECTS.wall,
    { pulse: true, rock: true },
  );

  // Where the relic is buried is randomized
  const positionIndex = Math.floor(gameModel.random() * positions.length);
  const position = positions[positionIndex];

  // The Guardian is hiding at the same location as the relic, so the
  // astute will see where the Guardian originated from and dig there.
  const guardian = createCharacter(CHARACTERS.ghost, {
    row: position.row,
    col: position.col,
  });
  const relic = createCharacter(CHARACTERS.relic, position);
  relic.setRelic(gameModel.levelRelic);
  guardian.disable(
    TIMEOUTS.guardianDelay -
      gameModel.player.level * TIMEOUTS.guardianDelayLevelReduction,
  );
}

function dropRandomRocks() {
  const positions = findRandomRockPositions(gameModel.player.level);
  if (positions.length === 0) return;

  positions.forEach((position) => {
    const rock = new Rock(position);
    addCharacter(rock);
  });
}

function findRandomRockPositions(count) {
  function canPlaceRockAt(row, col) {
    const object = gameModel.grid.objectAt(row, col);
    return (
      object &&
      object.fixed !== true &&
      object.priority <= CHARACTERS.rock.priority
    );
  }

  const positions = [];
  positions.contains = (position) => {
    positions.some(
      (item) => item.row === position.row && item.col === position.col,
    );
  };

  let tries = gameModel.random() * 10;

  // When there are enough walls in the maze, try to place rocks in the walls first.
  while (
    --tries > 0 &&
    gameModel.grid.pathCount / gameModel.grid.cellCount <
      settings.caveInThreshold
  ) {
    const position = findRandomPathCell(gameModel.random, true);
    // There must be a path cell below the wall to place a rock in the wall.
    if (
      canPlaceRockAt(position.row + 1, position.col) &&
      !positions.contains(position)
    ) {
      positions.push(position);
      break;
    }
  }

  // If no wall was found, then try to place rocks at top
  tries = gameModel.grid.cols;
  while (--tries > 0 && positions.length < count) {
    const col = Math.floor(gameModel.random() * gameModel.grid.cols);
    let row = 0;

    // Place rocks at the top if a path cell exists.
    const position = { row, col };
    if (canPlaceRockAt(row + 1, col) && !positions.contains(position)) {
      positions.push(position);
      continue;
    }

    // Otherwise place rocks at lowest possible row in the column if a path cell exists.
    while (++row < gameModel.grid.rows - 1) {
      const position = { row: row - 1, col };
      if (canPlaceRockAt(row, col) && !positions.contains(position)) {
        positions.push(position);
        break;
      }
    }
  }
  return positions;
}

function findRandomPathCell(random, inWalls = false) {
  while (true) {
    const row = Math.floor(random() * gameModel.grid.rows);
    const col = Math.floor(random() * gameModel.grid.cols);
    const obj = gameModel.grid.objectAt(row, col);

    if (
      inWalls
        ? !(obj === OBJECTS.wall || obj === OBJECTS.rock)
        : obj !== OBJECTS.path
    )
      continue;
    if (row === gameModel.player.row && col === gameModel.player.col) continue;
    if (gameModel.characters.atRowCol(row, col)) continue;

    return { row, col };
  }
}

function startGame(seed = 0) {
  if (gameModel.gameNumber && seed !== gameModel.gameNumber) {
    gameModel.gameNumber = null;
    deleteGameNumberFromURL();
  }

  settings.setDefaults();
  Timer.setStepInterval(settings.gameStepInterval);
  gameModel.startGame(seed);

  GameRecorder.startGame(
    GAME_VERSION,
    seed,
    settings.gameStepInterval,
    GAME_RNG.isValidGameNumber(gameModel.gameNumber),
  );

  gameScreen.showGameUI();
  game.nextMaze();
}

function playAgain() {
  startGame(gameModel.seed);
}

function replayGame() {
  gameScreen.showGameUI();
  replayMaze(0);
}

function replayMazeRecording(indexOrMazeRecording) {
  const mazeRecording = Number.isFinite(indexOrMazeRecording)
    ? GameRecorder.selectMaze(indexOrMazeRecording)
    : indexOrMazeRecording;
  if (!mazeRecording) return false;

  gameModel.initWithMazeRecording(mazeRecording);
  game.startMaze();

  return true;
}

gameScreen.scoreboardLinks.nextMazeLink.addEventListener("click", goDeeper);
gameScreen.scoreboardLinks.replayMazeLink.addEventListener("click", () =>
  replayMaze(-1),
);

gameScreen.startGame = (seed) =>
  gameWindow.setTimeout(startGame, TIMEOUTS.gameOverTrophyTallyInterval, seed);
gameScreen.playAgain = () =>
  gameWindow.setTimeout(playAgain, TIMEOUTS.gameOverTrophyTallyInterval);
gameScreen.replayGame = () =>
  gameWindow.setTimeout(replayGame, TIMEOUTS.gameOverTrophyTallyInterval);

gameScreen.replayBarHandler = {
  onSelectMaze(index) {
    replayMazeRecording(index);
  },

  onSelectEnd() {
    const recording = GameRecorder.recording;
    if (!recording) return;

    gameModel.initWithRecording(recording);
    GameRecorder.selectMaze(-1);

    if (recording.outcome === "finished") {
      game.playerGameOver();
    } else {
      game.playerExitMaze();
    }
  },

  onPlayPause(playing) {
    if (gameController.playbackPaused === !playing) return false;

    gameController.playbackPaused = !playing;
    if (playing) {
      gameController.play();
    }
    return playing;
  },

  onStop() {
    this.onPlayPause(false);
    this.onSelectMaze(0);
  },

  onSpeedChange(speed) {
    gameController.playbackSpeed = speed;
    return speed;
  },
};

const GAME_NUMBER_PARAM = "game";

function deleteGameNumberFromURL() {
  const url = new URL(gameWindow.location.href);
  const value = url.searchParams.get(GAME_NUMBER_PARAM);

  if (value) {
    url.searchParams.delete(GAME_NUMBER_PARAM);
    gameWindow.history.replaceState(null, "", url);
  }
}

function getGameNumberFromURL() {
  const params = new URLSearchParams(gameWindow.location.search);
  const value = params.get(GAME_NUMBER_PARAM);

  // Game numbers must be positive whole numbers.
  const gameNumber = Number(value);

  if (!GAME_RNG.isValidGameNumber(gameNumber)) {
    deleteGameNumberFromURL();
    return null;
  }
  return gameNumber;
}

function initGame(gameNumber) {
  if (!GAME_RNG.isValidGameNumber(gameNumber)) {
    gameScreen.newGame();
    return;
  }

  const savedGame =
    GameRecorder.load(GAME_VERSION, gameNumber, "checkpoint") ||
    GameRecorder.load(GAME_VERSION, gameNumber, "finished");

  gameModel.gameNumber = gameNumber;
  GameRecorder.autoSave = true;

  if (savedGame) {
    Timer.setStepInterval(savedGame.msPerTick);

    gameScreen.replayBarHandler.onSelectEnd();
    gameScreen.showGameMessage(MESSAGES.loading);

    gameWindow.setTimeout(() => {
      gameScreen.hideGameMessage();
      gameScreen.showGameUI(true);
    }, TIMEOUTS.loadingMessageDelay);
  } else {
    gameScreen.showGameUI(true);
    gameScreen.showGameInfo(MESSAGES.gameInfoTitle + gameNumber);

    gameScreen.gameInfoContent.gameNumber = gameNumber;
    gameScreen.gameInfoContent.textContent = MESSAGES.gameNotYetPlayed;
    gameScreen.gameInfoLinks.replayGameLink.hidden = true;
    gameScreen.gameInfoLinks.newGameLink.hidden = true;
    gameScreen.gameInfoLinks.playAgainLink.textContent = MESSAGES.playGame;
  }
}

class Game {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.player.addScore = (factor, points) => {
      addScoreForCharacter(this.player, factor, points);
    }
  }

  get player() {
    return this.model.player;
  }

  updateHighScore() {
    const highScore = Math.max(this.model.highScore, this.model.player.score);
    this.model.highScore = highScore;
  }

  saveHighScore() {
    this.updateHighScore();
    localStorage.setItem("indiana-bones-high-score", String(this.model.highScore));
  }

  getHighScore() {
    return Number(localStorage.getItem("indiana-bones-high-score")) || 0;
  }

  startCaveIn() {
    if (this.model.caveInStarted) return;

    this.model.caveInStarted = true;
    Grid.mazeEl.classList.toggle("rumble", true);

    const caveInInterval = Timer.setInterval(() => {
      if (
        !this.model.caveInStarted ||
        this.player.exitMaze ||
        this.model.isGameOver
      ) {
        this.model.caveInStarted = false;
        Grid.mazeEl.classList.toggle("rumble", false);
        Timer.clear(caveInInterval);
        return;
      }
      dropRandomRocks();
    }, TIMEOUTS.caveInInterval);
  }

  playerDescend() {
    if (!(this.model.grid && this.player.isAlive)) return false;

    this.player.row = this.model.grid.rows - 1;
    this.player.col = this.model.grid.cols - 1;

    this.model.grid.setCharacterAttributes(this.player, {
      down: true,
      flatten: true,
    });
    this.model.grid.placeCharacter(this.player);

    return true;
  }

  playerExitMaze() {
    // Set score to when player exited the maze so tallyScore
    // can add to it to get to the final maze score.
    this.player.score = this.player.exitMazeScore;

    Sound.yeah();
    this.view.update();

    if (!GameRecorder.hasNextMaze) this.view.gameScreen.hideReplayBar();
    this.view.gameWindow.setTimeout(
      this.tallyScore.bind(this),
      TIMEOUTS.tallyScoreDelay,
    );
  }

  playerGameOver() {
    Sound.gameover();
    this.model.gameOver();
    this.view.gameScreen.showInstructions(false);

    const gameOver = () => {
      const isGameNumber = Number.isFinite(this.model.gameNumber);
      const title = isGameNumber
        ? MESSAGES.gameInfoTitle + this.model.gameNumber
        : MESSAGES.gameOverTitle;

      this.view.gameScreen.showGameInfo(title);
      this.view.gameScreen.gameInfoContent.innerHTML =
        this.getPlayerAcheivements();

      this.tallyTrophyBonus();
    }
    this.view.gameWindow.setTimeout(gameOver, TIMEOUTS.gameOverDelay);
  }

  update(reason) {
    const attributes = {
      entrance: false,
      spin: false,
      powerup: false,
      dead: false,
      buried: false,
      webbed: false,
      pooped: false,
      shake: false,
    };

    if (reason.speedReductionReason) {
      attributes[reason.speedReductionReason] = reason.isReducedSpeed;
    }
    if (reason.disabled === true) {
      attributes.shake = true;
    }

    if (reason instanceof Player) {
      this.updateHighScore();

      if (reason.isAlive) {
        attributes.powerup = reason.powerUp;

        if (this.model.grid.objectAt(reason) === OBJECTS.exit) {
          this.model.exitMaze();
          attributes.spin = this.player.exitMaze;
        } else if (this.model.grid.isCharacterAtEntrance(reason)) {
          attributes.entrance = true;
        } else if (this.model.keysNeeded === 0) {
          --this.model.keysNeeded;
          Sound.portal();

          if (this.model.isLastMaze) {
            Timer.setTimeout(showRelicChamber, TIMEOUTS.caveInInterval);
          } else {
            this.model.grid.ensureExit();
          }
        }
      } else if (reason.canRespawn) {
        attributes.dead = true;
      } else {
        attributes.buried = true;
      }
      if (this.model.isCaveInThreshold) {
        game.startCaveIn();
      }
    }
    this.model.grid.setCharacterAttributes(reason, attributes);
    this.view.update();
  }

  getPlayerAcheivements() {
    const list = [];

    if (this.player.level <= 1) {
      list.push(
        `<div class='label'>${MESSAGES.relicsFound}</div><div>${MESSAGES.none}</div>`,
      );
    } else {
      list.push(`<div class='label'>${MESSAGES.relicsFound}</div>`);

      let relics = [];
      for (let i = 1; i < this.player.level; i++) {
        const relicKind = Relic.kindForLevel(i);
        const parts = Relic.parse(Grid.symbolFor(relicKind));
        relics.push(
          `<div><div class='icon'>${parts[0]}</div><div>${parts[1]}</div></div>`,
        );

        if (relics.length === 5) {
          list.push(`<div>${relics.join("")}</div>`);
          relics = [];
        }
      }
      if (relics.length > 0) {
        list.push(`<div>${relics.join("")}</div>`);
      }
    }

    if (this.player.trophiesAwarded <= 0) {
      list.push(
        `<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div><div>${MESSAGES.none}</div>`,
      );
    }
    return list.join("");
  }

  tallyScore() {
    const list = [];
    const scores = [];

    const tally = (kind, object, multipler) => {
      if (object.points > 0) {
        const points = object.points * multipler;

        scores.push(points);
        list.push(
          `<div>${Grid.symbolFor(kind)} &times; ${multipler} &times; ${object.points}</div><div class='score'>${points}</div>`,
        );
      }
    };

    Object.values(OBJECTS).forEach((object) => {
      const items = this.player.findInBag(object);

      if (items.length > 0) {
        tally(object.kind, object, items.length);
      }
    });

    Object.values(CHARACTERS).forEach((object) => {
      const items = this.player.findInBag(object);

      if (items.length > 0) {
        tally(object.kind, object, items.length);
      }
    });

    const mazeBonusPoints =
      this.player.mazeBonus * this.model.settings.pointsPerPath;
    if (mazeBonusPoints !== 0) {
      scores.push(mazeBonusPoints);
      list.push(
        `<div>${Grid.symbolFor("maze-bonus")} &times; ${this.player.mazeBonus} &times; ${this.model.settings.pointsPerPath}</div><div class='score'>${mazeBonusPoints}</div>`,
      );
    }

    if (this.player.isMazeCleared) {
      const points =
        this.model.settings.mazeClearedBonusPoints * this.player.level;
      scores.push(points);
      list.push(
        `<div>${MESSAGES.mazeClearedMessage} ${this.player.level} &times; ${this.model.settings.mazeClearedBonusPoints}</div><div class='score'>${points}</div>`,
      );
    } else {
      list.push(
        `<div>${MESSAGES.mazeNotClearedMessage}</div><div class='score'>0</div>`,
      );
    }

    const levelRelic = this.model.levelRelic;
    if (levelRelic) {
      const score = levelRelic.points * levelRelic.level;

      scores.push(score);
      list.push(
        `<div>${levelRelic.description} ${levelRelic.symbol} &times; ${levelRelic.level} &times; ${levelRelic.points}</div><div class='score'>${score}</div>`,
      );
    }

    this.view.gameScreen.showScoreboard(
      MESSAGES.levelCompleted(this.model.currentLevel, this.model.currentMaze),
    );

    let totalScore = 0;
    let scoreIndex = 0;

    const updateScore = () => {
      if (this.view.gameScreen.scoreboard.style.display === "none") {
        while (scoreIndex < scores.length) {
          totalScore += scores[scoreIndex++];
        }
        this.player.score += totalScore;
        this.endMaze();
        return;
      }

      if (scoreIndex < scores.length) {
        const score = scores[scoreIndex++];

        totalScore += score;
        this.view.gameScreen.scorecard.innerHTML = list
          .slice(0, scoreIndex)
          .join("");
        Sound.ta_ding();

        this.view.gameWindow.setTimeout(
          updateScore,
          TIMEOUTS.updateScoreCardInterval,
        );
      } else {
        if (!GameRecorder.hasNextMaze)
          this.view.gameScreen.scoreboardLinks.style.display = "flex";

        if (this.model.currentMaze === this.model.settings.mazesPerLevel) {
          this.view.gameScreen.scoreboardLinks.nextMazeLink.textContent =
            MESSAGES.nextLevelLinkText;
        } else {
          this.view.gameScreen.scoreboardLinks.nextMazeLink.textContent =
            MESSAGES.nextMazeLinkText;
        }

        if (totalScore === 0) {
          this.view.gameScreen.scorecard.innerHTML =
            "<div>You came out empty this time.</div><div class='score'>😐</div>";
          Sound.alert();
        } else {
          list.push(
            `<div style='justify-self: right'>${MESSAGES.totalPoints}</div><div class='score'>${totalScore}</div>`,
          );

          const trophiesAwarded = Math.floor(
            totalScore / this.model.settings.pointsPerTrophy,
          );
          const pointsNeeded =
            this.model.settings.pointsPerTrophy -
            (totalScore % this.model.settings.pointsPerTrophy);
          const trophySymbol = Grid.symbolFor("maze-trophy");

          if (trophiesAwarded === 0) {
            list.push(
              `<div><span class='score'>${pointsNeeded}</span> ${MESSAGES.pointNeedForTrophy}</div><div>${trophySymbol}</div>`,
            );
          } else {
            this.player.trophiesAwarded += trophiesAwarded;
            list.push(
              `<div style='justify-self: right'>${MESSAGES.trophyAwarded[trophiesAwarded > 1 ? 1 : 0]}:</div><div class='score'>${trophySymbol.repeat(trophiesAwarded)}</div>`,
            );
            list.push(
              `<div><span class='score'>${pointsNeeded}</span> ${MESSAGES.pointNeedForNextTrophy}</div><div>${trophySymbol}</div>`,
            );
          }
          this.view.gameScreen.scorecard.innerHTML = list.join("");
          this.player.score = this.player.exitMazeScore + totalScore;
          Sound.ding();

          this.view.update();

          if (GameRecorder.hasNextMaze) {
            this.view.gameWindow.setTimeout(() => {
              this.endMaze(Keyboard.Special);
              replayMazeRecording(GameRecorder.selectNextMaze());
            }, TIMEOUTS.nextMazeReplayDelay);
          } else {
            this.endMaze();
          }
        }
      }
    };
    updateScore();
  }

  tallyTrophyBonus() {
    const updateFinalScore = () => {
      this.player.score =
        this.player.exitMazeScore +
        this.model.settings.pointsPerTrophy * this.player.trophiesAwarded;

      this.view.update();
      this.view.gameScreen.gameInfoContent.innerHTML += `<div>&nbsp;</div><div class='label'>${MESSAGES.finalScore}</div><div class="banner shadowGlow pulse">${this.player.score}</div>`;

      this.saveHighScore();

      const record = this.model.createTagRecord("finished");
      GameRecorder.tagRecording(record);
    }

    if (this.player.trophiesAwarded <= 0) {
      updateFinalScore();
      return;
    }

    const trophySymbol = Grid.symbolFor("maze-trophy");
    const gameOverAchievementsHtml = this.view.gameScreen.gameInfoContent.innerHTML;
    let trophies = 0;

    const nextTrophy = () => {
      if (this.view.gameScreen.gameInfoPanel.style.display === "none") {
        // Game over screen was dismissed
        updateFinalScore();
        return;
      }

      if (trophies === this.player.trophiesAwarded) {
        // Display final score awarded
        Sound.dingDing();
        updateFinalScore();
      } else {
        const list = [
          gameOverAchievementsHtml,
          `<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div>`,
        ];

        // Tally each trophy
        const bonusPoints = this.model.settings.pointsPerTrophy * ++trophies;
        for (let i = Math.floor(trophies / 10); i > 0; i--) {
          // Break up into rows of 10 trophies for display
          list.push(`<div class='icon'>${trophySymbol.repeat(10)}</div>`);
        }

        // Remaining trophies for display
        const remainingTrophies = trophies % 10;
        if (remainingTrophies > 0) {
          list.push(
            `<div class='icon'>${trophySymbol.repeat(remainingTrophies)}</div>`,
          );
        }

        // Bonus points for tallied trophies
        list.push(`<div class='score'>${bonusPoints}</div>`);

        Sound.ding();
        this.view.gameScreen.gameInfoContent.innerHTML = list.join("");
        this.view.gameWindow.setTimeout(
          nextTrophy,
          TIMEOUTS.gameOverTrophyTallyInterval,
        );
      }
    }
    nextTrophy();
  }

  nextMaze() {
    this.view.gameScreen.hideReplayBar();

    this.model.reset();
    this.model.currentLevel =
      Math.floor(this.player.mazes / this.model.settings.mazesPerLevel) +
      1;
    this.model.currentMaze =
      (this.player.mazes % this.model.settings.mazesPerLevel) + 1;

    this.player.mazes++;

    this.view.gameScreen.showInstructions(this.player.mazes === 1);
    this.startMaze();
  }

  endMaze(saveCheckpoint = false) {
    this.updateHighScore();

    const record = this.model.createTagRecord("checkpoint");

    if (saveCheckpoint) {
      GameRecorder.saveRecording(record);
    } else {
      GameRecorder.tagRecording(record);
    }
  }

  startMaze() {
    this.view.gameScreen.hideScoreboard();
    this.view.gameScreen.hideGameInfo();

    const levelDelta = 2 * (this.model.currentLevel - 1);
    let rows = Math.min(
      this.model.settings.rows + levelDelta,
      this.model.settings.maxRows,
    );
    let cols = Math.min(
      this.model.settings.cols + levelDelta,
      this.model.settings.maxCols,
    );

    if (this.model.currentMaze === 1) {
      this.player.level = this.model.currentLevel;
      Sound.level();
    } else {
      if (this.model.currentMaze & 1) {
        cols = Math.min(cols + 2, this.model.settings.maxCols);
      } else {
        rows = Math.min(rows + 2, this.model.settings.maxRows);
      }
      Sound.maze();
    }

    Timer.clear();
    Keyboard.clear();

    const record = this.model.startMaze(rows, cols);
    GameRecorder.startMaze(record);

    this.view.gameScreen.replayBar.setCurrentTick(this.model.ticks);

    if (this.model.isLastMaze) {
      this.model.relicChamberFormation =
        RELIC_CHAMBERS[
          Math.min(this.player.level - 1, RELIC_CHAMBERS.length - 1)
        ];
      this.model.grid.placeObjectFormation(
        this.model.relicChamberFormation,
        OBJECTS.edge,
        {},
      );
    }

    setupCharacters();

    if (this.model.isLastMaze) {
      this.model.grid.placeObjectFormation(
        this.model.relicChamberFormation,
        OBJECTS.rock,
        {},
      );
    }

    this.model.actors.forEach((character) => {
      // Negative speed is not sped up.
      if (character.speed > 0) {
        character.speed +=
          this.model.currentLevel *
          this.model.settings.speedUpRatePerLevel *
          character.speed;
      }
    });

    this.view.gameWindow.focus();
    this.view.render();
    this.update(this.player);
    playGame();
  }
}

// Configure object dependencies
const gameModel = new GameModel(settings);
const gameView = new GameView(gameModel, gameWindow, gameScreen);
const game = new Game(gameModel, gameView);
const gameRules = new GameRules(game);
const gameController = new GameController(gameRules);

gameModel.highScore = game.getHighScore();

// Select the initial screen from the URL.
(() => {
  const gameNumber = getGameNumberFromURL();

  if (gameNumber === null) {
    gameScreen.showBio();
  } else {
    initGame(gameNumber);
  }
})();
