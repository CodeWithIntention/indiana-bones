import { Direction, RNG, Timer } from "./util.js";
import { GAME_VERSION, CHARACTERS, OBJECTS, MESSAGES, TIMEOUTS, RELIC_CHAMBERS, MAZE_ITEMS, MAZE_DROPABLES } from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { Character } from "./character.js";
import { Player } from "./player.js";
import { Spider, Scorpion, Cat, Monkey, Mouse, Ghost, Rock, Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { Keyboard } from "./keyboard.js";

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
            attributes.spin = true;
            Sound.yeah();
            gameWindow.setTimeout(tallyScore, TIMEOUTS.tallyScoreDelay);
          }
        } else if (grid.isCharacterAtEntrance(reason)) {
            attributes.entrance = true;
        } else if (gameState.keysNeeded === 0) {
          --gameState.keysNeeded;
          Sound.portal();

          if (gameState.isLastMaze()) {
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
    if (gameState.isCaveInThreshold()) {
      startCaveIn();
    }
  } 
  grid.setCharacterAttributes(reason, attributes);
  updateGameUI();
}

function mazeBonus() {
  return (grid.pathCount - grid.visitedPathCount);
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
      <span>${Grid.symbolFor("maze-bonus")}</span><b>${mazeBonus()}</b>`;
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
  Keyboard.clear();

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
    grid.placeCharacter(player);
    
    if (player.lives === 0) {
      setGameOver();
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

  const mazeBonusPoints = mazeBonus() * settings.pointsPerPath;
  if (mazeBonusPoints !== 0) {
    scores.push(mazeBonusPoints);
    list.push(`<div>${Grid.symbolFor("maze-bonus")} &times; ${mazeBonus()} &times; ${settings.pointsPerPath}</div><div class='score'>${mazeBonusPoints}</div>`);
  }

  if (grid.isMazeCleared && characters.killables().length === 0) {
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

  gameScreen.scorecard.innerHTML = "";
  gameScreen.scoreboardLinks.style.display = "none";
  gameScreen.showDialog(gameScreen.scoreboard);

  let totalScore = 0;
  let scoreIndex = 0;

  const updateScore = () => {
    if (gameScreen.scoreboard.style.display === "none") {
      while (scoreIndex < scores.length) {
        totalScore += scores[scoreIndex++];
      }
      player.score += totalScore;
      return;
    }

    if (scoreIndex < scores.length) {
      const score = scores[scoreIndex++];
      
      totalScore += score;
      gameScreen.scorecard.innerHTML = list.slice(0, scoreIndex).join("");
      Sound.ta_ding();

      gameWindow.setTimeout(updateScore, TIMEOUTS.updateScoreCardInterval);
    } else {
        gameScreen.scoreboardLinks.style.display = "flex";
        
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
            list.push(`<div>${MESSAGES.pointNeedForTrophy} ${trophySymbol}:</div><div class='score'>${pointsNeeded}</div>`);
          } else {
            player.trophiesAwarded += trophiesAwarded;
            list.push(`<div>${MESSAGES.trophyAwarded[trophiesAwarded > 1 ? 1 : 0]}</div><div class='score'>${trophySymbol.repeat(trophiesAwarded)}</div>`);
            list.push(`<div>${MESSAGES.pointNeedForNextTrophy} ${trophySymbol}:</div><div class='score'>${pointsNeeded}</div>`);
          }
          gameScreen.scorecard.innerHTML = list.join("");
          player.score += totalScore;
          Sound.ding();
          gameWindow.setTimeout(updateGameUI, TIMEOUTS.updateScoreCardInterval);
        }
    }
  }
  updateScore();
}

function replayMaze() {
  gameScreen.dismissDialog(gameScreen.scoreboard);
  gameState.onReplayMaze();
  startMaze();
}

function goDeeper() {
  gameScreen.dismissDialog(gameScreen.scoreboard);

  player.row = grid.rows-1;
  player.col = grid.cols-1;
  
  grid.setCharacterAttributes(player, {down: true, flatten: true});
  grid.placeCharacter(player);
  Sound.deeper();

  gameWindow.setTimeout(nextMaze, TIMEOUTS.nextMazeDelay);
}

function nextMaze() {
  gameScreen.dismissDialog(gameScreen.scoreboard);
  gameState.onNextMaze();

  gameState.currentLevel = Math.floor(player.mazes / settings.mazesPerLevel)+1;
  gameState.currentMaze = (player.mazes % settings.mazesPerLevel)+1;
  player.mazes++;
  
  gameScreen.showInstructions(player.mazes === 1);
  startMaze();
}

function startMaze() {
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

  if (gameState.isLastMaze()) {
    gameState.relicChamberFormation = RELIC_CHAMBERS[Math.min(player.level-1, RELIC_CHAMBERS.length-1)];
    grid.placeObjectFormation(gameState.relicChamberFormation, OBJECTS.edge, {});
  }

  grid.addCharacter(player);
  setupCharacters();

  if (gameState.isLastMaze()) {
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
    const mazes = player.mazes;
    let lastTime = 0;
    let timeSlice = 0;

    Keyboard.clear();
    Timer.clear();

    function gameLoop(time) {
      function canContinue() {
        return !(gameState.gameOver || player.isBuried || player.exitMaze || mazes !== player.mazes);
      }

      if (!canContinue()) return;

      if (Keyboard.NextMaze) {
        Keyboard.NextMaze = false;
        gameState.onMazeExited();
        nextMaze();
        return;
      }

      if (lastTime === 0) {
        lastTime = time;
      }
      timeSlice += Math.min(settings.maxTimeSlice, time-lastTime);
      lastTime = time;

      while (timeSlice >= settings.gameStepInterval && canContinue()) {
        timeSlice -= settings.gameStepInterval;
        const delta = settings.gameStepInterval/1000;
        playGameStep(delta);
      }

      if (canContinue()) {
          gameWindow.requestAnimationFrame(gameLoop);
      } else {
        gameState.onMazeExited();
      }
    }
    gameWindow.requestAnimationFrame(gameLoop);
}

function playGameStep(delta) {
  Timer.update(gameState.ticks);
  
  if (gameState.isReplaying) {
    const inputMask = gameState.replayInputMask();
    Keyboard.applyMask(inputMask);
  }

  const inputMask = handleInput(gameState.ticks);

  movePlayer(getMoveDirection(), delta);
  moveCharacters(delta);

  gameState.onGameStepCompleted(inputMask);
}

function handleInput() {
    const inputMask = Keyboard.mask();

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

function setGameOver() {
  Sound.gameover();
  gameScreen.showGameOver(gameState);

  gameWindow.requestAnimationFrame(tallyTrophyBonus);
}

function tallyTrophyBonus() {
  if (player.trophiesAwarded <= 0) {
    updateFinalScore();
    return;
  }

  const trophySymbol = Grid.symbolFor("maze-trophy");
  let trophies = 0;
  let bonusPoints = 0;

  function updateFinalScore() {
    player.score += settings.pointsPerTrophy * player.trophiesAwarded;
    updateGameUI();
    gameScreen.gameOverTrophyBonus.innerHTML += `<div>${MESSAGES.finalScore}</div><div class="shadowGlow pulse">${player.score}</div>`;
    gameState.onGameOver(settings.highScore);
  }

  function nextTrophy() {
    if (gameScreen.gameOverPanel.style.display === 'none') {
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
      gameScreen.gameOverTrophyBonus.innerHTML = `<div>${trophySymbol.repeat(trophies)} &equals; ${bonusPoints}</div>`;
      gameWindow.setTimeout(nextTrophy, TIMEOUTS.gameOverTrophyTallyInterval);    
    }
  }
  nextTrophy();
}

function startGame(seed = 0) {
  gameState.onStartGame(seed);

  settings.setDefaults();
  player.reset();

  Timer.setStepInterval(settings.gameStepInterval);

  gameScreen.showGameUI();
  nextMaze();
}

function playAgain() {
  startGame(gameState.seed);
}

function replayGame() {

}

function replayFinalMaze() {
  gameScreen.showGameUI();
  replayMaze();
}

gameScreen.scoreboardLinks.nextMazeLink.addEventListener("click", goDeeper);
gameScreen.scoreboardLinks.replayMazeLink.addEventListener("click", replayMaze);

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
    
    this.isReplaying = false;
    this.mazeRecording = null;
    this.gameSteps = null;
    this.replayStep = null;
  },

  onStartGame(seed) {
    this.seed = seed;
    this.randomizer = RNG.randomizer(seed);
    this.ticks = 0;

    Timer.reset();

    this.gameRecording = {
      version: GAME_VERSION,
      seed: seed,
      mazeRecordings: [],
    };

    this.reset();
  },

  onGameOver(highScore) {
    this.gameOver = true;
    saveHighScore(highScore);

    this.gameRecording.ticks = this.ticks;
    this.gameRecording.playerState = player.state;
    this.gameRecording.currentLevel = this.currentLevel;
    this.gameRecording.currentMaze = this.currentMaze;
  },

  onNextMaze() {
    this.reset();
  },

  onMazeStart() {
    this.random = RNG.randomizer(RNG.deriveSeed(this.randomizer.getState()));
    if (this.isReplaying) return;
  
    this.mazeRecording = {
      level: this.currentLevel,
      maze: this.currentMaze,
      randomizerState: this.randomizer.getState(),
      ticks: this.ticks,
      playerState: player.state,
      gameSteps: null
    }
  },

  onGameStepCompleted(inputMask) {
    if (!this.isReplaying) {
      if (this.gameSteps === null) {
        this.gameSteps = [[this.ticks, inputMask]];
      } else if (this.gameSteps.at(-1)[1] != inputMask) {
        this.gameSteps.push([this.ticks, inputMask]);
      }
    }
    this.ticks++;
  },
  
  onMazeExited() {
    if (this.mazeRecording) {
      this.mazeRecording.gameSteps = this.gameSteps;
      this.gameRecording.mazeRecordings.push(this.mazeRecording);
      this.mazeRecording = null;
    }
  },

  onReplayMaze() {
    this.reset();
    const mazeRecording = this.gameRecording.mazeRecordings.at(-1);

    if (mazeRecording) {
      this.isReplaying = true;
      this.currentLevel = mazeRecording.level;
      this.currentMaze = mazeRecording.maze;
      this.ticks = mazeRecording.ticks;
      this.gameSteps = mazeRecording.gameSteps.toReversed();
      this.randomizer = RNG.randomizer(mazeRecording.randomizerState);
      player.state = mazeRecording.playerState;
    }
  },

  replayInputMask() {
    if (!this.isReplaying) return 0;

    if (this.gameSteps.length > 0 && this.gameSteps.at(-1)[0] === this.ticks) {
      this.replayStep = this.gameSteps.pop();
    }
    return this.replayStep && this.replayStep[1] || 0;
  },

  isLastMaze() {
    return this.currentMaze === settings.mazesPerLevel;
  },

  isCaveInThreshold() { 
    const pathCount = this.caveInStarted ? grid.pathCount + gameState.random() * 10 : grid.pathCount;
    return pathCount / grid.cellCount > settings.caveInThreshold;
  },
};

gameScreen.startGame = (seed) => gameWindow.setTimeout(startGame, TIMEOUTS.gameOverTrophyTallyInterval, seed);
gameScreen.replayGame = () => gameWindow.setTimeout(replayGame, TIMEOUTS.gameOverTrophyTallyInterval);
gameScreen.playAgain = () => gameWindow.setTimeout(playAgain, TIMEOUTS.gameOverTrophyTallyInterval);
gameScreen.replayFinalMaze = () => gameWindow.setTimeout(replayFinalMaze, TIMEOUTS.gameOverTrophyTallyInterval);
