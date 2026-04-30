import { Direction } from "./util.js";
import { CHARACTERS, OBJECTS, MESSAGES, TIMEOUTS } from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { Character } from "./character.js";
import { Player } from "./player.js";
import { Spider, Scorpion, Cat, Monkey, Mouse, Rat } from "./characters.js";
import { Grid } from "./grid.js";
import { gameWindow, gameScreen } from "./game-ui.js";

export { keysPressed };


Grid.canMoveTo = (row, col, isPlayer = false) => {
  const object = grid.objectAt(row, col);
  if (object === null || object === OBJECTS.wall || object === OBJECTS.edge) return false;
  if ((object === OBJECTS.gem || object === OBJECTS.exit) && !isPlayer) return false;

  return true;
}

Grid.onCharacterMoved =  (character) => {
  if (character === player) {
    onPlayerMoved();
  } else if (character.canDrop && grid.objectAt(character.row, character.col) === OBJECTS.path) {
    grid.placeObjectAt(character.row, character.col, character.dropObject);
  }
}

function findRandomPathCell(inWalls = false) {
  while (true) {
    const row = Math.floor(Math.random() * grid.rows);
    const col = Math.floor(Math.random() * grid.cols);
    const obj = grid.objectAt(row, col);

    if (!((inWalls ? OBJECTS.wall : OBJECTS.path) === obj)) continue;
    if (row === player.row && col === player.col) continue;
    if (characters.atRowCol(row, col)) continue;

    return { row, col };
  }
}

function updateGameState(reason) {
  if (reason instanceof Player) {
    const attributes = {entrance: false, spin: false, powerup: false, dead: false, buried: false, webbed: false, pooped: false};

    if (reason.isAlive) {
        attributes[reason.speedReductionReason] = reason.isReducedSpeed;
        attributes.powerup = reason.powerUp;

        if (grid.objectAt(reason) === OBJECTS.exit) {
            player.exitMaze = true;
            attributes.spin = true;

            Sound.yeah();
            setTimeout(tallyScore, TIMEOUTS.tallyScoreDelay);
        } else if (grid.isCharacterAtEntrance(reason)) {
            attributes.entrance = true;
        }
    } else if (reason.canRespawn) {
        attributes.dead = true;
    } else {
        attributes.buried = true;
    }
    grid.setCharacterAttributes(reason, attributes);
    updatePlayerStatusLine();
  }
}

function updatePlayerStatusLine() {
    let list = [];

    if (player.previousLives > 0 && player.lives > player.previousLives) {
      Sound.dingDing();
    }
    player.previousLives = player.lives;

    list.push(`${Grid.symbolFor(player.kind)}`.repeat(player.lives));
    list.push(`${Grid.symbolFor(OBJECTS.tnt.kind)}<b>${player.tnts}</b>`);
    gameScreen.playerStatusLine.innerHTML = list.join("&nbsp;");

    list = [];
    Object.entries(OBJECTS).forEach(([kind, object]) => {
      const count = player.countInBag(object);
      if (count > 0) {
        list.push(`${Grid.symbolFor(kind)}<b>${count}</b>`);
      }
    });

    Object.entries(CHARACTERS).forEach(([kind, object]) => {
      const count = player.countInBag(object);
      if (count > 0) {
        list.push(`${Grid.symbolFor(kind)}<b>${count}</b>`);
      }
    });

    if (player.score > settings.highScore) {
      settings.highScore = player.score;
    }

    gameScreen.bagStatusLine.innerHTML = list.join("&nbsp;");

    gameScreen.scoreStatusLine.classList.toggle("minus", player.score < 0);
    gameScreen.scoreStatusLine.textContent = `${Math.abs(player.score)}`

    gameScreen.highScoreStatusLine.classList.toggle("minus", settings.highScore < 0);
    gameScreen.highScoreStatusLine.textContent = `${Math.abs(settings.highScore)}`;
}

function playerTNT() {
  if (player.powerUp || !(player.isAlive && player.removeTNT())) return false;

  const blastArea = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  Sound.tnt();

  const playerRect = grid.cellRectAtRowCol(player.row, player.col);
  const rectTopLeft = grid.cellRectAtRowCol(player.row-1, player.col-1) || playerRect;
  const rectBottomRight = grid.cellRectAtRowCol(player.row+1, player.col+1) || playerRect;
  const blastRect = {top: rectTopLeft.top, left: rectTopLeft.left, bottom: rectBottomRight.bottom, right: rectBottomRight.right};

  characters.forEach((character) => {
      if (grid.hasCharacterCollidedWithRect(character, blastRect)) {
        onCharacterBlownUp(character);
      }
    });

  blastArea.forEach((rc) => {
    const row = player.row + rc[0];
    const col = player.col + rc[1];
    const mazeObjAtRowCol = grid.objectAt(row, col);

    if (!(mazeObjAtRowCol === OBJECTS.edge || mazeObjAtRowCol === OBJECTS.exit)) {
      grid.placeObjectAt(row, col, OBJECTS.path);
    }
  });
  updatePlayerStatusLine();
}

function onCharacterBlownUp(character) {
  if (character.canKill(player)) {
    addScoreForCharacter(character, settings.blownUpPointsFactor);

    if (character.priority === 1) {
      character.disabled = true;
      const disabledTime = character.disabledTime;

      setTimeout(() => {
        if (disabledTime === character.disabledTime) {
          character.disabled = false;
        }
      }, settings.blowUpRecoveryDuration);
      return;
    } 
  } else {
    addScoreForCharacter(character, -1);
  }
  characters.remove(character);
}

function addScoreForCharacter(character, factor) {
  if (Number.isFinite(character.points)) {
    // Only half the value is given for chomping
    const points = character.points * factor;
    player.score += points;
    grid.addScoreCharacterFor(character, points, TIMEOUTS.characterPointsLabel);
  }
}

function playerRespawn() {
  if (!player.canRespawn) return false;

  player.respawn();
  Sound.respawn();
  keysPressed.clear();

  updateGameState(player);
  return true;
}

function playerChomp(object) {
  if (object instanceof Character) {
      if (!object.isChompable) return;

      characters.remove(object);
      addScoreForCharacter(object, settings.chompPointsFactor);

      const chompSound = object.chompSound;
      if (chompSound) {
          Sound[chompSound]();
      }
  }
  Sound.chomp();
}

function playerGrab(object) {
    if (object instanceof Character && object.isGrabable) {
      characters.remove(object);
      player.putInBag(object.config);
    } else if (Number.isFinite(object.points)) {
      player.putInBag(object);
    }

    const speedReduction = object.speedReduction;
    if (speedReduction) {
        player.reduceSpeedBy(speedReduction, object.speedReductionReason);
    }

    const grabSound = object.grabSound;
    if (grabSound && Sound[grabSound]) {
        Sound[grabSound]();
    }

    if (object === OBJECTS.fountain) {
        player.powerUp = true;
        const powerUpTime = player.powerUpTime;

        setTimeout(() => {
          if (powerUpTime === player.powerUpTime) {
            player.powerUp = false;
            updateGameState(player);
          }
        }, player.powerUpDuration);
    }
}

function playerKilled() {
    player.die();

    if (player.lives === 0) {
      setGameOver();
    } else {
      Sound.dead();
    }
}

function onPlayerMoved() {
    const object = grid.objectAt(player.row, player.col);
    
    if (object && object !== OBJECTS.path && object !== OBJECTS.exit) {
        if (player.powerUp) {
            playerChomp(object);
        } else {
            playerGrab(object);
        }
        grid.placeObjectAt(player.row, player.col, OBJECTS.path);
    }
    updateGameState(player);
}

function onPlayerCollide(character) {
  if (!(character instanceof Character && player.isAlive)) return;

  if (player.powerUp) {
    playerChomp(character);
  } else if (character.canKill(player)) {
    playerKilled();
  } else {
    playerGrab(character);
  }
  updateGameState(player);
}

function render() {
  grid.render((cell, row, col) => {
  });
}

function movePlayer(direction, delta) {
  if (!player.isAlive) return;

  // This is where player is at
  const currentRow = player.row;
  const currentCol = player.col;

    // This is where player is going
  const nextRow = currentRow + direction[0];
  const nextCol = currentCol + direction[1];

  if (Direction.isNone(player.direction) && currentRow === 1 && currentCol === 0 
    && Grid.canMoveTo(nextRow, nextCol, true)) {
    player.row = nextRow;
    player.col = nextCol;
    grid.placeCharacter(player);
    onPlayerMoved();
  } else {
    grid.moveCharacter(player, direction, delta, nextRow, nextCol);
  }
}

function moveCharacters(delta) {
  characters.forEach(character => moveCharacter(character, delta));
}

function moveCharacter(character, delta) {
  if (character.disabled === true) return;

  if (grid.isCharacterEnroute(character, delta)) {
    if (grid.haveCollided(player, character)) {
      onPlayerCollide(character);
    }
    return;
  }

  const directions = [
    Direction.LEFT,
    Direction.RIGHT,
    Direction.UP,
    Direction.DOWN
  ];

  function getDirections(direction) {
    // The default is to pick a random direction
    Direction.shuffle(directions);
    const dirs = [Direction.NONE, ...directions];

    // If the character is already moving in a direction, then favor
    // that before the randomized ones.
    if (Direction.isGood(direction)) {
        const canSeePlayer = grid.canCharacterSeeTheOther(character, player);

        // Cats run from player and spiders run from power player, so don't
        // favor the current direction the player is visible.
        if (!canSeePlayer || !(character.priority === 3 || character.priority === 2 && player.powerUp)) {
            dirs.push(direction);
        }

        // Don't introduce a random turn if a scorpion sees the player
        if (!(character.priority === 1 && canSeePlayer)) {
            // Add a random turn before the perferred direction.
            const randomTurnIndex = Math.floor(Math.random()*2);
            dirs.push(Direction.turnsFor(direction)[randomTurnIndex]);
        }

        // Hunt down the player by favoring the direction to get to the player.
        // The vision distance is random up to on the player's level.
        if (character.canKill(player) && player.isAlive && Math.random() * (settings.oddsOfBeingHunted + characters.killers(player).length) < 1) {
          const huntDistance = Math.random() * character.manhattanDistanceTo(player) + Math.random() * player.level;
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

  while (dirs.length > 0) {
    const direction = dirs.pop();

    if (Direction.isGood(direction)) {
      const nextRow = character.row + direction[0];
      const nextCol = character.col + direction[1];

      // Scorpions have same freedom of movement as player
      const highPriority = character.priority === 1;
      if (Grid.canMoveTo(nextRow, nextCol, highPriority)) {
          grid.moveCharacter(character, direction, delta, nextRow, nextCol);
          break;
      }
    }
  }
  if (grid.haveCollided(player, character)) {
    onPlayerCollide(character);
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

  if (grid.isMazeCleared && characters.length === 0) {
    const points = settings.mazeClearedBonusPoints * player.level;
    scores.push(points);
    list.push(`<div>${MESSAGES.mazeClearedBonus} level &times; ${settings.mazeClearedBonusPoints}</div><div class='score'>${points}</div>`);
  }

  gameScreen.scorecard.innerHTML = "";
  gameScreen.nextMazeLink.hidden = true;
  gameScreen.scoreboard.style.display = "flex";

  let totalScore = 0;
  let scoreIndex = 0;

  const updateScore = () => {
    if (scoreIndex < scores.length) {
      const score = scores[scoreIndex++];
      
      totalScore += score;
      gameScreen.scorecard.innerHTML = list.slice(0, scoreIndex).join("");
      Sound.ta_ding();

      setTimeout(updateScore, TIMEOUTS.updateScoreCardInterval);
    } else {
        gameScreen.nextMazeLink.hidden = false;

        if (totalScore === 0) {
          gameScreen.scorecard.innerHTML = "<div>You came out empty this time.</div><div class='score'>😐</div>";
          Sound.alert();
        } else {
          gameScreen.scorecard.innerHTML = list.join("") + `<div style='justify-self: right'>Total:</div><div class='score'>${totalScore}</div>`;
          player.score += totalScore;
          Sound.ding();
        }
    }
  }
  updateScore();
}

function goDeeper() {
  gameScreen.scoreboard.style.display = "none";

  player.row = grid.rows-1;
  player.col = grid.cols-1;
  
  grid.setCharacterAttributes(player, {down: true, flatten: true});
  grid.placeCharacter(player);
  Sound.deeper();

  setTimeout(nextMaze, TIMEOUTS.nextMazeDelay);
}

function nextMaze() {
  gameScreen.scoreboard.style.display = "none";

  const currentLevel = Math.floor(player.mazes / settings.mazesPerLevel)+1;
  const currentMaze = player.mazes % settings.mazesPerLevel;
  
  player.mazes++;
  
  if (currentLevel > player.level) {
    player.level = currentLevel;
    Sound.level();
  } else if (currentMaze > 0) {
    if (currentMaze & 1) {
      settings.rows = Math.min(settings.rows + 2, settings.maxRows);
    } else {
      settings.cols = Math.min(settings.rows, settings.maxCols);
    }

    Sound.maze();
  } else if (currentMaze === 0) {
    Sound.level();
  }

  grid = new Grid(settings.rows, settings.cols, settings.cellSize);
  player.restart();
  grid.addCharacter(player);

  setupCharacters();

  mazeStatusLine.innerHTML = `<b>LEVEL ${currentLevel} - ${currentMaze+1}</b?`;

  [player, ...characters].forEach(character => {
      // Negative speed is not sped up. 
      if (character.speed > 0) {
        character.speed += player.level * settings.speedUpRatePerLevel * character.speed;
      }
  });

  dismissInstructions(player.mazes > 1);

  gameWindow.focus();
  render();
  updateGameState(player);
  play();
}

function play() {
    let lastTime = gameWindow.document.timeline.currentTime;
    const mazes = player.mazes;

    keysPressed.clear();

    function gameLoop(time) {
        if (gameOver || player.exitMaze || mazes !== player.mazes) return;

        const delta = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;

        movePlayer(getMoveDirection(), delta);
        moveCharacters(delta);

        if (keysPressed.NextMaze) {
          keysPressed.NextMaze = false;
          nextMaze();
          return;
        }

        if (!player.exitMaze || gameOver) {
            handleKeyEvents();
            gameWindow.requestAnimationFrame(gameLoop);
        }
    }
    gameWindow.requestAnimationFrame(gameLoop);
}

function handleKeyEvents() {
    if (keysPressed.Space) {
        if (player.isAlive) {
            playerTNT();
        } else {
            playerRespawn();
        }
        // Don't let it repeat
        keysPressed.Space = false;
    }
}

function getMoveDirection() {
  if (keysPressed.ArrowLeft)  return Direction.LEFT;
  if (keysPressed.ArrowRight) return Direction.RIGHT;
  if (keysPressed.ArrowUp)    return Direction.UP;
  if (keysPressed.ArrowDown)  return Direction.DOWN;

  return player.direction;
}

function setupCharacters() {
    characters = [];

    characters.characterIndex = (character) => {
        return characters.findIndex((element) => character === element);
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
  
    Object.values(CHARACTERS).forEach(createCharacters);
    Object.values(OBJECTS).forEach(dropItems);
}

function createCharacters(config) {
    if (!(config.class && config.qty)) return;

    let count = config.qty(player.level);

    while (count-- > 0) {
        const characterType = config.class;

        const position = findRandomPathCell();
        const character = new characterType(position);
        characters.add(character);
    }
}

function dropItems(config) {
    if (config.fixed || !config.qty) return;

    let count = config.qty(player.level);

    while (count-- > 0) {
      const position = findRandomPathCell(config.inWalls);
      grid.placeObjectAt(position.row, position.col, config);
    }
}

function saveHighScore(highScore) {
  localStorage.setItem("indiana-bones-high-score", String(highScore));
}

function getHighScore() {
  return Number(localStorage.getItem("indiana-bones-high-score")) || 0;
}

function startGame() {
  gameOver = false;

  settings.setDefaults();
  player.reset();

  gameScreen.showGameUI();
  nextMaze();
}

function setGameOver() {
  gameScreen.restartGamePanel.style.display = 'flex';
  dismissInstructions();

  gameOver = true;
  Sound.gameover();
  saveHighScore(settings.highScore);
}

function dismissInstructions(dismiss = true) {
  if (gameScreen.instructionsPanel.dismissed === true) return;
  gameScreen.instructionsPanel.dismissed = dismiss;
  gameScreen.instructionsPanel.style.display =  dismiss ? 'none' : 'flex';
}

const keysPressed = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    NextMaze: false,
}

keysPressed.clear = () => {
  Object.entries(keysPressed).forEach(([key, value]) => typeof(value) === "boolean" && (keysPressed[key] = false));
}

function onKeyEvent(event, pressed) {
    if (pressed && event.code === "Space") {
      if (gameOver) {
        gameScreen.restartGame();
        return;
      } else if (player.exitMaze && scoreboard.style.display !== 'none') {
        goDeeper();
        return;
      }
    }

    if (event.key === " " && event.code === "Space") {
      event.preventDefault();
      keysPressed[event.code] = pressed;
    } if (typeof keysPressed[event.key] !== "undefined") {
      event.preventDefault();
      keysPressed[event.key] = pressed;
    }

    if (!pressed && event.key === "Control" && event.location === 2) {
      keysPressed.NextMaze = event.shiftKey && event.altKey && event.ctrlKey;
    } else {
      keysPressed.NextMaze = false;
    }
}

gameWindow.document.addEventListener("keydown", e => onKeyEvent(e, true));
gameWindow.document.addEventListener("keyup", e => onKeyEvent(e, false));

gameScreen.nextMazeLink.addEventListener("click", goDeeper);
gameScreen.dismissInstructionsLink.addEventListener("click", () => dismissInstructions());

const player = new Player(CHARACTERS.player, settings);
settings.highScore = getHighScore();

let grid = null;
let characters = [];
let gameOver = false;

gameScreen.startGame = startGame;
