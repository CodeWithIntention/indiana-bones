import { Direction, Timer } from "./util.js";
import { OBJECTS, TIMEOUTS } from "./config.js";
import { Grid } from "./grid.js";
import { Character } from "./character.js";
import { Player } from "./player.js";
import { Rock } from "./characters.js";
import { Sound } from "./sound.js";

export class GameRules {
  constructor(game) {
    this.game = game;

    this.player.onMoved = this.onPlayerMoved.bind(this);
    this.player.onCollided = this.onPlayerCollided.bind(this);
  }

  get gameModel() {
    return this.game.model;
  }

  get gameView() {
    return this.game.view;
  }

  get player() {
    return this.game.model.player;
  }

  onPlayerMoved(object) {
    if (object && object !== OBJECTS.exit) {
      if (object !== OBJECTS.path) {
        if (this.player.powerUp) {
          this.playerChomp(this.player, object);
        } else {
          this.playerGrab(object);
        }
        if (object === OBJECTS.key) {
          --this.gameModel.keysNeeded;
        }
      }
      this.gameModel.grid.placeObjectAt(this.player.row, this.player.col, OBJECTS.path, {visited: !this.player.powerUp});
    }
    this.game.update(this.player);
  }

  onCharacterMoved(character, object) {
    if (!(character instanceof Character)) return;

    if (character instanceof Rock && object && object.fixed !== true) {
      if (object === OBJECTS.tnt) {
        this.playerTNT(character);
      } else if (object !== OBJECTS.path) {
        this.playerChomp(character, object);
      }
      this.gameModel.grid.placeObjectAt(
        character.row,
        character.col,
        OBJECTS.path,
        { visited: true },
      );
    }
    if (object.priority > character.priority) {
      character.reduceSpeedBy(object);
    }
    if (
      character.canDrop &&
      this.gameModel.grid.objectAt(character.row, character.col) === OBJECTS.path &&
      this.gameModel.random() < character.dropProbability
    ) {
      this.gameModel.grid.placeObjectAt(
        character.row,
        character.col,
        character.dropObject,
      );
    }
    this.game.update(character);
  }

  onCharacterCollided(character, other) {
    if (!(character instanceof Character)) return;
    if (!(other instanceof Character)) return;

    if (character.canKill(other)) {
      this.playerChomp(character, other);
    } else if (other.canKill(character)) {
      this.playerChomp(other, character);
    } else return;

    this.game.update(character);
  }

  onPlayerCollided(other) {
    if (!(other instanceof Character)) return;
    if (!this.player.isAlive) return;

    if (this.player.powerUp) {
      this.playerChomp(this.player, other);
    } else if (other.canKill(this.player)) {
      if (other.disabled === true) return;
      this.playerKilled();
    } else {
      this.playerGrab(other);
    }
    this.game.update(this.player);
  }

  playerTNT(character) {
    if (character === this.player) {
      if (
        this.player.powerUp ||
        !(this.player.isAlive && this.player.removeTNT())
      )
        return;
    } else if (character instanceof Rock) {
      character.remove();
    } else if (
      character &&
      character.isTNT &&
      this.gameModel.grid.objectAt(character.row, character.col) === OBJECTS.tnt
    ) {
      this.gameModel.grid.placeObjectAt(
        character.row,
        character.col,
        OBJECTS.path,
      );
    } else {
      return;
    }

    Sound.tnt();
    this.gameModel.grid.addAnimationCharacterFor(character, {
      explosion: true,
    });

    const playerRect = this.gameModel.grid.cellRectAtRowCol(
      character.row,
      character.col,
    );
    const rectTopLeft =
      this.gameModel.grid.cellRectAtRowCol(
        character.row - 1,
        character.col - 1,
      ) || playerRect;
    const rectBottomRight =
      this.gameModel.grid.cellRectAtRowCol(
        character.row + 1,
        character.col + 1,
      ) || playerRect;
    const blastRect = {
      top: rectTopLeft.top,
      left: rectTopLeft.left,
      bottom: rectBottomRight.bottom,
      right: rectBottomRight.right,
    };

    this.gameModel.characters.forEach((target) => {
      if (
        target.priority - OBJECTS.tnt.priority <= 2 &&
        this.gameModel.grid.hasCharacterCollidedWithRect(target, blastRect)
      ) {
        this.explode(target);
      }
    });

    Grid.ALL_DIRECTIONS.forEach((rc) => {
      const row = character.row + rc[0];
      const col = character.col + rc[1];
      const mazeObjAtRowCol = this.gameModel.grid.objectAt(row, col);

      if (mazeObjAtRowCol && mazeObjAtRowCol.fixed !== true) {
        if (mazeObjAtRowCol === OBJECTS.tnt) {
          this.gameModel.grid.updateCellAtRowCol(row, col, { strobe: true });
          Timer.setTimeout(
            this.playerTNT.bind(this),
            TIMEOUTS.tntDetonationDelay,
            { isTNT: true, row, col },
          );
        } else {
          const blast = mazeObjAtRowCol !== OBJECTS.path;
          this.gameModel.grid.placeObjectAt(row, col, OBJECTS.path, {
            flash: true,
            blast: blast,
          });
        }
      }
    });

    // The Player can be hurt if TNT was set off by
    // chain reaction or by a 3rd party, and the
    // Player is not powered-up.
    if (
      this.player !== character &&
      !this.player.powerUp &&
      this.gameModel.grid.hasCharacterCollidedWithRect(this.player, blastRect)
    ) {
      // Beware! If the gameModel.player is waiting to respawn and
      // is blown up, then its game over!
      this.gameModel.grid.addAnimationCharacterFor(this.player, {
        blast: true,
      });
      this.playerKilled(!this.player.isAlive);
      this.game.update(this.player);
    } else {
      this.gameView.update();
    }
  }

  explode(character) {
    if (character.disabled === true) return;

    this.gameModel.grid.addAnimationCharacterFor(character, { blast: true });

    if (character.canKill(this.player)) {
      if (character.lives === 0) {
        character.addScore(this.gameModel.settings.blownUpPointsFactor);
      } else {
        character.lives--;
        character.disable(this.gameModel.settings.blowUpRecoveryDuration);
        this.gameModel.grid.applyAnimationFor(character, { blownup: true });
        return;
      }
    } else {
      character.addScore(-1);
    }
    character.remove();
  }

  playerChomp(character, object) {
    if (object instanceof Character) {
      if (!(character instanceof Rock || object.isChompable || object.disabled))
        return;

      object.addScore(
        object.canKill(this.player)
          ? 1
          : this.gameModel.settings.chompPointsFactor,
      );
      object.remove();

      const chompSound = object.chompSound;
      if (chompSound) {
        Sound[chompSound]();
      }
    } else if (character instanceof Player) {
      character.addScore(
        this.gameModel.settings.chompPointsFactor,
        object.points,
      );
    }
    Sound[character.chompSound || "chomp"]();
  }

  playerGrab(object) {
    if (object instanceof Character && object.isGrabable) {
      if (object.isRelic) {
        Sound.portal();
        this.gameModel.levelRelicFound = true;
        this.gameModel.grid.addHtmlCharacterFor(
          object,
          `<span class='relic'>${object.description}</span>`,
          TIMEOUTS.relicLabelDuration,
        );
        this.gameModel.grid.ensureExit(true, {
          row: this.player.row,
          col: this.player.col,
        });
        Timer.setTimeout(
          this.game.startCaveIn.bind(this.game),
          TIMEOUTS.caveInInterval,
        );
      } else {
        this.player.grab(object.config);
      }
      object.remove();
    } else if (Number.isFinite(object.points)) {
      if (object.isBaggable === false) {
        this.player.addScore(1, object.points);
      } else {
        this.player.grab(object);
      }
    }

    if (object.speedReduction) {
      this.player.reduceSpeedBy(object);
    }

    const grabSound = object.grabSound;
    if (grabSound && Sound[grabSound]) {
      Sound[grabSound]();
    }

    if (object === OBJECTS.fountain) {
      this.player.powerUp = true;
      const powerUpTime = this.player.powerUpTime;

      Timer.setTimeout(() => {
        if (powerUpTime === this.player.powerUpTime) {
          this.player.powerUp = false;
          this.game.update(this.player);
        }
      }, this.player.powerUpDuration);
    }
  }

  playerRespawn() {
    if (!this.player.canRespawn) return false;

    this.player.respawn();
    Sound.respawn();

    this.game.update(this.player);
    return true;
  }

  playerKilled(buried = false) {
    this.player.die(buried);
    this.player.direction = Direction.NONE;
    this.gameModel.grid.placeCharacter(this.player);

    if (this.player.lives === 0) {
      this.game.playerGameOver();
    } else {
      Sound.dead();
    }
  }
}
