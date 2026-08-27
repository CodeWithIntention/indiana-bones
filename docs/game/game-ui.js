import { MESSAGES, TIMEOUTS } from "./config.js";
import { Sound } from "./sound.js";
import { Keyboard } from "./keyboard.js";
import { Touch } from "./touch.js";
import { Controller } from "./controller.js";
import { Dialog } from "./dialog.js";
import { ReplayBar } from "./replaybar.js";

export { gameWindow, gameScreen }

function showGameUI(show = true) {
  const hide = !show;

  gameScreen.hidden = hide;
  playerStatusLine.hidden = hide;
  scoreStatusLine.hidden = hide;
  mazeStatusLine.hidden = hide;

  bagStatusLine.style.display = show ? 'flex' : 'none';
  relicStatusLine.style.display = show ? 'flex' : 'none';
  trophyStatusLine.style.display = show ? 'flex' : 'none';
  dashboard.style.display = show ? 'flex' : 'none';
}

let startingGame = false;

function zoomStartGame(seed) {
  if (startingGame) return;

  if (!Number.isFinite(seed)) {
    seed = Math.random() * 1_000_000 + 1;
  }
  startingGame = true;

  // Set style for game screen zoom in 
  gameScreen.classList.add("zoomIn");
  gameScreen.hidden = false;
  Sound.intro();

  // While intro is playing, request the next frame
  gameWindow.requestAnimationFrame(() => {
    // Trigger zoom in effect
    gameScreen.classList.add("expanded", "spin", "zoom");

    // Wait for intro to play and zoom to occur before
    // starting the game.
    setTimeout(() => {
      gameScreen.classList.remove("zoomIn", "expanded", "spin", "zoom");
      gameWindow.requestAnimationFrame(() => {
        startingGame = false;
        gameScreen.startGame(seed);
    });
    }, TIMEOUTS.startGameZoomDuration);
  });
}

function enterSpiderCave(source) {
  // Switch screens
  gameScreen.dismissDialog(document.getElementById("bio"));
  zoomStartGame();
}

function replayGame() {
  hideGameOver(true);
  gameScreen.replayGame();
}

function playAgain() {
  hideGameOver(true);
  gameScreen.playAgain()
}

function newGame() {
  hideGameOver(true);
  gameScreen.hideReplayBar();
  gameWindow.requestAnimationFrame(zoomStartGame);
}

function hideGameOver(hideGameUI = false) {
  if (gameScreen.gameOverPanel.style.display === 'none') return;
  
  gameScreen.dismissDialog(gameOverPanel);

  if (hideGameUI === true) {
    mazeGrid.innerHTML = "";
    showGameUI(false);
  }
}

function showGameOver(replay = false) {
  if (gameScreen.gameOverPanel.style.display === 'flex') return;
  
  gameScreen.gameOverAchievements.innerHTML = "";

  if (replay === true) {
    gameScreen.gameOverLinks.replayGameLink.hidden = true;
  } else {
    gameScreen.gameOverLinks.replayGameLink.hidden = false;
    gameScreen.hideReplayBar();
  }
  gameScreen.showDialog(gameOverPanel);
  showInstructions(false);
}

function showScoreboard(replay = false) {
  gameScreen.scorecard.innerHTML = "";
  gameScreen.scoreboardLinks.style.display = "none";
  gameScreen.scoreboardLinks.replayMazeLink.hidden = replay;
  
  gameScreen.showDialog(gameScreen.scoreboard);
}

function hideScoreboard() {
  gameScreen.dismissDialog(gameScreen.scoreboard);
}

function showGameMessage(text, duration = 0) {
  if (text) {
    gameMessagePanel.style.display = 'flex';
    gameMessagePanel.textContent = text;

    if (duration > 0) {
      setTimeout(hideGameMessage, duration, text);
    }
  } else {
    hideGameMessage();
  }
}

function hideGameMessage(text) {
    if (text && text !== gameMessagePanel.textContent) return;

    gameMessagePanel.style.display = 'none';
    gameMessagePanel.textContent = "";
}

function showInstructions(show) {
  if (gameScreen.instructionsPanel.dismissed === true) return;

  gameScreen.instructionsPanel.dismissed = !show;
  gameScreen.instructionsPanel.style.display =  show ? 'flex' : 'none';
}

const gameWindow = window;

const gameScreen = gameWindow.document.getElementById("game");
const mazeGrid = gameWindow.document.getElementById("maze");
const overlay = gameWindow.document.getElementById("overlay");
const dashboard = gameWindow.document.getElementById("dashboard");
const bioMessage = gameWindow.document.getElementById("bio");

const playerStatusLine = gameWindow.document.getElementById("playerStatusLine");
const highScoreStatusLine = gameWindow.document.getElementById("highScoreStatusLine");
const scoreStatusLine = gameWindow.document.getElementById("scoreStatusLine");
const mazeStatusLine = gameWindow.document.getElementById("mazeStatusLine");
const bagStatusLine = gameWindow.document.getElementById("bagStatusLine");
const relicStatusLine = gameWindow.document.getElementById("relicStatusLine");
const trophyStatusLine = gameWindow.document.getElementById("trophyStatusLine");

const scoreboard = gameWindow.document.getElementById("scoreboard"); 
const scorecard = gameWindow.document.getElementById("scorecard");
const gameOverPanel = gameWindow.document.getElementById("gameOverPanel"); 
const gameOverAchievements = gameWindow.document.getElementById("gameOverAchievements");
const gameMessagePanel = gameWindow.document.getElementById("gameMessagePanel"); 
const gameReplayBarPanel = gameWindow.document.getElementById("gameReplayBarPanel"); 
const instructionsPanel = gameWindow.document.getElementById("instructionsPanel"); 

const enterLink = gameWindow.document.getElementById("enterLink");
const gameOverLinks = gameWindow.document.getElementById("gameOverLinks");
const scoreboardLinks = gameWindow.document.getElementById("scoreboardLinks");
const dismissInstructionsLink = gameWindow.document.getElementById("dismissInstructionsLink");

gameOverLinks.replayGameLink = gameWindow.document.getElementById("replayGameLink");
gameOverLinks.playAgainLink = gameWindow.document.getElementById("playAgainLink");
gameOverLinks.newGameLink = gameWindow.document.getElementById("newGameLink");

scoreboardLinks.nextMazeLink = gameWindow.document.getElementById("nextMazeLink");
scoreboardLinks.replayMazeLink = gameWindow.document.getElementById("replayMazeLink");

gameOverLinks.replayGameLink.addEventListener("click", replayGame);
gameOverLinks.playAgainLink.addEventListener("click", playAgain);
gameOverLinks.newGameLink.addEventListener("click", newGame);

gameScreen.overlay = overlay;
gameScreen.scoreboard = scoreboard;
gameScreen.scorecard = scorecard;
gameScreen.gameOverPanel = gameOverPanel;
gameScreen.instructionsPanel = instructionsPanel;
gameScreen.playerStatusLine = playerStatusLine;
gameScreen.highScoreStatusLine = highScoreStatusLine;
gameScreen.scoreStatusLine = scoreStatusLine;
gameScreen.mazeStatusLine = mazeStatusLine;
gameScreen.bagStatusLine = bagStatusLine;
gameScreen.relicStatusLine = relicStatusLine;
gameScreen.trophyStatusLine = trophyStatusLine;
gameScreen.scoreboardLinks = scoreboardLinks;
gameScreen.gameOverLinks = gameOverLinks;
gameScreen.dismissInstructionsLink = dismissInstructionsLink;
gameScreen.gameOverAchievements = gameOverAchievements;
gameScreen.gameReplayBarPanel = gameReplayBarPanel;

gameScreen.showGameUI = showGameUI;
gameScreen.showGameMessage = showGameMessage;
gameScreen.hideGameMessage = hideGameMessage;
gameScreen.newGame = newGame;
gameScreen.showGameOver = showGameOver;
gameScreen.hideGameOver = hideGameOver;
gameScreen.showInstructions = showInstructions;
gameScreen.showScoreboard = showScoreboard;
gameScreen.hideScoreboard = hideScoreboard;

gameScreen.dismissInstructionsLink.addEventListener("click", () => showInstructions(false));

gameScreen.DialogEvents = {
  show: {name: "showdialog"},
  dismiss: {name: "dismissdialog"}
}

gameScreen.showDialog = function (dialog, display = 'flex') {
  if (!(dialog && dialog.style) || dialog.style.display === display) return;

  dialog.style.display = display;

  gameWindow.requestAnimationFrame(() => {
    this.DialogEvents.show.dispatch(dialog);
  });
}

gameScreen.dismissDialog = function (dialog, display = 'none') {
  if (!(dialog && dialog.style) || dialog.style.display === display) return;

  dialog.style.display = display;

  gameWindow.requestAnimationFrame(() => {
    this.DialogEvents.dismiss.dispatch(dialog);
  });
}

Object.values(gameScreen.DialogEvents).forEach(value => {
  value.dispatch = (dialog) => gameScreen.dispatchEvent(new CustomEvent(value.name, {detail: {dialog}}));
});

/*
 Initialize libraries
 */
Keyboard.initWith(gameWindow);
Controller.initWith(gameWindow);
Touch.initWith(gameScreen);
Dialog.initWith(gameScreen);

/*
 * Initialize ReplayBar
 */

gameScreen.replayBar = new ReplayBar(
  "#gameReplayBarPanel",
  {
    onSelectMaze(index) {
      gameScreen.replayBarHandler?.onSelectMaze(index);
    },

    onSelectEnd() {
      gameScreen.replayBarHandler?.onSelectEnd();
    },

    onPlayPause(playing) {
      gameScreen.replayBarHandler?.onPlayPause(playing);
    },

    onStop() {
      gameScreen.replayBarHandler?.onStop();
    },

    onSpeedChange(speed) {
      gameScreen.replayBarHandler?.onSpeedChange(speed);
    }
  }
);

gameScreen.setReplayRecording = function (timeline) {
  this.replayBar.setRecording(timeline);
  this.replayBar.setPlaying(true);
  this.gameReplayBarPanel.hidden = false;
}

gameScreen.hideReplayBar = function () {
  this.gameReplayBarPanel.hidden = true;
}

// Display IB Bio on initial load
gameScreen.showDialog(document.getElementById("bio"));
gameWindow.requestAnimationFrame(() => {
  document.getElementById("bioContent").classList.toggle("open");
});
enterLink.addEventListener("click", enterSpiderCave);
