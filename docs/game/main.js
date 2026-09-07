import { Timer } from "./util.js";
import {
  GAME_VERSION,
  GAME_RNG,
  MESSAGES,
  TIMEOUTS,
} from "./config.js";
import { settings } from "./settings.js";
import { Sound } from "./sound.js";
import { gameWindow, gameScreen } from "./game-ui.js";
import { GameRecorder } from "./recorder.js";
import { GameModel } from "./game-model.js";
import { GameRules } from "./game-rules.js";
import { GameView } from "./game-view.js";
import { GameController } from "./game-controller.js";
import { Game } from "./game.js";

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

// Configure object dependencies
const gameModel = new GameModel(settings);
const gameView = new GameView(gameModel, gameWindow, gameScreen);
const game = new Game(gameModel, gameView, {
      playGame,
      replayMazeRecording,
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
    initGame(gameNumber);
  }
})();
