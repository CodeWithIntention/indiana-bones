import { Direction, Timer } from "./util.js";

export { Character }

class Character {
    #config;
    #speed;
    #disabled;
    #disabledTimerTick;
    #speedReductionExpirationTimerTick;
    #phaseProbability;

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
        this.#disabledTimerTick = 0;
        this.#speedReductionExpirationTimerTick = 0;
        this.#phaseProbability = config.phaseProbability || 0;

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
        return this.config.kind;
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

    get isRelic() {
        return this.#config.isRelic === true;
    }

    get isBaggable() {
        return this.#config.isBaggable !== false;
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
        (this.moves % this.#config.movesToDrop === this.#config.movesToDrop-1);
    }

    get dropProbability() {
        return this.#config.dropProbability;
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
        this.#disabledTimerTick = Timer.ticks;
      }
      this.#disabled = value;
    }

    get disabledTime() {
      return this.#disabledTimerTick;
    }
    
    get phaseProbability() {
        return this.#phaseProbability;
    }

    reduceSpeedBy(object) {
        if (!(object && Number.isFinite(object.speedReduction) && Number.isFinite(object.speedReductionDuration))) return;

        this.speedReduction = object.speedReduction;
        this.speedReductionReason = object.speedReductionReason;
        this.#speedReductionExpirationTimerTick = Timer.ticks + Timer.msToTicks(object.speedReductionDuration);
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

      if (speed === 0) return;

      if (this.speedReduction > 0 && Timer.ticks < this.#speedReductionExpirationTimerTick) {
          speed -= speed * this.speedReduction;
      } else {
          this.speedReduction = 0;
      }
  
      if (Direction.isUp(direction) || Direction.isDown(direction)) {
          this.vy = direction[0] * speed * delta;
      } else if (Direction.isLeft(direction) || Direction.isRight(direction)) {
          this.vx = direction[1] * speed * delta;
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
