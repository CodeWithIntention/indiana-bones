import {
  GAME_RNG,
  TIMEOUTS,
} from "./config.js";
import { settings } from "./settings.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { GameModel } from "./game-model.js";
import { GameRules } from "./game-rules.js";
import { GameView } from "./game-view.js";
import { GameController } from "./game-controller.js";
import { Game } from "./game.js";

function replayMaze(index = -1) {
  gameController.playbackPaused = false;
  game.replayMaze(index);
}

function goDeeper() {
  game.playerDescend();
}

function playGame() {
  gameController.playbackSpeed = gameScreen.replayBar.speed;
  gameController.play();
}

function createCharacter(config, position) {
  if (!config.class) return;

  const characterType = config.class;
  const character = new characterType(position);

  character.onMoved = (object) => {
    gameRules.onCharacterMoved(character, object);
  };

  character.onCollided = (other) => {
    gameRules.onCharacterCollided(character, other);
  };

  return character;
}

function startGame(seed = 0) {
  if (gameModel.gameNumber && seed !== gameModel.gameNumber) {
    gameModel.gameNumber = null;
    deleteGameNumberFromURL();
  }
  game.start(seed);
}

function playAgain() {
  startGame(gameModel.seed);
}

function replayGame() {
  replayMaze(0);
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
    game.replayMazeRecording(index);
  },

  onSelectEnd() {
    game.replayEndOfRecording();
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

// Configure object dependencies
const gameModel = new GameModel(settings);
const gameView = new GameView(gameModel, gameWindow, gameScreen);
const game = new Game(gameModel, gameView, {
      playGame,
      createCharacter,
    });
const gameRules = new GameRules(game);
const gameController = new GameController(gameRules);

// Select the initial screen from the URL.
(() => {
  const gameNumber = getGameNumberFromURL();

  if (gameNumber === null) {
    gameScreen.showBio();
  } else {
    game.load(gameNumber);
  }
})();
