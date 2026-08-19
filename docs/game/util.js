export { Direction, RNG }

class Direction {
    static UP = [-1, 0];
    static DOWN = [1, 0];
    static LEFT = [0, -1];
    static RIGHT = [0, 1];
    static NONE = [0, 0];
    static ALL = [this.UP, this.DOWN, this.LEFT, this.RIGHT];

    static isNone(direction) {
        return direction === this.NONE;
    }

    static isGood(direction) {
        return direction === this.UP || direction === this.DOWN || direction === this.LEFT || direction === this.RIGHT;
    }

    static isLeft(direction) {
        return direction === this.LEFT;
    }

    static isRight(direction) {
        return direction === this.RIGHT;
    }

    static isLeftRight(direction) {
        return this.isLeft(direction) || this.isRight(direction);
    }

    static isUp(direction) {
        return direction === this.UP;
    }

    static isDown(direction) {
        return direction === this.DOWN;
    }

    static isUpDown(direction) {
        return this.isUp(direction) || this.isDown(direction);
    }

    static isOnSameLine(direction1, direction2) {
      return direction1[0] === direction2[0] || direction1[1] === direction2[1];
    }

    static opposite(direction) {
      if (this.isLeft(direction)) {
        return Direction.RIGHT;
      }
      if (this.isRight(direction)) {
        return Direction.LEFT;
      }
      if (this.isUp(direction)) {
        return Direction.DOWN;
      }
      if (this.isDown(direction)) {
        return this.UP;
      }
      return this.NONE;
    }

    static turnsFor(direction) {
        if (Direction.isUp(direction) || Direction.isDown(direction)) {
            return [Direction.LEFT, Direction.RIGHT];
        } else if (Direction.isLeft(direction) || Direction.isRight(direction)) {
            return [Direction.UP, Direction.DOWN];
        }
        return [Direction.NONE, Direction.NONE];
    }

    static shuffle(array, random) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

const RNG = {
    randomizer(seed) {
        // mulberry32 method: small deterministic pseudo-random number generator (PRNG)
        return function (returnSeed = false) {
            if (returnSeed === true) return seed;
            
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
}