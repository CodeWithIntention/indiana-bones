import { GAME_VERSION, GAME_RNG, MESSAGES, TIMEOUTS } from "./config.js";
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
    seed = GAME_RNG.random();
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

function enterSpiderCave(gameNumber) {
  // Switch screens
  gameScreen.dismissDialog(document.getElementById("bio"));
  
  zoomStartGame(gameNumber);
}

function replayGame() {
  hideGameInfo(true);
  gameScreen.replayGame();
}

function playAgain() {
  hideGameInfo(true);

  if (GAME_RNG.isValidGameNumber(gameScreen.gameInfoContent.gameNumber)) {
    gameScreen.showBio(gameScreen.gameInfoContent.gameNumber);
  } else {
    gameScreen.playAgain();
  }
}

function newGame() {
  hideGameInfo(true);
  gameWindow.requestAnimationFrame(zoomStartGame);
}

function hideGameInfo(hideGameUI = false) {
  if (gameScreen.gameInfoPanel.style.display === 'none') return;
  
  gameScreen.dismissDialog(gameScreen.gameInfoPanel);

  if (hideGameUI === true) {
    mazeGrid.innerHTML = "";
    showGameUI(false);
  }
}

function showGameInfo(title) {
  if (gameScreen.gameInfoPanel.style.display === 'flex') return;
  
  gameScreen.hideReplayBar();

  gameScreen.gameInfoContent.gameNumber = null;
  gameScreen.gameInfoTitle.innerHTML = title;
  gameScreen.gameInfoLinks.playAgainLink.textContent = MESSAGES.playAgain;
  gameScreen.gameInfoLinks.replayGameLink.hidden = false;
  gameScreen.gameInfoLinks.newGameLink.hidden = false;
  
  gameScreen.showDialog(gameScreen.gameInfoPanel);
}

function showScoreboard(title) {
  gameScreen.scoreboard.titleElement.textContent = title;
  gameScreen.scorecard.innerHTML = "";
  gameScreen.scoreboardLinks.style.display = "none";
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
scoreboard.titleElement = gameWindow.document.getElementById("scoreboardTitle"); 

const scorecard = gameWindow.document.getElementById("scorecard");
const gameInfoPanel = gameWindow.document.getElementById("gameInfoPanel"); 
const gameInfoContent = gameWindow.document.getElementById("gameInfoContent");
const gameInfoTitle = gameWindow.document.getElementById("gameInfoTitle");
const gameMessagePanel = gameWindow.document.getElementById("gameMessagePanel"); 
const gameReplayBarPanel = gameWindow.document.getElementById("gameReplayBarPanel"); 
const instructionsPanel = gameWindow.document.getElementById("instructionsPanel"); 

const enterLink = gameWindow.document.getElementById("enterLink");
const gameInfoLinks = gameWindow.document.getElementById("gameInfoLinks");
const scoreboardLinks = gameWindow.document.getElementById("scoreboardLinks");
const dismissInstructionsLink = gameWindow.document.getElementById("dismissInstructionsLink");

gameInfoLinks.replayGameLink = gameWindow.document.getElementById("replayGameLink");
gameInfoLinks.playAgainLink = gameWindow.document.getElementById("playAgainLink");
gameInfoLinks.newGameLink = gameWindow.document.getElementById("newGameLink");

scoreboardLinks.nextMazeLink = gameWindow.document.getElementById("nextMazeLink");
scoreboardLinks.replayMazeLink = gameWindow.document.getElementById("replayMazeLink");

gameInfoLinks.replayGameLink.addEventListener("click", replayGame);
gameInfoLinks.playAgainLink.addEventListener("click", playAgain);
gameInfoLinks.newGameLink.addEventListener("click", newGame);

gameScreen.overlay = overlay;
gameScreen.scoreboard = scoreboard;
gameScreen.scorecard = scorecard;
gameScreen.gameInfoPanel = gameInfoPanel;
gameScreen.instructionsPanel = instructionsPanel;
gameScreen.playerStatusLine = playerStatusLine;
gameScreen.highScoreStatusLine = highScoreStatusLine;
gameScreen.scoreStatusLine = scoreStatusLine;
gameScreen.mazeStatusLine = mazeStatusLine;
gameScreen.bagStatusLine = bagStatusLine;
gameScreen.relicStatusLine = relicStatusLine;
gameScreen.trophyStatusLine = trophyStatusLine;
gameScreen.scoreboardLinks = scoreboardLinks;
gameScreen.gameInfoLinks = gameInfoLinks;
gameScreen.dismissInstructionsLink = dismissInstructionsLink;
gameScreen.gameInfoContent = gameInfoContent;
gameScreen.gameInfoTitle = gameInfoTitle;
gameScreen.gameReplayBarPanel = gameReplayBarPanel;

gameScreen.showGameUI = showGameUI;
gameScreen.showGameMessage = showGameMessage;
gameScreen.hideGameMessage = hideGameMessage;
gameScreen.newGame = newGame;
gameScreen.showGameInfo = showGameInfo;
gameScreen.hideGameInfo = hideGameInfo;
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

gameScreen.showBio = function (gameNumber) {
  enterLink.addEventListener("click", () => enterSpiderCave(gameNumber), { once: true });
  this.showDialog(document.getElementById("bio"));

  gameWindow.requestAnimationFrame(() => {
    document
      .getElementById("bioContent")
      .classList.toggle("open");
  });
}
