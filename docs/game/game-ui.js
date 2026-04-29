import { MESSAGES, TIMEOUTS } from "./config.js";
import { Sound } from "./sound.js";

export { gameWindow, gameScreen }

function showGameUI(show = true) {
  const hide = !show;

  gameScreen.hidden = hide;
  playerStatusLine.hidden = hide;
  scoreStatusLine.hidden = hide;
  mazeStatusLine.hidden = hide;
  bagStatusLine.hidden = hide;
  dashboard.style.display = show ? 'flex' : 'none';
}

function zoomStartGame() {
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
      gameWindow.requestAnimationFrame(() => gameScreen.startGame());
    }, TIMEOUTS.startGameZoomDiration);
  });
}

function enterSpiderCave(source) {
  // Switch screens
  bioMessage.style.display = 'none';
  zoomStartGame();
}

function restartGame() {
  if (restartGamePanel.style.display === 'none') return;
  
  restartGamePanel.style.display = 'none';
  mazeGrid.innerHTML = "";
  showGameUI(false);

  gameWindow.requestAnimationFrame(zoomStartGame);
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

const scoreboard = gameWindow.document.getElementById("scoreboard"); 
const scorecard = gameWindow.document.getElementById("scorecard");
const restartGamePanel = gameWindow.document.getElementById("restartGamePanel"); 
const gameMessagePanel = gameWindow.document.getElementById("gameMessagePanel"); 
const instructionsPanel = gameWindow.document.getElementById("instructionsPanel"); 

const enterLink = gameWindow.document.getElementById("enterLink");
const restartGameLink = gameWindow.document.getElementById("restartGameLink");
const nextMazeLink = gameWindow.document.getElementById("nextMazeLink");
const dismissInstructionsLink = gameWindow.document.getElementById("dismissInstructionsLink");

enterLink.addEventListener("click", enterSpiderCave);
restartGameLink.addEventListener("click", restartGame);

gameScreen.overlay = overlay;
gameScreen.scoreboard = scoreboard;
gameScreen.scorecard = scorecard;
gameScreen.restartGamePanel = restartGamePanel;
gameScreen.instructionsPanel = instructionsPanel;
gameScreen.playerStatusLine = playerStatusLine;
gameScreen.highScoreStatusLine = highScoreStatusLine;
gameScreen.scoreStatusLine = scoreStatusLine;
gameScreen.mazeStatusLine = mazeStatusLine;
gameScreen.bagStatusLine = bagStatusLine;
gameScreen.nextMazeLink = nextMazeLink;
gameScreen.restartGameLink = restartGameLink;
gameScreen.dismissInstructionsLink = dismissInstructionsLink;

gameScreen.showGameUI = showGameUI;
gameScreen.showGameMessage = showGameMessage;
gameScreen.hideGameMessage = hideGameMessage;
gameScreen.restartGame = restartGame;
