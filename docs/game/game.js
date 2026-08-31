import { Direction, RNG, Timer } from "./util.js";
import { GAME_VERSION, GAME_RNG, CHARACTERS, OBJECTS, MESSAGES, TIMEOUTS, RELIC_CHAMBERS, MAZE_ITEMS, MAZE_DROPABLES } from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { Character } from "./character.js";
import { Player } from "./player.js";
import { Spider, Scorpion, Cat, Monkey, Mouse, Ghost, Rock, Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { Keyboard } from "./keyboard.js";
import { GameRecorder } from "./recorder.js";
import { ReplayBar } from "./replaybar.js";

Grid.onCharacterMoved = (character, object) => {
  if (character === player) {
    onPlayerMoved(character);
  } else {
    if (object.priority > character.priority) {
      character.reduceSpeedBy(object);
    }
    if (character instanceof Rock) {
      onRockMoved(character, object);
    }
    if (character.canDrop && grid.objectAt(character.row, character.col) === OBJECTS.path
      && gameState.random() < character.dropProbability) {
      grid.placeObjectAt(character.row, character.col, character.dropObject);
    }
    updateGameState(character);
  }
}

function updateGameState(reason) {
  const attributes = {entrance: false, spin: false, powerup: false, dead: false, buried: false, webbed: false, pooped: false, shake: false};

  if (reason.speedReductionReason) {
    attributes[reason.speedReductionReason] = reason.isReducedSpeed;
  }
  if (reason.disabled === true) {
    attributes.shake = true;
  }

  if (reason instanceof Player) {
    if (reason.isAlive) {
        attributes.powerup = reason.powerUp;

        if (grid.objectAt(reason) === OBJECTS.exit) {
          if (!player.exitMaze) {
            player.exitMaze = true;
            player.isMazeCleared = grid.isMazeCleared && characters.killables().length === 0;
            player.mazeBonus = grid.mazeBonus;
            attributes.spin = true;
          }
        } else if (grid.isCharacterAtEntrance(reason)) {
            attributes.entrance = true;
        } else if (gameState.keysNeeded === 0) {
          --gameState.keysNeeded;
          Sound.portal();

          if (gameState.isLastMaze) {
              Timer.setTimeout(showRelicChamber, TIMEOUTS.caveInInterval);
          } else {
            grid.ensureExit();
          }
        }
    } else if (reason.canRespawn) {
        attributes.dead = true;
    } else {
        attributes.buried = true;
    }
    if (gameState.isCaveInThreshold) {
      startCaveIn();
    }
  } 
  grid.setCharacterAttributes(reason, attributes);
  updateGameUI();
}

function updateGameUI() {
    let list = [];

    if (player.bonusAwarded) {
      Sound.dingDing();
      player.bonusAwarded = false;
    }

    const lives = Math.min(player.isAlive ? player.lives-1 : player.lives, settings.maxLives);
    if (lives > 0) {
      list.push(`${Grid.symbolFor(player.kind)}`.repeat(lives));
    }
    if (player.tnts > 0) {
      list.push(`${Grid.symbolFor(OBJECTS.tnt.kind)}<b>${player.tnts}</b>`);
    }
    gameScreen.playerStatusLine.innerHTML = list.join("&nbsp;");

    list = [];
    Object.entries(OBJECTS).forEach(([kind, object]) => {
      const count = player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });
    Object.entries(CHARACTERS).forEach(([kind, object]) => {
      const count = player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });
    
    if (gameState.levelRelic) {
      list.push(`<div class='pulse'>${gameState.levelRelic.symbol}</div>`);
    }

    if (player.score > settings.highScore) {
      settings.highScore = player.score;
    }
    gameScreen.bagStatusLine.innerHTML = list.join('');

    gameScreen.scoreStatusLine.classList.toggle("minus", player.score < 0);
    gameScreen.scoreStatusLine.textContent = `${Math.abs(player.score)}`

    gameScreen.highScoreStatusLine.classList.toggle("minus", settings.highScore < 0);
    gameScreen.highScoreStatusLine.textContent = `${Math.abs(settings.highScore)}`;

    mazeStatusLine.innerHTML = `<b>LEVEL ${gameState.currentLevel}.${gameState.currentMaze}</b> 
      <span>${Grid.symbolFor("maze-bonus")}</span><b>${player.mazeBonus || grid?.mazeBonus || 0}</b>`;
}

function playerTNT(character) {
  if (character === player) {
    if (player.powerUp || !(player.isAlive && player.removeTNT())) return false;
  } else if (character instanceof Rock) {
    characters.remove(character);
  } else if (character && character.isTNT && grid.objectAt(character.row, character.col) === OBJECTS.tnt) {
    grid.placeObjectAt(character.row, character.col, OBJECTS.path)
  } else {
    return;
  }

  Sound.tnt();
  grid.addAnimationCharacterFor(character, {explosion: true});

  const playerRect = grid.cellRectAtRowCol(character.row, character.col);
  const rectTopLeft = grid.cellRectAtRowCol(character.row-1, character.col-1) || playerRect;
  const rectBottomRight = grid.cellRectAtRowCol(character.row+1, character.col+1) || playerRect;
  const blastRect = {top: rectTopLeft.top, left: rectTopLeft.left, bottom: rectBottomRight.bottom, right: rectBottomRight.right};

  characters.forEach((target) => {
    if ((target.priority - OBJECTS.tnt.priority) <= 2 
      && grid.hasCharacterCollidedWithRect(target, blastRect)) {
      onCharacterBlownUp(target);
    }
  });

  Grid.ALL_DIRECTIONS.forEach((rc) => {
    const row = character.row + rc[0];
    const col = character.col + rc[1];
    const mazeObjAtRowCol = grid.objectAt(row, col);

    if (mazeObjAtRowCol && mazeObjAtRowCol.fixed !== true) {
      if (mazeObjAtRowCol === OBJECTS.tnt) {
        grid.updateCellAtRowCol(row, col, {strobe: true});
        Timer.setTimeout(playerTNT, TIMEOUTS.tntDetonationDelay, {isTNT: true, row, col});
      } else {
        const blast = mazeObjAtRowCol !== OBJECTS.path;
        grid.placeObjectAt(row, col, OBJECTS.path, {flash: true, blast: blast});
      }
    }
  });

  // The Player can be hurt if TNT was set off by 
  // chain reaction or by a 3rd party, and the 
  // Player is not powered-up.
  if (player !== character && !player.powerUp 
    && grid.hasCharacterCollidedWithRect(player, blastRect)) {
    // Beware! If the player is waiting to respawn and
    // is blown up, then its game over!
    grid.addAnimationCharacterFor(player, {blast: true});
    playerKilled(!player.isAlive);
    updateGameState(player);
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

  grid.addAnimationCharacterFor(character, {blast: true});

  if (character.canKill(player)) {
    if (character.lives === 0) {
      addScoreForCharacter(character, settings.blownUpPointsFactor);
    } else {
      character.lives--;
      disableCharacter(character, settings.blowUpRecoveryDuration);
      grid.applyAnimationFor(character, {blownup: true});
      return;
    }
  } else {
    addScoreForCharacter(character, -1);
  }
  characters.remove(character);
}

function addScoreForCharacter(character, factor) {
  if (Number.isFinite(character.points) && player.isAlive) {
    // Only half the value is given for chomping
    const points = character.points * factor;
    player.score += points;
    const target = character instanceof Character ? character : player;
    grid.addScoreCharacterFor(target, points, TIMEOUTS.characterPointsLabel);
  }
}

function playerRespawn() {
  if (!player.canRespawn) return false;

  player.respawn();
  Sound.respawn();

  updateGameState(player);
  return true;
}

function playerChomp(character, object) {
  if (object instanceof Character) {
      if (!(character instanceof Rock || object.isChompable || object.disabled)) return;

      addScoreForCharacter(object, object.canKill(player) ? 1 : settings.chompPointsFactor);
      characters.remove(object);

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
      gameState.levelRelic = object;
      Sound.portal();
      grid.addHtmlCharacterFor(object, `<span class='relic'>${object.description}</span>`, TIMEOUTS.relicLabelDuration);
      grid.ensureExit(true, {row: player.row, col: player.col});
      Timer.setTimeout(startCaveIn, TIMEOUTS.caveInInterval);
    } else {
      player.grab(object.config);
    }
    characters.remove(object);
  } else if (Number.isFinite(object.points)) {
    if (object.isBaggable === false) {
      addScoreForCharacter(object, 1);
    } else {
      player.grab(object);
    }
  }

  if (object.speedReduction) {
      player.reduceSpeedBy(object);
  }

  const grabSound = object.grabSound;
  if (grabSound && Sound[grabSound]) {
      Sound[grabSound]();
  }

  if (object === OBJECTS.fountain) {
      player.powerUp = true;
      const powerUpTime = player.powerUpTime;

      Timer.setTimeout(() => {
        if (powerUpTime === player.powerUpTime) {
          player.powerUp = false;
          updateGameState(player);
        }
      }, player.powerUpDuration);
  }
}

function playerKilled(buried = false) {
    player.die(buried);
    player.direction = Direction.NONE;
    grid.placeCharacter(player);
    
    if (player.lives === 0) {
      playerGameOver();
    } else {
      Sound.dead();
    }
}

function onRockMoved(character, object) {
  if (!object || object.fixed === true) return;

  if (object === OBJECTS.tnt) {
    playerTNT(character)
  } else if (object !== OBJECTS.path) {
    playerChomp(character, object);
  }
  grid.placeObjectAt(character.row, character.col, OBJECTS.path, {visited: true});
  updateGameUI();
}

function onPlayerMoved(character) {
    const object = grid.objectAt(character);
    
    if (object && object !== OBJECTS.exit) {
      if (object !== OBJECTS.path) {
        if (character.powerUp) {
            playerChomp(character, object);
        } else {
            playerGrab(object);
        }
        if (object === OBJECTS.key) {
          --gameState.keysNeeded;
        }
      }
      grid.placeObjectAt(character.row, character.col, OBJECTS.path, {visited: !character.powerUp});
    }
    updateGameState(character);
}

function onPlayerCollide(character) {
  if (!(character instanceof Character && player.isAlive)) return;

  if (player.powerUp) {
    playerChomp(player, character);
  } else if (character.canKill(player)) {
    if (character.disabled === true) return;
    playerKilled();
  } else {
    playerGrab(character);
  }
  updateGameState(player);
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
  grid.render((cell, row, col) => {
  });
  
  let list = [];
  for (let i = 1; i <  player.level; i++) {
    const relicKind = Relic.kindForLevel(i);
    const parts = Relic.parse(Grid.symbolFor(relicKind));
    list.push(`<div>${parts[0]}</div>`);
  }
  gameScreen.relicStatusLine.innerHTML = list.join("");

  list = [];
  const trophySymbol = Grid.symbolFor("maze-trophy");
  for (let i = 0; i < player.trophiesAwarded; i++) {
    list.push(`<div>${trophySymbol}</div>`);
  }
  gameScreen.trophyStatusLine.innerHTML = list.join("");
}

function movePlayer(direction, delta) {
  if (player.isBuried || player.exitMaze) return;

  // This is where player is at
  const currentRow = player.row;
  const currentCol = player.col;

  // This is where player is going
  const nextRow = currentRow + direction[0];
  const nextCol = currentCol + direction[1];

  // Special case for initial player movement
  if (Direction.isNone(player.direction) && currentRow === 1 && currentCol === 0 
    && grid.canCharacterMoveTo(player, nextRow, nextCol)) {
    player.row = nextRow;
    player.col = nextCol;
    grid.placeCharacter(player);
    onPlayerMoved(player);
  } else {
    // If player is trapped, then end the game.
    const playerTrapped = grid.objectAt(currentRow, currentCol) === OBJECTS.wall;
    
    if (playerTrapped) {
      playerKilled(true);
      updateGameState(player);
    } else if (player.isAlive) {
      grid.moveCharacter(player, direction, delta, nextRow, nextCol);
    }
  }
}

function moveCharacters(delta) {
  characters.forEach(character => moveCharacter(character, delta));
}

function moveCharacter(character, delta) {
  if (character.disabled === true || grid.isCharacterEnroute(character, delta)) {
    if (grid.haveCollided(player, character)) {
      onPlayerCollide(character);
    }
    return;
  }

  function getDirections(direction) {
    // The default is to pick a random direction
    const directions = [...Direction.ALL];
    Direction.shuffle(directions, gameState.random);
    const dirs = [Direction.NONE, ...directions];

    // If the character is already moving in a direction, then favor
    // that before the randomized ones.
    if (Direction.isGood(direction)) {
        const canSeePlayer = grid.canCharacterSeeTheOther(character, player);

        // When the character can see the player, don't favor the same
        // direction if its a prey or the player is powered up.
        if (player.powerUp ? false : !(canSeePlayer && character.priority < 1)) {
            dirs.push(direction);
        }

        // Don't introduce a random turn if a hunter sees the player
        if (!(character.priority >= player.priority && canSeePlayer)) {
            // Add a random turn before the perferred direction.
            const turns = Direction.turnsFor(direction);
            const randomTurnIndex = Math.floor(gameState.random()*10);
            if (randomTurnIndex < 5) {
                dirs.push(turns[randomTurnIndex % turns.length]);
            }
        }

        // Hunt down the player by favoring the player's location.
        // The vision distance is random up to on the player's level.
        if (character.canKill(player) && player.isAlive && 
          gameState.random() * (settings.oddsOfBeingHunted + characters.killers(player).length) < 1) {
          const huntDistance = gameState.random() * character.manhattanDistanceTo(player) 
            + gameState.random() * player.level;
          if (huntDistance < player.level) {
            const huntUD = player.row < character.row ? Direction.UP : Direction.DOWN;
            const huntLR = player.col < character.col ? Direction.LEFT : Direction.RIGHT;
            const huntDir = Math.abs(character.row - player.row) > Math.abs(character.col - player.col) ? huntUD : huntLR;

            if (huntDir !== direction) {
              dirs.push(huntDir);
            }
          }
        }
    }
    return dirs;
  }

  const dirs = getDirections(character.direction);
  const currentRow = character.row;
  const currentCol = character.col;
  let direction = Direction.NONE;

  while (dirs.length > 0) {
    direction = dirs.pop();

    if (Direction.isGood(direction) && character.allowedDirections.includes(direction)) {
      const nextRow = character.row + direction[0];
      const nextCol = character.col + direction[1];

      if (grid.canCharacterMoveTo(character, nextRow, nextCol)) {
          grid.moveCharacter(character, direction, delta, nextRow, nextCol);
          break;
      }
    }
  }

  if (!characters.contains(character)) return;

  if (grid.haveCollided(player, character)) {
    onPlayerCollide(character);
  } 

  characters.killables(character).forEach(other => {
    if (character.canKill(other) && grid.haveCollided(character, other)) {
      onCharacterCollide(character, other);
    }
  });

  if (character.kind === CHARACTERS.rock.kind && Direction.isNone(direction)) {
    characters.remove(character);

    // When a rock stops moving, it can become a wall if position is
    // not occupied by a fixed object. Otherwise try the row above.
    let object = grid.objectAt(character.row, character.col);
    let row = character.row;

    if (!object || object.fixed === true) {
      object = grid.objectAt(--row, character.col);
    }
    if (object && object.fixed !== true) {
      grid.placeObjectAt(row, character.col, OBJECTS.wall, {rock: true});
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
    const items = player.findInBag(object);

    if (items.length > 0) {
      tally(object.kind, object, items.length);
    }
  });

  Object.values(CHARACTERS).forEach(object => {
    const items = player.findInBag(object);

    if (items.length > 0) {
      tally(object.kind, object, items.length);
    }
  });

  const mazeBonusPoints = player.mazeBonus * settings.pointsPerPath;
  if (mazeBonusPoints !== 0) {
    scores.push(mazeBonusPoints);
    list.push(`<div>${Grid.symbolFor("maze-bonus")} &times; ${player.mazeBonus} &times; ${settings.pointsPerPath}</div><div class='score'>${mazeBonusPoints}</div>`);
  }

  if (player.isMazeCleared) {
    const points = settings.mazeClearedBonusPoints * player.level;
    scores.push(points);
    list.push(`<div>${MESSAGES.mazeClearedMessage} ${player.level} &times; ${settings.mazeClearedBonusPoints}</div><div class='score'>${points}</div>`);
  } else {
    list.push(`<div>${MESSAGES.mazeNotClearedMessage}</div><div class='score'>0</div>`);
  }

  if (gameState.levelRelic) {
    const relic = gameState.levelRelic;
    const points = relic.points * relic.level;
    scores.push(points);
    list.push(`<div>${relic.description} ${relic.symbol} &times; ${relic.level} &times; ${relic.points}</div><div class='score'>${points}</div>`);
  }

  gameScreen.showScoreboard(MESSAGES.levelCompleted(gameState.currentLevel, gameState.currentMaze));
  
  let totalScore = 0;
  let scoreIndex = 0;

  const updateScore = () => {
    if (gameScreen.scoreboard.style.display === "none") {
      while (scoreIndex < scores.length) {
        totalScore += scores[scoreIndex++];
      }
      player.score += totalScore;
      gameState.onMazeExited();
      return;
    }

    if (scoreIndex < scores.length) {
      const score = scores[scoreIndex++];
      
      totalScore += score;
      gameScreen.scorecard.innerHTML = list.slice(0, scoreIndex).join("");
      Sound.ta_ding();

      gameWindow.setTimeout(updateScore, TIMEOUTS.updateScoreCardInterval);
    } else {
        if (!gameState.isReplay) gameScreen.scoreboardLinks.style.display = "flex";
        
        if (gameState.currentMaze === settings.mazesPerLevel) {
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
            player.trophiesAwarded += trophiesAwarded;
            list.push(`<div style='justify-self: right'>${MESSAGES.trophyAwarded[trophiesAwarded > 1 ? 1 : 0]}:</div><div class='score'>${trophySymbol.repeat(trophiesAwarded)}</div>`);
            list.push(`<div><span class='score'>${pointsNeeded}</span> ${MESSAGES.pointNeedForNextTrophy}</div><div>${trophySymbol}</div>`);
          }
          gameScreen.scorecard.innerHTML = list.join("");
          player.score = player.exitMazeScore + totalScore;
          Sound.ding();

          updateGameUI();
          if (gameState.isReplay) {
            setTimeout(() => gameState.onMazeExited(), TIMEOUTS.nextMazeReplayDelay);
          } else {
            gameState.onMazeExited()
          }
        }
    }
  }
  updateScore();
}

function replayMaze(index = -1) {
  gameScreen.setReplayRecording(GameRecorder.timeline);
  gameState.replayPaused = false;
  gameState.onReplayMaze(index);
}

function goDeeper() {
  GameRecorder.resetReplay();
  gameScreen.hideScoreboard();

  if (grid) {
    player.row = grid.rows-1;
    player.col = grid.cols-1;
    
    grid.setCharacterAttributes(player, {down: true, flatten: true});
    grid.placeCharacter(player);

    Sound.deeper();
    gameWindow.setTimeout(nextMaze, TIMEOUTS.nextMazeDelay);
  } else {
    nextMaze();
  }

}

function nextMaze() {
  gameScreen.hideReplayBar();
  gameState.onNextMaze();

  gameState.currentLevel = Math.floor(player.mazes / settings.mazesPerLevel)+1;
  gameState.currentMaze = (player.mazes % settings.mazesPerLevel)+1;
  player.mazes++;
  
  gameScreen.showInstructions(player.mazes === 1);
  startMaze();
}

function startMaze() {
  gameScreen.hideScoreboard();
  gameScreen.hideGameInfo();

  const levelDelta = 2 * (gameState.currentLevel-1);
  let rows = Math.min(settings.rows + levelDelta, settings.maxRows);
  let cols = Math.min(settings.cols + levelDelta, settings.maxCols);

  if (gameState.currentMaze === 1) {
    player.level = gameState.currentLevel;
    Sound.level();
  } else {
    if (gameState.currentMaze & 1) {
      cols = Math.min(cols+2, settings.maxCols);
    } else {
      rows = Math.min(rows+2, settings.maxRows);
    }
    Sound.maze();
  }

  player.restart();
  gameState.onMazeStart();

  Grid.mazeEl.classList.toggle("rumble", false);
  grid = new Grid(rows, cols, settings.cellSize, {grid: gameState.randomizer, game: gameState.random});

  if (gameState.isLastMaze) {
    gameState.relicChamberFormation = RELIC_CHAMBERS[Math.min(player.level-1, RELIC_CHAMBERS.length-1)];
    grid.placeObjectFormation(gameState.relicChamberFormation, OBJECTS.edge, {});
  }

  grid.addCharacter(player);
  setupCharacters();

  if (gameState.isLastMaze) {
    grid.placeObjectFormation(gameState.relicChamberFormation, OBJECTS.rock, {});
  }

  [player, ...characters].forEach(character => {
      // Negative speed is not sped up. 
      if (character.speed > 0) {
        character.speed += player.level * settings.speedUpRatePerLevel * character.speed;
      }
  });

  gameWindow.focus();
  buildMaze();
  updateGameState(player);
  play();
}

function play() {
    const sequence = gameState.sequence;
    let lastTicks = gameState.ticks;
    let lastTime = performance.now();
    let timeSlice = 0;

    Timer.reset();

    function gameLoop(time) {
      function canContinue() {
        return sequence === gameState.sequence && lastTicks <= gameState.ticks && gameState.replayPaused !== true
          && !(gameState.gameOver || player.isBuried || player.exitMaze);
      }

      if (!canContinue()) return;

      lastTicks = gameState.ticks;

      if (Keyboard.NextMaze) {
        Keyboard.NextMaze = false;
        gameState.onMazeExited();
        nextMaze();
        return;
      }
      
      timeSlice += Math.min(settings.maxTimeSlice, time-lastTime) * gameState.gameSpeed;
      lastTime = time;

      const stepInterval = Timer.stepInterval || settings.gameStepInterval
      while (timeSlice >= stepInterval && canContinue()) {
        timeSlice -= stepInterval;
        const delta = stepInterval/1000;
        playGameStep(delta);
      }

      if (canContinue()) {
          gameWindow.requestAnimationFrame(gameLoop);
      } else if (player.exitMaze) {
        playerExitMaze();
      }
    }
    gameWindow.requestAnimationFrame(gameLoop);
}

function playGameStep(delta) {
  Timer.update(gameState.ticks);

  moveCharacters(delta);
  gameState.updateInputMask();

  const inputMask = handleInput(gameState.ticks);

  movePlayer(getMoveDirection(), delta);

  gameState.onGameStepCompleted(inputMask);
}

function handleInput() {
    const inputMask = Keyboard.getMask();

    if (Keyboard.Space) {
        if (player.isAlive) {
            playerTNT(player);
        } else {
            playerRespawn();
        }
        // Don't let it repeat
        Keyboard.Space = false;
    }
    return inputMask;
}

function getMoveDirection() {
  if (Keyboard.ArrowLeft)  return Direction.LEFT;
  if (Keyboard.ArrowRight) return Direction.RIGHT;
  if (Keyboard.ArrowUp)    return Direction.UP;
  if (Keyboard.ArrowDown)  return Direction.DOWN;

  return player.direction;
}

function setupCharacters() {
    characters = [];

    characters.characterIndex = (character) => {
        return characters.findIndex((element) => character === element);
    }

    characters.contains = (character) => {
        return characters.characterIndex(character) >= 0;
    }

    characters.remove = (character) => {
        const index = characters.characterIndex(character);
        if (index >= 0) {
            const character = characters.splice(index, 1)[0];
            grid.removeCharacter(character);
        }
    }

    characters.add = (character) => {
        const index = characters.characterIndex(character);
        if (index === -1) {
            characters.push(character);
            grid.addCharacter(character);
        }
    }

    characters.atRowCol = (row, col) => {
        return characters.find((character) => character.isAtRowCol(row, col));
    }

    characters.allAtRowCol = (row, col) => {
        return characters.filter((character) => character.isAtRowCol(row, col));
    }

    characters.all = (characterType) => {
        return characters.filter(item => item instanceof characterType);
    }

    characters.killers = (victim) => {
        return characters.filter(item => item.canKill(victim));
    }

    characters.killables = (character) => {
        const hunter = character || player;
        return characters.filter(prey => prey !== hunter && prey.priority <= hunter.priority);
    }

    Object.values(CHARACTERS).forEach(createCharacters);
    Object.values(MAZE_DROPABLES).forEach(dropItems);
}

function createCharacters(config) {
    if (!(config.class && config.qty)) return;

    let count = config.qty(player.level);

    while (count-- > 0) {
      const position = findRandomPathCell(gameState.randomizer, false);
      createCharacter(config, position);
    }
}

function createCharacter(config, position) {
    if (!config.class) return;

    const characterType = config.class;
    const character = new characterType(position);
    characters.add(character);

    return character;
}

function dropItems(config) {
    if (!config.qty) return;

    let count = config.qty(player.level);

    if (config === OBJECTS.key) {
      gameState.keysNeeded = count;
    }

    while (count-- > 0) {
      const position = findRandomPathCell(gameState.randomizer, config.inWalls);
      grid.placeObjectAt(position.row, position.col, config);
    }
}

function showRelicChamber() {
  const positions = grid.placeObjectFormation(gameState.relicChamberFormation, OBJECTS.wall, {pulse: true, rock: true});

  // Where the relic is buried is randomized
  const positionIndex = Math.floor(gameState.random() * positions.length);
  const position = positions[positionIndex];

  // The Guardian is hiding at the same location as the relic, so the
  // astute will see where the Guardian originated from and dig there.
  const guardian = createCharacter(CHARACTERS.ghost, {row: position.row, col: position.col});
  const relic = createCharacter(CHARACTERS.relic, position);
  relic.setSymbolDescription(gameState.currentLevel, Grid.symbolFor(Relic.kindForLevel(gameState.currentLevel)));
  disableCharacter(guardian, TIMEOUTS.guardianDelay-player.level*TIMEOUTS.guardianDelayLevelReduction);
}

function startCaveIn() {
  if (gameState.caveInStarted) return;

  gameState.caveInStarted = true;
  Grid.mazeEl.classList.toggle("rumble", true);

  const caveInInterval = Timer.setInterval(() => {
    if (!gameState.caveInStarted || player.exitMaze || gameState.gameOver) {
      gameState.caveInStarted = false;
      Grid.mazeEl.classList.toggle("rumble", false);
      Timer.clear(caveInInterval);
      return;
    }
    dropRandomRocks();
  }, TIMEOUTS.caveInInterval);
}

function dropRandomRocks() {
  const positions = findRandomRockPositions(player.level);
  if (positions.length === 0) return;

  positions.forEach(position => {
    const rock = new Rock(position);
    characters.add(rock);
  });
}

function findRandomRockPositions(count) {
  function canPlaceRockAt(row, col) {
    const object = grid.objectAt(row, col);
    return object && object.fixed !== true && object.priority <= CHARACTERS.rock.priority;
  }

  const positions = [];
  positions.contains = (position) => {
    positions.some(item => item.row === position.row && item.col === position.col);
  };

  let tries = gameState.random() * 10;

  // When there are enough walls in the maze, try to place rocks in the walls first.
  while (--tries > 0 && (grid.pathCount / grid.cellCount) < settings.caveInThreshold) {
    const position = findRandomPathCell(gameState.random, true);
    // There must be a path cell below the wall to place a rock in the wall.
    if (canPlaceRockAt(position.row+1, position.col) && !positions.contains(position)) {
      positions.push(position);
      break;
    }
  }

  // If no wall was found, then try to place rocks at top
  tries = grid.cols;
  while (--tries > 0 && positions.length < count) {
    const col = Math.floor(gameState.random() * grid.cols);
    let row = 0;
    
    // Place rocks at the top if a path cell exists.
    const position = { row, col };
    if (canPlaceRockAt(row+1, col) && !positions.contains(position)) {
      positions.push(position);
      continue;
    }

    // Otherwise place rocks at lowest possible row in the column if a path cell exists.
    while (++row < grid.rows-1) {
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
    const row = Math.floor(random() * grid.rows);
    const col = Math.floor(random() * grid.cols);
    const obj = grid.objectAt(row, col);

    if (inWalls ? !(obj === OBJECTS.wall || obj === OBJECTS.rock) : (obj !== OBJECTS.path)) continue;
    if (row === player.row && col === player.col) continue;
    if (characters.atRowCol(row, col)) continue;

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
  // Set score to when player exited the maze so tallyScore
  // can add to it to get to the final maze score.
  player.score = player.exitMazeScore;

  Sound.yeah();
  updateGameUI();

  if (!gameState.isReplay) gameScreen.hideReplayBar();
  gameWindow.setTimeout(tallyScore, TIMEOUTS.tallyScoreDelay);
}

function playerGameOver() {
  Sound.gameover();
  gameState.onGameOver();
  gameScreen.showInstructions(false);
  
  function gameOver() {
    const isGameNumber = Number.isFinite(gameState.gameNumber);
    const title = isGameNumber ? MESSAGES.gameInfoTitle+gameState.gameNumber : MESSAGES.gameOverTitle;

    gameScreen.showGameInfo(title);
    gameScreen.gameInfoContent.innerHTML = getPlayerAcheivements();

    tallyTrophyBonus();
  }
  setTimeout(gameOver, TIMEOUTS.gameOverDelay);
}

function tallyTrophyBonus() {
  if (player.trophiesAwarded <= 0) {
    updateFinalScore();
    return;
  }

  const trophySymbol = Grid.symbolFor("maze-trophy");
  const gameOverAchievementsHtml = gameScreen.gameInfoContent.innerHTML;

  let trophies = 0;
  let bonusPoints = 0;

  function updateFinalScore() {
    player.score = player.exitMazeScore + settings.pointsPerTrophy * player.trophiesAwarded;
    updateGameUI();
    gameScreen.gameInfoContent.innerHTML += `<div>&nbsp;</div><div class='label'>${MESSAGES.finalScore}</div><div class="banner shadowGlow pulse">${player.score}</div>`;

    saveHighScore(settings.highScore);
    gameState.onGameFinished();
  }

  function nextTrophy() {
    if (gameScreen.gameInfoPanel.style.display === 'none') {
      // Game over screen was dismissed
      updateFinalScore();
      return;
    };

    if (trophies === player.trophiesAwarded) {
      // Display final score awarded
      Sound.dingDing();
      updateFinalScore();
    } else {
      // Tally each trophy
      Sound.ding();
      bonusPoints = settings.pointsPerTrophy * (++trophies);
      gameScreen.gameInfoContent.innerHTML = gameOverAchievementsHtml + `<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div><div class='icon'>${trophySymbol.repeat(trophies)}</div><div class='score'>${bonusPoints}</div>`;
      
      gameWindow.setTimeout(nextTrophy, TIMEOUTS.gameOverTrophyTallyInterval);    
    }
  }
  nextTrophy();
}

function getPlayerAcheivements() {
  const list = [];

  if (player.level <= 1) {
    list.push(`<div class='label'>${MESSAGES.relicsFound}</div><div>${MESSAGES.none}</div>`);
  } else {
    list.push(`<div class='label'>${MESSAGES.relicsFound}</div>`);

    let relics = [];
    for (let i = 1; i <  player.level; i++) {
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

  if (player.trophiesAwarded <= 0) {
    list.push(`<div>&nbsp;</div><div class='label'>${MESSAGES.trophyAwarded[1]}</div><div>${MESSAGES.none}</div>`);
  }
  return list.join("");
}

function startGame(seed = 0) {
  gameState.onStartGame(seed);

  if (gameState.gameNumber && seed != gameState.gameNumber) {
    gameState.gameNumber = null;
    deleteGameNumberFromURL();
  }

  settings.setDefaults();
  player.reset();

  gameScreen.showGameUI();
  nextMaze();
}

function playAgain() {
  startGame(gameState.seed);
}

function replayGame() {
  gameScreen.showGameUI();
  replayMaze(0);
}

gameScreen.scoreboardLinks.nextMazeLink.addEventListener("click", goDeeper);
gameScreen.scoreboardLinks.replayMazeLink.addEventListener("click", () => replayMaze(-1));

const player = new Player(CHARACTERS.player, settings);
settings.highScore = getHighScore();

let grid = null;
let characters = [];

const gameState = {

  reset() {
    this.gameOver = false; 
    this.caveInStarted = false;
    this.keysNeeded = 0;
    this.currentLevel = 0;
    this.currentMaze = 0;
    this.levelRelic = null;
    this.relicChamberFormation = null;
    this.playbackSpeed = 1;
    this.gameResult = null;
  },

  get isReplay() {
    return GameRecorder.isReplaying && GameRecorder.hasNextMaze;
  },

  get isLastMaze() {
    return this.currentMaze === settings.mazesPerLevel;
  },

  get isCaveInThreshold() { 
    const pathCount = this.caveInStarted ? grid.pathCount + gameState.random() * 10 : grid.pathCount;
    return pathCount / grid.cellCount > settings.caveInThreshold;
  },

  get sequence() {
    return this.currentLevel * 100 + this.currentMaze;
  },

  get gameSpeed() {
    return GameRecorder.isReplaying ? this.playbackSpeed : 1;
  },

  get gameNumber() {
    return this._gameNumber;
  },

  set gameNumber(value) {
    this._gameNumber = value;

    if (GAME_RNG.isValidGameNumber(value)) {
      this._gameNumber = value;
      this.seed = value;
      GameRecorder.autoSave = true;
    } else {
      this._gameNumber = null;
      GameRecorder.autoSave = false;
    }
  },

  onStartGame(seed) {
    this.reset();

    this.seed = seed;
    this.randomizer = RNG.randomizer(seed);
    this.ticks = 0;

    Timer.setStepInterval(settings.gameStepInterval);

    GameRecorder.startGame(GAME_VERSION, seed, settings.gameStepInterval);
  },

  onGameOver() {
    this.gameOver = true;
  },
    
  onGameFinished() {
    this.gameResult = GameRecorder.addRecord({
      tick: this.ticks,
      currentLevel: this.currentLevel,
      currentMaze: this.currentMaze,
      levelRelic: this.levelRelic?.state,
      randomizerState: this.randomizer.getState(),
      playerState: player.state,
      outcome: "finished"
    });
},

  onNextMaze() {
    this.reset();
  },

  onMazeStart() {
    Timer.clear();
    Keyboard.clear();

    this.random = RNG.randomizer(
      RNG.deriveSeed(this.randomizer.getState())
    );

    GameRecorder.startMaze({
      level: this.currentLevel,
      maze: this.currentMaze,
      tick: this.ticks,
      randomizerState: this.randomizer.getState(),
      playerState: player.state
    });

    gameScreen.replayBar.setCurrentTick(this.ticks);
  },

  onGameStepCompleted(inputMask) {
    GameRecorder.recordGameStep(
      this.ticks,
      inputMask
    );
    gameScreen.replayBar.setCurrentTick(this.ticks);
    this.ticks++;
  },
  
  onMazeExited() {
    GameRecorder.addRecord({
      tick: this.ticks,
      currentLevel: this.currentLevel,
      currentMaze: this.currentMaze,
      levelRelic: this.levelRelic?.state,
      randomizerState: this.randomizer.getState(),
      playerState: player.state,
      outcome: "checkpoint"
    });

    if (this.isReplay) {
      const nextRecording = GameRecorder.selectNextMaze();
      this.replayMazeRecording(nextRecording);
    }
  },

  onReplayMaze(index) {
    return this.replayMazeRecording(GameRecorder.selectMaze(index));
  },

  replayMazeRecording(mazeRecording) {
    if (!mazeRecording) return false;

    this.reset();

    this.currentLevel = mazeRecording.level;
    this.currentMaze = mazeRecording.maze;
    this.ticks = mazeRecording.startTick;
    this.levelRelic = mazeRecording.levelRelic;
    this.playbackSpeed = gameScreen.replayBar.speed;
    this.randomizer = RNG.randomizer(mazeRecording.randomizerState);

    player.state = mazeRecording.playerState;
    startMaze();

    return true;
  },

  updateInputMask() {
    if (GameRecorder.isReplaying) {
      const inputMask = GameRecorder.replayInputMask(this.ticks);
      Keyboard.applyMask(inputMask);
    }
  },

  initWithRecording(recording) {
    this.reset();

    this.seed = recording.seed;
    this.currentLevel = recording.currentLevel;
    this.currentMaze = recording.currentMaze;
    this.levelRelic = recording.levelRelic;
    this.ticks = recording.ticks;
    this.randomizer = RNG.randomizer(recording.randomizerState);

    player.state = recording.playerState;
  },
};

gameScreen.startGame = (seed) => gameWindow.setTimeout(startGame, TIMEOUTS.gameOverTrophyTallyInterval, seed);
gameScreen.playAgain = () => gameWindow.setTimeout(playAgain, TIMEOUTS.gameOverTrophyTallyInterval);
gameScreen.replayGame = () => gameWindow.setTimeout(replayGame, TIMEOUTS.gameOverTrophyTallyInterval);

gameScreen.replayBarHandler = {
    onSelectMaze(index) {
      gameState.onReplayMaze(index);
    },

    onSelectEnd() {
      const recording = GameRecorder.recording;
      if (!recording) return;

      gameState.initWithRecording(recording);
      GameRecorder.selectMaze(-1);

      if (recording.outcome === "finished") {
        playerGameOver();
      } else {
        playerExitMaze();
      }
    },

    onPlayPause(playing) {
      if (gameState.replayPaused === !playing) return false;

      gameState.replayPaused = !playing;
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
      gameState.playbackSpeed = speed;
      return speed;
    }
};

const GAME_NUMBER_PARAM = "game";

function deleteGameNumberFromURL() {
  const url = new URL(gameWindow.location.href);
  const value = url.searchParams.get("game");

  if (value) {
    url.searchParams.delete("game");
    gameWindow.history.replaceState(null, "", url);    
  }
}

function getGameNumberFromURL() {
  const params = new URLSearchParams(gameWindow.location.search);
  const value = params.get("game");

  // Game numbers must be positive whole numbers.
  const gameNumber = Number(value);

  if (!GAME_RNG.isValidGameNumber(gameNumber)) {
    deleteGameNumberFromURL();
    return null;
  }

  return gameNumber;
}

function initGame(gameNumber) {
  if (gameNumber === null) {
    gameScreen.newGame();
    return;
  }

  const savedGame = GameRecorder.load(GAME_VERSION, gameNumber)
    || GameRecorder.load(GAME_VERSION, gameNumber, "checkpoint");

  gameState.gameNumber = gameNumber;

  if (savedGame) {
    Timer.setStepInterval(savedGame.msPerTick);

    gameScreen.replayBarHandler.onSelectEnd();
    gameScreen.showGameMessage(MESSAGES.loading);

    gameWindow.setTimeout(() => {
      gameScreen.hideGameMessage();
      gameScreen.showGameUI(true);
    }, TIMEOUTS.tallyScoreDelay);
  } else if (GAME_RNG.isValidGameNumber(gameNumber)) {
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

