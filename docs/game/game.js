import { Direction, Timer } from "./util.js";
import { GAME_VERSION, GAME_RNG, CHARACTERS, OBJECTS, MESSAGES, TIMEOUTS, RELIC_CHAMBERS, MAZE_DROPABLES } from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { Character } from "./character.js";
import { Player } from "./player.js";
import { Rock, Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { Keyboard } from "./keyboard.js";
import { GameRecorder } from "./recorder.js";
import { GameModel } from "./game-model.js";

Character.prototype.onMoved = function(object) {
  if (object.priority > this.priority) {
    this.reduceSpeedBy(object);
  }
  if (this.canDrop && gameModel.grid.objectAt(this.row, this.col) === OBJECTS.path
    && gameModel.random() < this.dropProbability) {
    gameModel.grid.placeObjectAt(this.row, this.col, this.dropObject);
  }
  updateGameState(this);
};

Rock.prototype.onMoved = function(object) {
  if (object && object.fixed !== true) {
    if (object === OBJECTS.tnt) {
      playerTNT(this)
    } else if (object !== OBJECTS.path) {
      playerChomp(this, object);
    }
    gameModel.grid.placeObjectAt(this.row, this.col, OBJECTS.path, {visited: true});
  }
  Character.prototype.onMoved.call(this, object);
};

Player.prototype.onMoved = function(object) {
  if (object && object !== OBJECTS.exit) {
    if (object !== OBJECTS.path) {
      if (this.powerUp) {
          playerChomp(this, object);
      } else {
          playerGrab(object);
      }
      if (object === OBJECTS.key) {
        --gameModel.keysNeeded;
      }
    }
    gameModel.grid.placeObjectAt(this.row, this.col, OBJECTS.path, {visited: !this.powerUp});
  }
  updateGameState(this);
};

function updateGameState(reason) {
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
    if (reason.isAlive) {
      attributes.powerup = reason.powerUp;

      if (gameModel.grid.objectAt(reason) === OBJECTS.exit) {
        gameModel.exitMaze();
        attributes.spin = gameModel.player.exitMaze;
      } else if (gameModel.grid.isCharacterAtEntrance(reason)) {
        attributes.entrance = true;
      } else if (gameModel.keysNeeded === 0) {
        --gameModel.keysNeeded;
        Sound.portal();

        if (gameModel.isLastMaze) {
          Timer.setTimeout(showRelicChamber, TIMEOUTS.caveInInterval);
        } else {
          gameModel.grid.ensureExit();
        }
      }
    } else if (reason.canRespawn) {
      attributes.dead = true;
    } else {
      attributes.buried = true;
    }
    if (gameModel.isCaveInThreshold) {
      startCaveIn();
    }
  }
  gameModel.grid.setCharacterAttributes(reason, attributes);
  updateGameUI();
}

function updateGameUI() {
    let list = [];

    if (gameModel.player.bonusAwarded) {
      Sound.dingDing();
      gameModel.player.bonusAwarded = false;
    }

    const lives = Math.min(gameModel.player.isAlive ? gameModel.player.lives-1 : gameModel.player.lives, settings.maxLives);
    if (lives > 0) {
      list.push(`${Grid.symbolFor(gameModel.player.kind)}`.repeat(lives));
    }
    if (gameModel.player.tnts > 0) {
      list.push(`${Grid.symbolFor(OBJECTS.tnt.kind)}<b>${gameModel.player.tnts}</b>`);
    }
    gameScreen.playerStatusLine.innerHTML = list.join("&nbsp;");

    list = [];
    Object.entries(OBJECTS).forEach(([kind, object]) => {
      const count = gameModel.player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });
    Object.entries(CHARACTERS).forEach(([kind, object]) => {
      const count = gameModel.player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });
    
    if (gameModel.levelRelicFound) {
      list.push(`<div class='pulse'>${gameModel.levelRelic?.symbol}</div>`);
    }

    if (gameModel.player.score > settings.highScore) {
      settings.highScore = gameModel.player.score;
    }
    gameScreen.bagStatusLine.innerHTML = list.join('');

    gameScreen.scoreStatusLine.classList.toggle("minus", gameModel.player.score < 0);
    gameScreen.scoreStatusLine.textContent = `${Math.abs(gameModel.player.score)}`

    gameScreen.highScoreStatusLine.classList.toggle("minus", settings.highScore < 0);
    gameScreen.highScoreStatusLine.textContent = `${Math.abs(settings.highScore)}`;

    mazeStatusLine.innerHTML = `<b>LEVEL ${gameModel.currentLevel}.${gameModel.currentMaze}</b> 
      <span>${Grid.symbolFor("maze-bonus")}</span><b>${gameModel.player.mazeBonus || gameModel.grid?.mazeBonus || 0}</b>`;
}

function playerTNT(character) {
  if (character === gameModel.player) {
    if (gameModel.player.powerUp || !(gameModel.player.isAlive && gameModel.player.removeTNT())) return false;
  } else if (character instanceof Rock) {
    removeCharacter(character);
  } else if (character && character.isTNT && gameModel.grid.objectAt(character.row, character.col) === OBJECTS.tnt) {
    gameModel.grid.placeObjectAt(character.row, character.col, OBJECTS.path)
  } else {
    return;
  }

  Sound.tnt();
  gameModel.grid.addAnimationCharacterFor(character, {explosion: true});

  const playerRect = gameModel.grid.cellRectAtRowCol(character.row, character.col);
  const rectTopLeft = gameModel.grid.cellRectAtRowCol(character.row-1, character.col-1) || playerRect;
  const rectBottomRight = gameModel.grid.cellRectAtRowCol(character.row+1, character.col+1) || playerRect;
  const blastRect = {top: rectTopLeft.top, left: rectTopLeft.left, bottom: rectBottomRight.bottom, right: rectBottomRight.right};

  gameModel.characters.forEach((target) => {
    if ((target.priority - OBJECTS.tnt.priority) <= 2 
      && gameModel.grid.hasCharacterCollidedWithRect(target, blastRect)) {
      onCharacterBlownUp(target);
    }
  });

  Grid.ALL_DIRECTIONS.forEach((rc) => {
    const row = character.row + rc[0];
    const col = character.col + rc[1];
    const mazeObjAtRowCol = gameModel.grid.objectAt(row, col);

    if (mazeObjAtRowCol && mazeObjAtRowCol.fixed !== true) {
      if (mazeObjAtRowCol === OBJECTS.tnt) {
        gameModel.grid.updateCellAtRowCol(row, col, {strobe: true});
        Timer.setTimeout(playerTNT, TIMEOUTS.tntDetonationDelay, {isTNT: true, row, col});
      } else {
        const blast = mazeObjAtRowCol !== OBJECTS.path;
        gameModel.grid.placeObjectAt(row, col, OBJECTS.path, {flash: true, blast: blast});
      }
    }
  });

  // The Player can be hurt if TNT was set off by 
  // chain reaction or by a 3rd party, and the 
  // Player is not powered-up.
  if (gameModel.player !== character && !gameModel.player.powerUp 
    && gameModel.grid.hasCharacterCollidedWithRect(gameModel.player, blastRect)) {
    // Beware! If the gameModel.player is waiting to respawn and
    // is blown up, then its game over!
    gameModel.grid.addAnimationCharacterFor(gameModel.player, {blast: true});
    playerKilled(!gameModel.player.isAlive);
    updateGameState(gameModel.player);
  } else {
    updateGameUI();
  }
}

function disableCharacter(character, disabledDuration) {
  if (!(character instanceof Character) || disabledDuration <= 0) return;
  if (character.disabled) return;

  character.disabled = true;
  const disabledTime = character.disabledTime;

  Timer.setTimeout(() => {
    if (disabledTime === character.disabledTime) {
      character.disabled = false;
      updateGameState(character);
    }
  }, disabledDuration);
  updateGameState(character);
}

function onCharacterBlownUp(character) {
  if (character.disabled === true) return;

  gameModel.grid.addAnimationCharacterFor(character, {blast: true});

  if (character.canKill(gameModel.player)) {
    if (character.lives === 0) {
      addScoreForCharacter(character, settings.blownUpPointsFactor);
    } else {
      character.lives--;
      disableCharacter(character, settings.blowUpRecoveryDuration);
      gameModel.grid.applyAnimationFor(character, {blownup: true});
      return;
    }
  } else {
    addScoreForCharacter(character, -1);
  }
  removeCharacter(character);
}

function addScoreForCharacter(character, factor) {
  if (Number.isFinite(character.points) && gameModel.player.isAlive) {
    // Only half the value is given for chomping
    const points = character.points * factor;
    gameModel.player.score += points;
    const target = character instanceof Character ? character : gameModel.player;
    gameModel.grid.addScoreCharacterFor(target, points, TIMEOUTS.characterPointsLabel);
  }
}

function playerRespawn() {
  if (!gameModel.player.canRespawn) return false;

  gameModel.player.respawn();
  Sound.respawn();

  updateGameState(gameModel.player);
  return true;
}

function playerChomp(character, object) {
  if (object instanceof Character) {
      if (!(character instanceof Rock || object.isChompable || object.disabled)) return;

      addScoreForCharacter(object, object.canKill(gameModel.player) ? 1 : settings.chompPointsFactor);
      removeCharacter(object);

      const chompSound = object.chompSound;
      if (chompSound) {
          Sound[chompSound]();
      }
  } else if (character instanceof Player) {
    addScoreForCharacter(object, settings.chompPointsFactor);
  }
  Sound[character.chompSound || "chomp"]();
}

function playerGrab(object) {
  if (object instanceof Character && object.isGrabable) {
    if (object.isRelic) {
      Sound.portal();
      gameModel.levelRelicFound = true;
      gameModel.grid.addHtmlCharacterFor(object, `<span class='relic'>${object.description}</span>`, TIMEOUTS.relicLabelDuration);
      gameModel.grid.ensureExit(true, {row: gameModel.player.row, col: gameModel.player.col});
      Timer.setTimeout(startCaveIn, TIMEOUTS.caveInInterval);
    } else {
      gameModel.player.grab(object.config);
    }
    removeCharacter(object);
  } else if (Number.isFinite(object.points)) {
    if (object.isBaggable === false) {
      addScoreForCharacter(object, 1);
    } else {
      gameModel.player.grab(object);
    }
  }

  if (object.speedReduction) {
      gameModel.player.reduceSpeedBy(object);
  }

  const grabSound = object.grabSound;
  if (grabSound && Sound[grabSound]) {
      Sound[grabSound]();
  }

  if (object === OBJECTS.fountain) {
      gameModel.player.powerUp = true;
      const powerUpTime = gameModel.player.powerUpTime;

      Timer.setTimeout(() => {
        if (powerUpTime === gameModel.player.powerUpTime) {
          gameModel.player.powerUp = false;
          updateGameState(gameModel.player);
        }
      }, gameModel.player.powerUpDuration);
  }
}

function playerKilled(buried = false) {
    gameModel.player.die(buried);
    gameModel.player.direction = Direction.NONE;
    gameModel.grid.placeCharacter(gameModel.player);
    
    if (gameModel.player.lives === 0) {
      playerGameOver();
    } else {
      Sound.dead();
    }
}

function onPlayerCollide(character) {
  if (!(character instanceof Character && gameModel.player.isAlive)) return;

  if (gameModel.player.powerUp) {
    playerChomp(gameModel.player, character);
  } else if (character.canKill(gameModel.player)) {
    if (character.disabled === true) return;
    playerKilled();
  } else {
    playerGrab(character);
  }
  updateGameState(gameModel.player);
}

function onCharacterCollide(character, other) {
  if (!(character instanceof Character && other instanceof Character)) return;

  if (character.canKill(other)) {
    playerChomp(character, other);
  } else if (other.canKill(character)) {
    playerChomp(other, character);
  }
}

function buildMaze() {
  gameModel.grid.render((cell, row, col) => {
  });
  
  let list = [];
  for (let i = 1; i <  gameModel.player.level; i++) {
    const relicKind = Relic.kindForLevel(i);
    const parts = Relic.parse(Grid.symbolFor(relicKind));
    list.push(`<div>${parts[0]}</div>`);
  }
  gameScreen.relicStatusLine.innerHTML = list.join("");

  list = [];
  const trophySymbol = Grid.symbolFor("maze-trophy");
  for (let i = 0; i < gameModel.player.trophiesAwarded; i++) {
    list.push(`<div>${trophySymbol}</div>`);
  }
  gameScreen.trophyStatusLine.innerHTML = list.join("");
}

function movePlayer(direction, delta) {
  if (gameModel.player.isBuried || gameModel.player.exitMaze) return;

  // This is where gameModel.player is at
  const currentRow = gameModel.player.row;
  const currentCol = gameModel.player.col;

  // This is where gameModel.player is going
  const nextRow = currentRow + direction[0];
  const nextCol = currentCol + direction[1];

  // Special case for initial gameModel.player movement
  if (Direction.isNone(gameModel.player.direction) && currentRow === 1 && currentCol === 0 
    && gameModel.grid.canCharacterMoveTo(gameModel.player, nextRow, nextCol)) {
    gameModel.player.row = nextRow;
    gameModel.player.col = nextCol;
    gameModel.grid.placeCharacter(gameModel.player);
    gameModel.player.onMoved(gameModel.grid.objectAt(gameModel.player));
  } else {
    // If gameModel.player is trapped, then end the game.
    const playerTrapped = gameModel.grid.objectAt(currentRow, currentCol) === OBJECTS.wall;
    
    if (playerTrapped) {
      playerKilled(true);
      updateGameState(gameModel.player);
    } else if (gameModel.player.isAlive) {
      gameModel.grid.moveCharacter(gameModel.player, direction, delta, nextRow, nextCol);
    }
  }
}

function moveCharacters(delta) {
  gameModel.characters.forEach(character => moveCharacter(character, delta));
}

function moveCharacter(character, delta) {
  if (character.disabled === true || gameModel.grid.isCharacterEnroute(character, delta)) {
    if (gameModel.grid.haveCollided(gameModel.player, character)) {
      onPlayerCollide(character);
    }
    return;
  }

  function getDirections(direction) {
    // The default is to pick a random direction
    const directions = [...Direction.ALL];
    Direction.shuffle(directions, gameModel.random);
    const dirs = [Direction.NONE, ...directions];

    // If the character is already moving in a direction, then favor
    // that before the randomized ones.
    if (Direction.isGood(direction)) {
        const canSeePlayer = gameModel.grid.canCharacterSeeTheOther(character, gameModel.player);

        // When the character can see the gameModel.player, don't favor the same
        // direction if its a prey or the gameModel.player is powered up.
        if (gameModel.player.powerUp ? false : !(canSeePlayer && character.priority < 1)) {
            dirs.push(direction);
        }

        // Don't introduce a random turn if a hunter sees the gameModel.player
        if (!(character.priority >= gameModel.player.priority && canSeePlayer)) {
            // Add a random turn before the perferred direction.
            const turns = Direction.turnsFor(direction);
            const randomTurnIndex = Math.floor(gameModel.random()*10);
            if (randomTurnIndex < 5) {
                dirs.push(turns[randomTurnIndex % turns.length]);
            }
        }

        // Hunt down the gameModel.player by favoring the gameModel.player's location.
        // The vision distance is random up to on the gameModel.player's level.
        if (character.canKill(gameModel.player) && gameModel.player.isAlive && 
          gameModel.random() * (settings.oddsOfBeingHunted + gameModel.characters.killers(gameModel.player).length) < 1) {
          const huntDistance = gameModel.random() * character.manhattanDistanceTo(gameModel.player) 
            + gameModel.random() * gameModel.player.level;
          if (huntDistance < gameModel.player.level) {
            const huntUD = gameModel.player.row < character.row ? Direction.UP : Direction.DOWN;
            const huntLR = gameModel.player.col < character.col ? Direction.LEFT : Direction.RIGHT;
            const huntDir = Math.abs(character.row - gameModel.player.row) > Math.abs(character.col - gameModel.player.col) ? huntUD : huntLR;

            if (huntDir !== direction) {
              dirs.push(huntDir);
            }
          }
        }
    }
    return dirs;
  }

  const dirs = getDirections(character.direction);
  let direction = Direction.NONE;

  while (dirs.length > 0) {
    direction = dirs.pop();

    if (Direction.isGood(direction) && character.allowedDirections.includes(direction)) {
      const nextRow = character.row + direction[0];
      const nextCol = character.col + direction[1];

      if (gameModel.grid.canCharacterMoveTo(character, nextRow, nextCol)) {
          gameModel.grid.moveCharacter(character, direction, delta, nextRow, nextCol);
          break;
      }
    }
  }

  // Guard against a character already removed from the maze by now.
  if (!gameModel.characters.contains(character)) return;

  if (gameModel.grid.haveCollided(gameModel.player, character)) {
    onPlayerCollide(character);
  } 

  gameModel.characters.killables(character).forEach(other => {
    if (character.canKill(other) && gameModel.grid.haveCollided(character, other)) {
      onCharacterCollide(character, other);
    }
  });

  if (character.kind === CHARACTERS.rock.kind && Direction.isNone(direction)) {
    removeCharacter(character);

    // When a rock stops moving, it can become a wall if position is
    // not occupied by a fixed object. Otherwise try the row above.
    let object = gameModel.grid.objectAt(character.row, character.col);
    let row = character.row;

    if (!object || object.fixed === true) {
      object = gameModel.grid.objectAt(--row, character.col);
    }
    if (object && object.fixed !== true) {
      gameModel.grid.placeObjectAt(row, character.col, OBJECTS.wall, {rock: true});
      updateGameUI();
    }
  }
}

function tallyScore() {
  const list = [];
  const scores = [];

  const tally = (kind, object, multipler) => {
    if (object.points > 0) {
      const points = object.points * multipler;
     
      scores.push(points);
      list.push(`<div>${Grid.symbolFor(kind)} &times; ${multipler} &times; ${object.points}</div><div class='score'>${points}</div>`);
    }
  };

  Object.values(OBJECTS).forEach(object => {
    const items = gameModel.player.findInBag(object);

    if (items.length > 0) {
      tally(object.kind, object, items.length);
    }
  });

  Object.values(CHARACTERS).forEach(object => {
    const items = gameModel.player.findInBag(object);

    if (items.length > 0) {
      tally(object.kind, object, items.length);
    }
  });

  const mazeBonusPoints = gameModel.player.mazeBonus * settings.pointsPerPath;
  if (mazeBonusPoints !== 0) {
    scores.push(mazeBonusPoints);
    list.push(`<div>${Grid.symbolFor("maze-bonus")} &times; ${gameModel.player.mazeBonus} &times; ${settings.pointsPerPath}</div><div class='score'>${mazeBonusPoints}</div>`);
  }

  if (gameModel.player.isMazeCleared) {
    const points = settings.mazeClearedBonusPoints * gameModel.player.level;
    scores.push(points);
    list.push(`<div>${MESSAGES.mazeClearedMessage} ${gameModel.player.level} &times; ${settings.mazeClearedBonusPoints}</div><div class='score'>${points}</div>`);
  } else {
    list.push(`<div>${MESSAGES.mazeNotClearedMessage}</div><div class='score'>0</div>`);
  }

  const levelRelic = gameModel.levelRelic;
  if (levelRelic) {
    const score = levelRelic.points * levelRelic.level;

    scores.push(score);
    list.push(`<div>${levelRelic.description} ${levelRelic.symbol} &times; ${levelRelic.level} &times; ${levelRelic.points}</div><div class='score'>${score}</div>`);
  }

  gameScreen.showScoreboard(MESSAGES.levelCompleted(gameModel.currentLevel, gameModel.currentMaze));
  
  let totalScore = 0;
  let scoreIndex = 0;

  const updateScore = () => {
    if (gameScreen.scoreboard.style.display === "none") {
      while (scoreIndex < scores.length) {
        totalScore += scores[scoreIndex++];
      }
      gameModel.player.score += totalScore;
      endMaze();
      return;
    }

    if (scoreIndex < scores.length) {
      const score = scores[scoreIndex++];
      
      totalScore += score;
      gameScreen.scorecard.innerHTML = list.slice(0, scoreIndex).join("");
      Sound.ta_ding();

      gameWindow.setTimeout(updateScore, TIMEOUTS.updateScoreCardInterval);
    } else {
        if (!GameRecorder.hasNextMaze) gameScreen.scoreboardLinks.style.display = "flex";
        
        if (gameModel.currentMaze === settings.mazesPerLevel) {
          gameScreen.scoreboardLinks.nextMazeLink.textContent = MESSAGES.nextLevelLinkText;
        } else {
          gameScreen.scoreboardLinks.nextMazeLink.textContent = MESSAGES.nextMazeLinkText;
        }

        if (totalScore === 0) {
          gameScreen.scorecard.innerHTML = "<div>You came out empty this time.</div><div class='score'>😐</div>";
          Sound.alert();
        } else {
          list.push(`<div style='justify-self: right'>${MESSAGES.totalPoints}</div><div class='score'>${totalScore}</div>`);
          
          const trophiesAwarded = Math.floor(totalScore / settings.pointsPerTrophy);
          const pointsNeeded = settings.pointsPerTrophy - totalScore % settings.pointsPerTrophy;
          const trophySymbol = Grid.symbolFor("maze-trophy");

          if (trophiesAwarded === 0) {
            list.push(`<div><span class='score'>${pointsNeeded}</span> ${MESSAGES.pointNeedForTrophy}</div><div>${trophySymbol}</div>`);
          } else {
            gameModel.player.trophiesAwarded += trophiesAwarded;
            list.push(`<div style='justify-self: right'>${MESSAGES.trophyAwarded[trophiesAwarded > 1 ? 1 : 0]}:</div><div class='score'>${trophySymbol.repeat(trophiesAwarded)}</div>`);
            list.push(`<div><span class='score'>${pointsNeeded}</span> ${MESSAGES.pointNeedForNextTrophy}</div><div>${trophySymbol}</div>`);
          }
          gameScreen.scorecard.innerHTML = list.join("");
          gameModel.player.score = gameModel.player.exitMazeScore + totalScore;
          Sound.ding();

          updateGameUI();

          if (GameRecorder.hasNextMaze) {
            setTimeout(() => {
              endMaze();
              replayMazeRecording(GameRecorder.selectNextMaze());
            }, TIMEOUTS.nextMazeReplayDelay);
          } else {
            endMaze();
          }
        }
    }
  }
  updateScore();
}

function replayMaze(index = -1) {
  gameScreen.setReplayRecording(GameRecorder.timeline);
  gameModel.replayPaused = false;
  replayMazeRecording(index);
}

function goDeeper() {
  GameRecorder.resetReplay();
  gameScreen.hideScoreboard();

  if (grid) {
    gameModel.player.row = gameModel.grid.rows-1;
    gameModel.player.col = gameModel.grid.cols-1;
    
    gameModel.grid.setCharacterAttributes(gameModel.player, {down: true, flatten: true});
    gameModel.grid.placeCharacter(gameModel.player);

    Sound.deeper();
    gameWindow.setTimeout(nextMaze, TIMEOUTS.nextMazeDelay);
  } else {
    nextMaze();
  }

}

function nextMaze() {
  gameScreen.hideReplayBar();
  
  gameModel.reset();
  gameModel.currentLevel = Math.floor(gameModel.player.mazes / settings.mazesPerLevel)+1;
  gameModel.currentMaze = (gameModel.player.mazes % settings.mazesPerLevel)+1;

  gameModel.player.mazes++;
  
  gameScreen.showInstructions(gameModel.player.mazes === 1);
  startMaze();
}

function startMaze() {
  gameScreen.hideScoreboard();
  gameScreen.hideGameInfo();

  const levelDelta = 2 * (gameModel.currentLevel-1);
  let rows = Math.min(settings.rows + levelDelta, settings.maxRows);
  let cols = Math.min(settings.cols + levelDelta, settings.maxCols);

  if (gameModel.currentMaze === 1) {
    gameModel.player.level = gameModel.currentLevel;
    Sound.level();
  } else {
    if (gameModel.currentMaze & 1) {
      cols = Math.min(cols+2, settings.maxCols);
    } else {
      rows = Math.min(rows+2, settings.maxRows);
    }
    Sound.maze();
  }

  Timer.clear();
  Keyboard.clear();

  const record = gameModel.startMaze(rows, cols);
  GameRecorder.startMaze(record);

  gameModel.playbackSpeed = gameScreen.replayBar.speed;
  gameScreen.replayBar.setCurrentTick(gameModel.ticks);

  if (gameModel.isLastMaze) {
    gameModel.relicChamberFormation = RELIC_CHAMBERS[Math.min(gameModel.player.level-1, RELIC_CHAMBERS.length-1)];
    gameModel.grid.placeObjectFormation(gameModel.relicChamberFormation, OBJECTS.edge, {});
  }

  setupCharacters();

  if (gameModel.isLastMaze) {
    gameModel.grid.placeObjectFormation(gameModel.relicChamberFormation, OBJECTS.rock, {});
  }

  [gameModel.actors].forEach(character => {
      // Negative speed is not sped up. 
      if (character.speed > 0) {
        character.speed += gameModel.player.level * settings.speedUpRatePerLevel * character.speed;
      }
  });

  gameWindow.focus();
  buildMaze();
  updateGameState(gameModel.player);
  play();
}

function endMaze(saveCheckpoint = false) {
  const checkpoint = gameModel.endMaze();

  if (saveCheckpoint) {
    GameRecorder.saveRecording(checkpoint);
  } else {
    GameRecorder.tagRecording(checkpoint);
  }
}

function play() {
    const sequence = gameModel.sequence;
    let lastTicks = gameModel.ticks;
    let lastTime = performance.now();
    let timeSlice = 0;

    Timer.reset();

    function gameSpeed() {
      return GameRecorder.isReplaying ? gameModel.playbackSpeed : 1;
    }

    function gameLoop(time) {
      function canContinue() {
        return sequence === gameModel.sequence && lastTicks <= gameModel.ticks && gameModel.replayPaused !== true
          && !(gameModel.isGameOver || gameModel.player.isBuried || gameModel.player.exitMaze);
      }

      if (!canContinue()) return;

      lastTicks = gameModel.ticks;

      if (Keyboard.NextMaze) {
        Keyboard.NextMaze = false;
        endMaze();
        nextMaze();
        return;
      }
      
      timeSlice += Math.min(settings.maxTimeSlice, time-lastTime) * gameSpeed();
      lastTime = time;

      const stepInterval = Timer.stepInterval || settings.gameStepInterval
      while (timeSlice >= stepInterval && canContinue()) {
        timeSlice -= stepInterval;
        const delta = stepInterval/1000;
        playGameStep(delta);
      }

      if (canContinue()) {
          gameWindow.requestAnimationFrame(gameLoop);
      } else if (gameModel.player.exitMaze) {
        playerExitMaze();
      }
    }
    gameWindow.requestAnimationFrame(gameLoop);
}

function playGameStep(delta) {
  Timer.update(gameModel.ticks);

  moveCharacters(delta);
  updateInputMask();

  const inputMask = handleInput(gameModel.ticks);
  const moveDirection = Keyboard.getDirection() || gameModel.player.direction || Direction.NONE;
  
  movePlayer(moveDirection, delta);

  GameRecorder.recordGameStep(
    gameModel.ticks,
    inputMask
  );
  gameScreen.replayBar.setCurrentTick(gameModel.ticks);
  gameModel.ticks++;
}

function updateInputMask() {
  if (GameRecorder.isReplaying) {
    const inputMask = GameRecorder.replayInputMask(gameModel.ticks);
    Keyboard.applyMask(inputMask);
  }
}

function handleInput() {
    const inputMask = Keyboard.getMask();

    if (Keyboard.Space) {
        if (gameModel.player.isAlive) {
            playerTNT(gameModel.player);
        } else {
            playerRespawn();
        }
        // Don't let it repeat
        Keyboard.Space = false;
    }
    return inputMask;
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
  if (gameModel.characters.add(character)) {  
    gameModel.grid.addCharacter(character);
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
  const positions = gameModel.grid.placeObjectFormation(gameModel.relicChamberFormation, OBJECTS.wall, {pulse: true, rock: true});

  // Where the relic is buried is randomized
  const positionIndex = Math.floor(gameModel.random() * positions.length);
  const position = positions[positionIndex];

  // The Guardian is hiding at the same location as the relic, so the
  // astute will see where the Guardian originated from and dig there.
  const guardian = createCharacter(CHARACTERS.ghost, {row: position.row, col: position.col});
  const relic = createCharacter(CHARACTERS.relic, position);
  relic.setRelic(gameModel.levelRelic);
  disableCharacter(guardian, TIMEOUTS.guardianDelay-gameModel.player.level*TIMEOUTS.guardianDelayLevelReduction);
}

function startCaveIn() {
  if (gameModel.caveInStarted) return;

  gameModel.caveInStarted = true;
  Grid.mazeEl.classList.toggle("rumble", true);

  const caveInInterval = Timer.setInterval(() => {
    if (!gameModel.caveInStarted || gameModel.player.exitMaze || gameModel.isGameOver) {
      gameModel.caveInStarted = false;
      Grid.mazeEl.classList.toggle("rumble", false);
      Timer.clear(caveInInterval);
      return;
    }
    dropRandomRocks();
  }, TIMEOUTS.caveInInterval);
}

function dropRandomRocks() {
  const positions = findRandomRockPositions(gameModel.player.level);
  if (positions.length === 0) return;

  positions.forEach(position => {
    const rock = new Rock(position);
    addCharacter(rock);
  });
}

function findRandomRockPositions(count) {
  function canPlaceRockAt(row, col) {
    const object = gameModel.grid.objectAt(row, col);
    return object && object.fixed !== true && object.priority <= CHARACTERS.rock.priority;
  }

  const positions = [];
  positions.contains = (position) => {
    positions.some(item => item.row === position.row && item.col === position.col);
  };

  let tries = gameModel.random() * 10;

  // When there are enough walls in the maze, try to place rocks in the walls first.
  while (--tries > 0 && (gameModel.grid.pathCount / gameModel.grid.cellCount) < settings.caveInThreshold) {
    const position = findRandomPathCell(gameModel.random, true);
    // There must be a path cell below the wall to place a rock in the wall.
    if (canPlaceRockAt(position.row+1, position.col) && !positions.contains(position)) {
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
    if (canPlaceRockAt(row+1, col) && !positions.contains(position)) {
      positions.push(position);
      continue;
    }

    // Otherwise place rocks at lowest possible row in the column if a path cell exists.
    while (++row < gameModel.grid.rows-1) {
      const position = { row: row-1, col }
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

    if (inWalls ? !(obj === OBJECTS.wall || obj === OBJECTS.rock) : (obj !== OBJECTS.path)) continue;
    if (row === gameModel.player.row && col === gameModel.player.col) continue;
    if (gameModel.characters.atRowCol(row, col)) continue;

    return { row, col };
  }
}

function saveHighScore(highScore) {
  localStorage.setItem("indiana-bones-high-score", String(highScore));
}

function getHighScore() {
  return Number(localStorage.getItem("indiana-bones-high-score")) || 0;
}

function playerExitMaze() {
  // Set score to when gameModel.player exited the maze so tallyScore
  // can add to it to get to the final maze score.
  gameModel.player.score = gameModel.player.exitMazeScore;

  Sound.yeah();
  updateGameUI();

  if (!GameRecorder.hasNextMaze) gameScreen.hideReplayBar();
  gameWindow.setTimeout(tallyScore, TIMEOUTS.tallyScoreDelay);
}

function playerGameOver() {
  Sound.gameover();
  gameModel.gameOver();
  gameScreen.showInstructions(false);
  
  function gameOver() {
    const isGameNumber = Number.isFinite(gameModel.gameNumber);
    const title = isGameNumber ? MESSAGES.gameInfoTitle+gameModel.gameNumber : MESSAGES.gameOverTitle;

    gameScreen.showGameInfo(title);
    gameScreen.gameInfoContent.innerHTML = getPlayerAcheivements();

    tallyTrophyBonus();
  }
  setTimeout(gameOver, TIMEOUTS.gameOverDelay);
}

function tallyTrophyBonus() {
  if (gameModel.player.trophiesAwarded <= 0) {
    updateFinalScore();
    return;
  }

  const trophySymbol = Grid.symbolFor("maze-trophy");
  const gameOverAchievementsHtml = gameScreen.gameInfoContent.innerHTML;

  let trophies = 0;

  function updateFinalScore() {
    gameModel.player.score = gameModel.player.exitMazeScore + settings.pointsPerTrophy * gameModel.player.trophiesAwarded;
    updateGameUI();
    gameScreen.gameInfoContent.innerHTML += `<div>&nbsp;</div><div class='label'>${MESSAGES.finalScore}</div><div class="banner shadowGlow pulse">${gameModel.player.score}</div>`;

    saveHighScore(settings.highScore);

    const record = gameModel.endGame();
    GameRecorder.tagRecording(record);
  }

  function nextTrophy() {
    if (gameScreen.gameInfoPanel.style.display === 'none') {
      // Game over screen was dismissed
      updateFinalScore();
      return;
    };

    if (trophies === gameModel.player.trophiesAwarded) {
      // Display final score awarded
      Sound.dingDing();
      updateFinalScore();
    } else {
      const list = [gameOverAchievementsHtml, `<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div>`];
      
      // Tally each trophy
      const bonusPoints = settings.pointsPerTrophy * (++trophies);
      for (let i = Math.floor(trophies/10); i > 0; i--) {
        // Break up into rows of 10 trophies for display
        list.push(`<div class='icon'>${trophySymbol.repeat(10)}</div>`);
      }

      // Remaining trophies for display 
      const remainingTrophies = trophies % 10;
      if (remainingTrophies > 0) {
        list.push(`<div class='icon'>${trophySymbol.repeat(remainingTrophies)}</div>`);
      }

      // Bonus points for tallied trophies
      list.push(`<div class='score'>${bonusPoints}</div>`);
      
      Sound.ding();
      gameScreen.gameInfoContent.innerHTML = list.join("");
      gameWindow.setTimeout(nextTrophy, TIMEOUTS.gameOverTrophyTallyInterval);    
    }
  }
  nextTrophy();
}

function getPlayerAcheivements() {
  const list = [];

  if (gameModel.player.level <= 1) {
    list.push(`<div class='label'>${MESSAGES.relicsFound}</div><div>${MESSAGES.none}</div>`);
  } else {
    list.push(`<div class='label'>${MESSAGES.relicsFound}</div>`);

    let relics = [];
    for (let i = 1; i <  gameModel.player.level; i++) {
      const relicKind = Relic.kindForLevel(i);
      const parts = Relic.parse(Grid.symbolFor(relicKind));
      relics.push(`<div><div class='icon'>${parts[0]}</div><div>${parts[1]}</div></div>`);

      if (relics.length === 5) {
        list.push(`<div>${relics.join("")}</div>`);
        relics = [];
      }
    }
    if (relics.length > 0) {
      list.push(`<div>${relics.join("")}</div>`);
    }
  }

  if (gameModel.player.trophiesAwarded <= 0) {
    list.push(`<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div><div>${MESSAGES.none}</div>`);
  }
  return list.join("");
}

function startGame(seed = 0) {
  Timer.setStepInterval(settings.gameStepInterval);
  GameRecorder.startGame(GAME_VERSION, seed, settings.gameStepInterval);

  gameModel.startGame(seed);

  if (gameModel.gameNumber && seed != gameModel.gameNumber) {
    gameModel.gameNumber = null;
    deleteGameNumberFromURL();
  }

  settings.setDefaults();
  gameModel.player.reset();

  gameScreen.showGameUI();
  nextMaze();
}

function playAgain() {
  startGame(gameModel.seed);
}

function replayGame() {
  gameScreen.showGameUI();
  replayMaze(0);
}


function replayMazeRecording(indexOrMazeRecording) {
  const mazeRecording = Number.isFinite(indexOrMazeRecording) ? GameRecorder.selectMaze(indexOrMazeRecording) : indexOrMazeRecording;
  if (!mazeRecording) return false;

  gameModel.initWithMazeRecording(mazeRecording);
  startMaze();

  return true;
}

gameScreen.scoreboardLinks.nextMazeLink.addEventListener("click", goDeeper);
gameScreen.scoreboardLinks.replayMazeLink.addEventListener("click", () => replayMaze(-1));

const gameModel = new GameModel(settings);

settings.highScore = getHighScore();

gameScreen.startGame = (seed) => gameWindow.setTimeout(startGame, TIMEOUTS.gameOverTrophyTallyInterval, seed);
gameScreen.playAgain = () => gameWindow.setTimeout(playAgain, TIMEOUTS.gameOverTrophyTallyInterval);
gameScreen.replayGame = () => gameWindow.setTimeout(replayGame, TIMEOUTS.gameOverTrophyTallyInterval);

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
        playerGameOver();
      } else {
        playerExitMaze();
      }
    },

    onPlayPause(playing) {
      if (gameModel.replayPaused === !playing) return false;

      gameModel.replayPaused = !playing;
      if (playing) {
        gameWindow.requestAnimationFrame(play);
      }
      return playing;
    },

    onStop() {
      this.onPlayPause(false);
      this.onSelectMaze(0);
    },

    onSpeedChange(speed) {
      gameModel.playbackSpeed = speed;
      return speed;
    }
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

  const savedGame = GameRecorder.load(GAME_VERSION, gameNumber, "checkpoint")
    || GameRecorder.load(GAME_VERSION, gameNumber, "finished");
    
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

// Select the initial screen from the URL.
(() => {
  const gameNumber =
    getGameNumberFromURL();

  if (gameNumber === null) {
    gameScreen.showBio();
  } else {
    initGame(gameNumber);
  }
})();

