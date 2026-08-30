import { Direction, Timer } from "./util.js";
import { OBJECTS, CHARACTERS } from "./config.js";
import { Character } from "./character.js";

export { Player }

class Player extends Character {
  level;
  mazes;
  points;
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

    // No awards if score was award after death
    if (!this.#alive) return;

    if (value >= this.#lastFreeLifeScore + this.#settings.pointsPerFreeLife) {
      const freeLives = Math.floor((value - this.#lastFreeLifeScore) / this.#settings.pointsPerFreeLife);

      // Transfer excess lives to TNT adward
      lifeCount += freeLives;
      if (lifeCount > this.#settings.maxLives) {
        const excessLives = lifeCount - this.#settings.maxLives;
        lifeCount = this.#settings.maxLives;
        tntCount += excessLives * this.#settings.freeTNTsWithLife;
      }

      // Only award more TNT if current count has not exceed max
      if (this.tnts < this.#settings.maxTnts) {
        tntCount = Math.min(tntCount + freeLives * this.#settings.freeTNTsWithLife, this.#settings.maxTnts);
      } else {
        tntCount = this.tnts;
      }
      this.#lastFreeLifeScore += freeLives * this.#settings.pointsPerFreeLife;
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
    this.exitMazeTime = this.#exitMaze ? Date.now() : 0
    this.#exitMazeScore = this.#exitMaze ? this.#score : 0;
  }

  get exitMazeScore() {
    return this.#exitMazeScore;
  }

  get state() {
    const baggedObjects = {};

    [...Object.values(OBJECTS), ...Object.values(CHARACTERS)].forEach(object => {
      const items = this.findInBag(object);

      if (items.length > 0) {
        baggedObjects[object.kind] = items.length;
      }
    });

    return {
      score: this.#score, lastFreeLifeScore: this.#lastFreeLifeScore, 
      alive: this.#alive, exitMaze: this.#exitMaze, exitMazeScore: this.#exitMazeScore,
      lives: this.lives, tnts: this.tnts, trophiesAwarded: this.trophiesAwarded, 
      isMazeCleared: this.isMazeCleared, mazeBonus: this.mazeBonus,
      level: this.level, mazes: this.mazes, baggedObjects: baggedObjects};
  }

  set state(value) {
    this.#score = value.score;
    this.#lastFreeLifeScore = value.lastFreeLifeScore;
    this.#alive = value.alive;
    this.#exitMaze = value.exitMaze;
    this.#exitMazeScore = value.exitMazeScore;

    this.lives = value.lives;
    this.tnts = value.tnts;
    this.trophiesAwarded = value.trophiesAwarded;
    this.isMazeCleared = value.isMazeCleared,
    this.mazeBonus = value.mazeBonus;
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
    return this.#bag.filter(item => item === obj || item === obj.kind);
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
    this.trophiesAwarded = 0;
    
    this.#lastFreeLifeScore = 0;

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

