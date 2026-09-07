import {
  GAME_VERSION,
  GAME_RNG,
  CHARACTERS,
  OBJECTS,
  MESSAGES,
  TIMEOUTS,
  RELIC_CHAMBERS,
  MAZE_DROPABLES
} from "./config.js";
import { Timer } from "./util.js";
import { Relic } from "./characters.js";
import { Player } from "./player.js";
import { Grid } from "./grid.js";
import { Keyboard } from "./keyboard.js";
import { Sound } from "./sound.js";
import { GameRecorder } from "./recorder.js";

export class Game {
  constructor(model, view, { playGame, createCharacter }) {
    this.model = model;
    this.view = view;

    this.playGame = playGame;
    this.createCharacter = createCharacter;

    this.player.addScore = (factor, points) => {
      this.addScoreForCharacter(this.player, factor, points);
    };

    this.model.highScore = this.getHighScore();
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
    localStorage.setItem(
      "indiana-bones-high-score",
      String(this.model.highScore),
    );
  }

  getHighScore() {
    return Number(localStorage.getItem("indiana-bones-high-score")) || 0;
  }

  load(gameNumber) {
    if (!GAME_RNG.isValidGameNumber(gameNumber)) {
      this.view.gameScreen.newGame();
      return;
    }

    const savedGame =
      GameRecorder.load(GAME_VERSION, gameNumber, "checkpoint") ||
      GameRecorder.load(GAME_VERSION, gameNumber, "finished");

    this.model.gameNumber = gameNumber;
    GameRecorder.autoSave = true;

    if (savedGame) {
      Timer.setStepInterval(savedGame.msPerTick);

      this.replayEndOfRecording();
      this.view.gameScreen.showGameMessage(MESSAGES.loading);
      
      this.view.gameWindow.setTimeout(() => {
        this.view.gameScreen.hideGameMessage();
        this.view.gameScreen.showGameUI(true);
      }, TIMEOUTS.loadingMessageDelay);
    } else {
      this.view.gameScreen.showGameUI(true);
      this.view.gameScreen.showGameInfo(MESSAGES.gameInfoTitle + gameNumber);

      this.view.gameScreen.gameInfoContent.gameNumber = gameNumber;
      this.view.gameScreen.gameInfoContent.textContent =
        MESSAGES.gameNotYetPlayed;
      this.view.gameScreen.gameInfoLinks.replayGameLink.hidden = true;
      this.view.gameScreen.gameInfoLinks.newGameLink.hidden = true;
      this.view.gameScreen.gameInfoLinks.playAgainLink.textContent =
        MESSAGES.playGame;
    }
  }

  start(seed) {
    this.model.settings.setDefaults();

    Timer.setStepInterval(this.model.settings.gameStepInterval);

    this.model.startGame(seed);
    this.view.gameScreen.showGameUI();

    GameRecorder.startGame(
      GAME_VERSION,
      seed,
      this.model.settings.gameStepInterval,
      GAME_RNG.isValidGameNumber(this.model.gameNumber),
    );

    this.nextMaze();
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
      this.dropRandomRocks();
    }, TIMEOUTS.caveInInterval);
  }

  playerDescend() {
    GameRecorder.resetReplay();

    if (!(this.model.grid && this.player.isAlive)) {
      this.nextMaze();
      return false;
    }

    Sound.deeper();
    this.view.gameWindow.setTimeout(
      this.nextMaze.bind(this),
      TIMEOUTS.nextMazeDelay,
    );

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
    };
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
            Timer.setTimeout(
              this.showRelicChamber.bind(this),
              TIMEOUTS.caveInInterval,
            );
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
        this.startCaveIn();
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
              this.replayMazeRecording(GameRecorder.selectNextMaze());
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
    };

    if (this.player.trophiesAwarded <= 0) {
      updateFinalScore();
      return;
    }

    const trophySymbol = Grid.symbolFor("maze-trophy");
    const gameOverAchievementsHtml =
      this.view.gameScreen.gameInfoContent.innerHTML;
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
    };
    nextTrophy();
  }

  replayMaze(index = -1) {
    this.view.gameScreen.setReplayRecording(GameRecorder.timeline);
    this.replayMazeRecording(index);
  }

  replayMazeRecording(indexOrMazeRecording) {
    const mazeRecording = Number.isFinite(indexOrMazeRecording)
      ? GameRecorder.selectMaze(indexOrMazeRecording)
      : indexOrMazeRecording;
    if (!mazeRecording) return false;

    this.model.initWithMazeRecording(mazeRecording);
    this.startMaze();

    return true;
  }

  replayEndOfRecording() {
    const recording = GameRecorder.recording;
    if (!recording) return;

    this.model.initWithRecording(recording);
    GameRecorder.selectMaze(-1);

    if (recording.outcome === "finished") {
      this.playerGameOver();
    } else {
      this.playerExitMaze();
    }
  }

  nextMaze() {
    this.view.gameScreen.hideReplayBar();

    this.model.reset();
    this.model.currentLevel =
      Math.floor(this.player.mazes / this.model.settings.mazesPerLevel) + 1;
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

    this.setupCharacters();

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
    this.playGame();
  }

  dropRandomRocks() {
    const positions = this.findRandomRockPositions(this.player.level);
    if (positions.length === 0) return;

    positions.forEach((position) => {
      const rock = this.createCharacter(CHARACTERS.rock, position);
      this.addCharacter(rock);
    });
  }

  findRandomRockPositions(count) {
    const gameModel = this.model;

    function canPlaceRockAt(row, col) {
      const object = gameModel.grid.objectAt(row, col);
      return (
        object &&
        object.fixed !== true &&
        object.priority <= CHARACTERS.rock.priority
      );
    }

    const positions = [];
    positions.contains = (position) =>
      positions.some(
        (item) => item.row === position.row && item.col === position.col,
      );

    let tries = gameModel.random() * 10;

    // When there are enough walls in the maze, try to place rocks in the walls first.
    while (
      --tries > 0 &&
      gameModel.grid.pathCount / gameModel.grid.cellCount <
        gameModel.settings.caveInThreshold
    ) {
      const position = this.findRandomPathCell(gameModel.random, true);
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

  dropItems(config) {
    if (!config.qty) return;

    let count = config.qty(this.player.level);

    if (config === OBJECTS.key) {
      this.model.keysNeeded = count;
    }

    while (count-- > 0) {
      const position = this.findRandomPathCell(
        this.model.randomizer,
        config.inWalls,
      );
      this.model.grid.placeObjectAt(position.row, position.col, config);
    }
  }

  findRandomPathCell(random, inWalls = false) {
    while (true) {
      const row = Math.floor(random() * this.model.grid.rows);
      const col = Math.floor(random() * this.model.grid.cols);
      const obj = this.model.grid.objectAt(row, col);

      if (
        inWalls
          ? !(obj === OBJECTS.wall || obj === OBJECTS.rock)
          : obj !== OBJECTS.path
      )
        continue;

      if (row === this.player.row && col === this.player.col) continue;

      if (this.model.characters.atRowCol(row, col)) continue;

      return { row, col };
    }
  }

  setupCharacters() {
    Object.values(CHARACTERS).forEach(this.createCharacters.bind(this));
    Object.values(MAZE_DROPABLES).forEach(this.dropItems.bind(this));
  }

  createCharacters(config) {
    if (!(config.class && config.qty)) return;

    let count = config.qty(this.player.level);

    while (count-- > 0) {
      const position = this.findRandomPathCell(this.model.randomizer, false);
      const character = this.createCharacter(config, position);
      this.addCharacter(character);
    }
  }

  addCharacter(character) {
    if (!this.model.characters.add(character)) {
      return false;
    }

    character.remove = () => {
      if (this.model.characters.remove(character)) {
        this.model.grid.removeCharacter(character);
      }
    };

    character.disable = (duration) => {
      if (duration <= 0 || character.disabled) return;

      character.disabled = true;
      const disabledTime = character.disabledTime;

      Timer.setTimeout(() => {
        if (disabledTime === character.disabledTime) {
          character.disabled = false;
          this.update(character);
        }
      }, duration);

      this.update(character);
    };

    character.addScore = (factor, points) => {
      this.addScoreForCharacter(character, factor, points);
    };

    this.model.grid.addCharacter(character);
    return true;
  }

  addScoreForCharacter(character, factor, points) {
    const basePoints = Number.isFinite(points) ? points : character.points;
    const score = basePoints * factor;

    if (Number.isFinite(score) && this.player.isAlive) {
      // Only half the value is given for chomping
      this.player.score += score;
      this.model.grid.addScoreCharacterFor(
        character,
        score,
        TIMEOUTS.characterPointsLabel,
      );
    }
  }

  showRelicChamber() {
    const positions = this.model.grid.placeObjectFormation(
      this.model.relicChamberFormation,
      OBJECTS.wall,
      { pulse: true, rock: true },
    );

    // Where the relic is buried is randomized
    const positionIndex = Math.floor(this.model.random() * positions.length);
    const position = positions[positionIndex];

    // The Guardian is hiding at the same location as the relic, so the
    // astute will see where the Guardian originated from and dig there.
    const guardian = this.createCharacter(CHARACTERS.ghost, {
      row: position.row,
      col: position.col,
    });
    const relic = this.createCharacter(CHARACTERS.relic, position);

    this.addCharacter(guardian);
    this.addCharacter(relic);

    // This call needs to be done after adding the Relic character
    // so the grid can be updated with the relic symbol.
    relic.setRelic(this.model.levelRelic);

    guardian.disable(
      TIMEOUTS.guardianDelay -
        this.player.level * TIMEOUTS.guardianDelayLevelReduction,
    );
  }
}
