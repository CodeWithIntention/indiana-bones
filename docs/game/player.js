import { Direction } from "./util.js";
import { OBJECTS } from "./config.js";
import { Character } from "./character.js";

export { Player }

class Player extends Character {
  level;
  mazes;
  points;
  exitMazeTime;
  tnts;
  bonusAwarded;

  #settings;
  #alive;
  #powerUpTime;
  #bag;
  #exitMaze;
  #score;
  #lastFreeLifeScore;

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
    return this.powerUp ? this.#settings.powerUpSpeedBoost * super.speed : super.speed;
  }

  set speed(value) {
    super.speed = value;
  }

  get score() {
    return this.#score;
  }

  set score(value) {
    if (!(Number.isFinite(value) && this.#score !== value)) return;

    let lifeCount = this.lives;
    let tntCount = this.tnts;

    this.#score = value;
    
    if (value >= this.#lastFreeLifeScore + this.#settings.pointsPerFreeLife) {
      const freeLives = Math.floor((value - this.#lastFreeLifeScore) / this.#settings.pointsPerFreeLife);
      lifeCount += freeLives;
      if (lifeCount > this.#settings.maxLives) {
        const excessLives = lifeCount - this.#settings.maxLives;
        lifeCount = this.#settings.maxLives;
        tntCount += excessLives * this.#settings.freeTNTsWithLife;
      }
      tntCount = Math.min(tntCount + freeLives * this.#settings.freeTNTsWithLife, this.#settings.maxTnts);
      this.#lastFreeLifeScore += freeLives * this.#settings.pointsPerFreeLife;
    }
    if (lifeCount !== this.lives || tntCount !== this.tnts) {
      this.lives = lifeCount;
      this.tnts = tntCount;
      this.bonusAwarded = true;
    }
  }

  set powerUp(bool) {
    this.#powerUpTime = Date.now();

    if (bool === true) {
      this.reduceSpeedBy(0);
      this.#powerUpTime += this.config.powerUpDuration;
    }
  }

  get powerUpTimeRemaining() {
    return Date.now() - this.powerUpTime;
  }

  get powerUpDuration() {
    return this.config.powerUpDuration;
  }

  get powerUp() {
    return this.#powerUpTime > Date.now();
  }

  get powerUpTime() {
    return this.#powerUpTime;
  }

  get exitMaze() {
    return this.#exitMaze;
  }

  set exitMaze(bool) {
    this.exitMazeTime = bool ? Date.now() : 0
    this.#exitMaze = bool;
  }

  get state() {
    return {score: this.#score, lastFreeLifeScore: this.#lastFreeLifeScore, lives: this.lives, tnts: this.tnts, level: this.level, mazes: this.mazes};
  }

  set state(value) {
    this.#score = value.score;
    this.#lastFreeLifeScore = value.lastFreeLifeScore;
    this.lives = value.lives;
    this.tnts = value.tnts;
    this.level = value.level;
    this.mazes = value.mazes;
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
    return this.#bag.filter(item => item === obj);
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
    this.points = 0;
    this.tnts = this.config.tnts;
    this.lives = this.config.lives;
    this.bonusAwarded = false;

    this.#lastFreeLifeScore = 0;

    this.restart();
  }

  restart() {
    super.clear();

    this.row = 1;
    this.col = 0;
    this.moves = 0;
    this.exitMaze = false;
    this.direction = Direction.NONE;
    this.speed = this.config.speed;

    this.#alive = true;
    this.#powerUpTime = Date.now();
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
  }
}

