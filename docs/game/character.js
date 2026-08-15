import { Direction } from "./util.js";

export { Character }

class Character {
    #config;
    #speed;
    #disabled;
    #disabledTime;
    #speedReductionExpirationTime;
    #passThroughProbability;

    speedReduction;
    speedReductionReason;

    allowedDirections;

    row;
    col;
    left;
    top;

    direction;
    vx;
    vy;

    lives;
    moves;

    constructor(config, row, col) {
        this.#config = config;
        this.#speed = config.speed || 0;
        this.#disabled = false;
        this.#disabledTime = Date.now();
        this.#speedReductionExpirationTime = Date.now();
        this.#passThroughProbability = config.passThroughProbability || 0;

        this.speedReduction = 0;
        this.speedReductionReason = null;

        this.allowedDirections = config.allowedDirections || Direction.ALL;
    
        this.row = row;
        this.col = col;
        this.left = 0;
        this.top = 0;

        this.direction = Direction.NONE;
        this.vx = 0;
        this.vy = 0;
        
        this.lives = config.lives || 0;
        this.moves = 0;
    }

    get kind() {
        return this.#config.kind;
    }

    get config() {
        return this.#config;
    }

    get points() {
        return this.#config.points;
    }

    get priority() {
        return this.#config.priority;
    }

    get isGrabable() {
        return this.#config.isGrabable === true;
    }
    
    get grabSound() {
        return this.#config.grabSound;
    }

    get isChompable() {
        return this.#config.isChompable === true;
    }
    
    get chompSound() {
        return this.#config.chompSound;
    }

    get rotationTransform() {
        return this.#config.rotationTransform;
    }

    get canDrop() {
        return this.#config.movesToDrop > 0 && 
        (this.moves % this.#config.movesToDrop === this.#config.movesToDrop-1) &&
        Math.random() < this.#config.dropProbability;
    }

    get dropObject() {
        return this.config.dropObject;
    }

    get isReducedSpeed() {
        return this.speedReduction > 0;
    }

    get speed() {
      return this.#speed;
    }

    set speed(value) {
      this.#speed = value;
    }
    
    get disabled() {
      return this.#disabled;
    }

    set disabled(value) {
      if (value) {
        this.#disabledTime = Date.now();
      }
      this.#disabled = value;
    }

    get disabledTime() {
      return this.#disabledTime;
    }

    canPassThroughObject(object) {
        const objPriority = object && object.priority;
        return objPriority === this.priority+1 && this.#passThroughProbability > 0
            && Math.random() <= this.#passThroughProbability;
    }
    
    reduceSpeedBy(object) {
        if (!(object && Number.isFinite(object.speedReduction) && Number.isFinite(object.speedReductionDuration))) return;

        this.speedReduction = object.speedReduction;
        this.speedReductionReason = object.speedReductionReason;
        this.#speedReductionExpirationTime = Date.now() + object.speedReductionDuration;
    }

    isAtRowCol(row, col) {
        return this.row === row && this.col === col; 
    }

    canKill(character) {
        // Override to enable killing of other characters
        return false;
    }

    updateVelocity(direction, delta = 0) {
      this.vx = this.vy = 0;

      // Negative speed is a setting that prevents level increases
      let speed = Math.abs(this.speed);

      if (this.speedReduction > 0 && Date.now() < this.#speedReductionExpirationTime) {
          speed -= speed * this.speedReduction;
      } else {
          this.speedReduction = 0;
      }
  
      if (Direction.isUp(direction) || Direction.isDown(direction)) {
          this.vy = direction[0] * Math.max(.5, speed * delta);
      } else if (Direction.isLeft(direction) || Direction.isRight(direction)) {
          this.vx = direction[1] * Math.max(.5, speed * delta);
      }
    }

    manhattanDistanceTo(characterOrRow, col) {
      if (characterOrRow instanceof Character) {
          return Math.abs(this.row - characterOrRow.row) + Math.abs(this.col - characterOrRow.col);
      }
      
      const row = Number(characterOrRow);

      if (Number.isFinite(row) && Number.isFinite(col)) {
          return Math.abs(this.row - row) + Math.abs(this.col - col);
      }
    }
}
