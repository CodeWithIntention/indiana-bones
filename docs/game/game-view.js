import { CHARACTERS, OBJECTS } from "./config.js";
import { Relic } from "./characters.js";
import { Grid } from "./grid.js";
import { Sound } from "./sound.js";

export class GameView {
  constructor(gameModel, gameWindow, gameScreen) {
    this.gameModel = gameModel;
    this.gameWindow = gameWindow;
    this.gameScreen = gameScreen;
  }

  update() {
    let list = [];

    if (this.gameModel.player.bonusAwarded) {
      Sound.dingDing();
      this.gameModel.player.bonusAwarded = false;
    }

    const lives = Math.min(
      this.gameModel.player.isAlive
        ? this.gameModel.player.lives - 1
        : this.gameModel.player.lives,
      this.gameModel.settings.maxLives,
    );
    if (lives > 0) {
      list.push(`${Grid.symbolFor(this.gameModel.player.kind)}`.repeat(lives));
    }
    if (this.gameModel.player.tnts > 0) {
      list.push(
        `${Grid.symbolFor(OBJECTS.tnt.kind)}<b>${this.gameModel.player.tnts}</b>`,
      );
    }
    this.gameScreen.playerStatusLine.innerHTML = list.join("&nbsp;");

    list = [];
    Object.entries(OBJECTS).forEach(([kind, object]) => {
      const count = this.gameModel.player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });
    Object.entries(CHARACTERS).forEach(([kind, object]) => {
      const count = this.gameModel.player.countInBag(object);
      if (count > 0) {
        list.push(`<div>${Grid.symbolFor(kind)}<b>${count}</b></div>`);
      }
    });

    if (this.gameModel.levelRelicFound) {
      list.push(
        `<div class='pulse'>${this.gameModel.levelRelic?.symbol}</div>`,
      );
    }

    this.gameScreen.bagStatusLine.innerHTML = list.join("");

    this.gameScreen.scoreStatusLine.classList.toggle(
      "minus",
      this.gameModel.player.score < 0,
    );
    this.gameScreen.scoreStatusLine.textContent = `${Math.abs(this.gameModel.player.score)}`;

    this.gameScreen.highScoreStatusLine.classList.toggle(
      "minus",
      this.gameModel.highScore < 0,
    );
    this.gameScreen.highScoreStatusLine.textContent = `${Math.abs(this.gameModel.highScore)}`;

    this.gameScreen.mazeStatusLine.innerHTML = `<b>LEVEL ${this.gameModel.currentLevel}.${this.gameModel.currentMaze}</b> 
      <span>${Grid.symbolFor("maze-bonus")}</span><b>${this.gameModel.player.mazeBonus || this.gameModel.grid?.mazeBonus || 0}</b>`;
  }

  render() {
    this.gameModel.grid.render((cell, row, col) => {});

    let list = [];
    for (let i = 1; i < this.gameModel.player.level; i++) {
      const relicKind = Relic.kindForLevel(i);
      const parts = Relic.parse(Grid.symbolFor(relicKind));
      list.push(`<div>${parts[0]}</div>`);
    }
    this.gameScreen.relicStatusLine.innerHTML = list.join("");

    list = [];
    const trophySymbol = Grid.symbolFor("maze-trophy");
    for (let i = 0; i < this.gameModel.player.trophiesAwarded; i++) {
      list.push(`<div>${trophySymbol}</div>`);
    }
    this.gameScreen.trophyStatusLine.innerHTML = list.join("");
  }
}
