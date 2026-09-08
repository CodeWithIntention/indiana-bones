import { Direction, Timer } from "./util.js";
import { OBJECTS, CHARACTERS } from "./config.js";
import { Character } from "./character.js";

export { Player }

class Player extends Character {
  level;
  mazes;
  exitMazeTime;
  tnts;
  bonusAwarded;
  trophiesAwarded;
  isMazeCleared;
  mazeBonus;

  #settings;
  #alive;
  #powerUpTime;
  #bag;
  #exitMaze;
  #exitMazeScore;
  #score;
  #lastAwardedLifeScore;
  #lastAwardedTNTScore;

  constructor(config, settings) {
    super(config, 0, 0);
    this.#settings = settings;
    this.reset();
  }

  get isAlive() {
    return this.#alive;
  }

  get isBuried() {
    return !this.#alive && !this.canRespawn;
  }

  get canRespawn() {
    return this.lives > 0;
  }

  get hasTNT() {
    return this.tnts > 0;
  }

  // Override to enhande speed during powerup
  get speed() {
    return this.powerUp
      ? this.#settings.powerUpSpeedBoost * super.speed
      : super.speed;
  }

  set speed(value) {
    super.speed = value;
  }

  get score() {
    return this.#score;
  }

  set score(value) {
    if (!(Number.isFinite(value) && this.#score !== value)) return;

    this.#score = value;

    // Do not award bonuses for points received after death.
    if (!this.#alive) return;

    let lifeCount = this.lives;
    let tntCount = this.tnts;

    const lifeIntervals = Math.floor(
      (value - this.#lastAwardedLifeScore) / this.#settings.pointsPerLifeAward,
    );

    if (lifeIntervals > 0) {
      this.#lastAwardedLifeScore +=
        lifeIntervals * this.#settings.pointsPerLifeAward;

      lifeCount = Math.min(this.#settings.maxLives, lifeCount + lifeIntervals);
    }

    const tntIntervals = Math.floor(
      (value - this.#lastAwardedTNTScore) / this.#settings.pointsPerTNTAward,
    );

    if (tntIntervals > 0) {
      this.#lastAwardedTNTScore +=
        tntIntervals * this.#settings.pointsPerTNTAward;

      if (tntCount < this.#settings.maxAwardedTNTs) {
        tntCount = Math.min(
          this.#settings.maxAwardedTNTs,
          tntCount + tntIntervals * this.#settings.freeTNTsPerAward,
        );
      }
    }

    if (lifeCount !== this.lives || tntCount !== this.tnts) {
      this.lives = lifeCount;
      this.tnts = tntCount;
      this.bonusAwarded = true;
    }
  }

  set powerUp(bool) {
    this.#powerUpTime = Timer.ticks;

    if (bool === true) {
      this.reduceSpeedBy(0);
      this.#powerUpTime += Timer.msToTicks(this.config.powerUpDuration);
    }
  }

  get powerUpTimeRemaining() {
    return Timer.ticks - this.powerUpTime;
  }

  get powerUpDuration() {
    return this.config.powerUpDuration;
  }

  get powerUp() {
    return this.#powerUpTime > Timer.ticks;
  }

  get powerUpTime() {
    return this.#powerUpTime;
  }

  get exitMaze() {
    return this.#exitMaze;
  }

  set exitMaze(bool) {
    this.#exitMaze = bool === true;
    this.exitMazeTime = this.#exitMaze ? Date.now() : 0;
    this.#exitMazeScore = this.#exitMaze ? this.#score : 0;
  }

  get exitMazeScore() {
    return this.#exitMazeScore;
  }

  get state() {
    const baggedObjects = {};

    [...Object.values(OBJECTS), ...Object.values(CHARACTERS)].forEach(
      (object) => {
        const items = this.findInBag(object);

        if (items.length > 0) {
          baggedObjects[object.kind] = items.length;
        }
      },
    );

    return {
      score: this.#score,
      lastAwardedLifeScore: this.#lastAwardedLifeScore,
      lastAwardedTNTScore: this.#lastAwardedTNTScore,
      alive: this.#alive,
      exitMaze: this.#exitMaze,
      exitMazeScore: this.#exitMazeScore,
      lives: this.lives,
      tnts: this.tnts,
      trophiesAwarded: this.trophiesAwarded,
      isMazeCleared: this.isMazeCleared,
      mazeBonus: this.mazeBonus,
      level: this.level,
      mazes: this.mazes,
      baggedObjects: baggedObjects,
    };
  }

  set state(value) {
    this.#score = value.score;
    this.#lastAwardedLifeScore = value.lastAwardedLifeScore;
    this.#lastAwardedTNTScore = value.lastAwardedTNTScore;
    this.#alive = value.alive;
    this.#exitMaze = value.exitMaze;
    this.#exitMazeScore = value.exitMazeScore;

    this.lives = value.lives;
    this.tnts = value.tnts;
    this.trophiesAwarded = value.trophiesAwarded;
    ((this.isMazeCleared = value.isMazeCleared),
      (this.mazeBonus = value.mazeBonus));
    this.level = value.level;
    this.mazes = value.mazes;

    this.#bag = [];

    Object.entries(value.baggedObjects).forEach(([key, value]) => {
      while (value-- > 0) {
        this.#bag.push(key);
      }
    });
  }

  countInBag(obj) {
    let count = 0;

    for (const item of this.#bag) {
      if (item === obj) {
        count++;
      }
    }
    return count;
  }

  findInBag(obj) {
    return this.#bag.filter((item) => item === obj || item === obj.kind);
  }

  grab(obj) {
    if (OBJECTS.tnt === obj) {
      this.tnts++;
    } else if (obj.points > 0) {
      if (obj.isBaggable !== false) {
        this.#bag.push(obj);
      }
    }
  }

  removeTNT() {
    if (this.tnts > 0) {
      this.tnts--;
      return true;
    }
    return false;
  }

  reset() {
    this.score = 0;
    this.level = 1;
    this.mazes = 0;
    this.tnts = this.config.tnts;
    this.lives = this.config.lives;
    this.bonusAwarded = false;
    this.trophiesAwarded = 0;

    this.#lastAwardedLifeScore = 0;
    this.#lastAwardedTNTScore = 0;

    this.restart();
  }

  restart() {
    super.clear();

    this.row = 1;
    this.col = 0;
    this.moves = 0;
    this.direction = Direction.NONE;
    this.speed = this.config.speed;

    this.exitMaze = false;
    this.isMazeCleared = false;
    this.mazeBonus = 0;

    this.#alive = true;
    this.#powerUpTime = 0;
    this.#bag = [];
  }

  respawn() {
    if (!this.canRespawn) return;

    this.#alive = true;
  }

  die(buried = false) {
    if (buried) {
      this.lives = 0;
    } else {
      this.lives--;
    }
    this.#alive = false;
    this.powerUp = false;
    this.#bag = [];

    if (this.lives === 0) {
      this.#exitMazeScore = this.score;
    }
  }
}

