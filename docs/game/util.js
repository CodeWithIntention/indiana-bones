export { Direction, RNG, Timer }

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

const Timer = {
    timers: [],
    nextId: 1,
    ticks: 0,
    stepInterval: 0,

    msToTicks(ms) {
        return Math.ceil(ms / this.stepInterval);
    },

    setStepInterval(stepInterval) {
        this.stepInterval = stepInterval;
    },

    setTicks(ticks) {
        this.ticks = ticks;
    },

    setTimeout(callback, delay, ...args) {
        const id = this.nextId++;

        this.timers.push({
            id,
            callback,
            args,
            nextTick: this.ticks + this.msToTicks(delay),
            intervalTicks: 0
        });

        return id;
    },

    setInterval(callback, interval, ...args) {
        const id = this.nextId++;
        const intervalTicks = this.msToTicks(interval);

        this.timers.push({
            id,
            callback,
            args,
            nextTick: this.ticks + intervalTicks,
            intervalTicks
        });

        return id;
    },

    clear(id) {
        const index = this.timers.findIndex(
            timer => timer.id === id
        );

        if (index !== -1) {
            this.timers.splice(index, 1);
        }
    },

    update(ticks) {
        if (ticks >= 0) this.setTicks(ticks);

        for (let i = this.timers.length - 1; i >= 0; i--) {
            const timer = this.timers[i];

            if (this.ticks >= timer.nextTick) {
                timer.callback(...timer.args);

                if (timer.intervalTicks) {
                    timer.nextTick += timer.intervalTicks;
                } else {
                    this.timers.splice(i, 1);
                }
            }
        }
    },

    reset() {
        this.timers.length = 0;
        this.nextId = 1;
    }
};

const RNG = {
    streams: {},

    create(name, seed) {
        const random = this.randomizer(seed);
        this.streams[name] = random;

        return random;
    },

    get(name) {
        return this.streams[name];
    },

    random(name) {
        return this.get(name)();
    },

    getState(name) {
        return this.get(name).getState();
    },

    reset(name, state) {
        return this.create(name, state);
    },

    deriveSeed(seed) {
        return (seed ^ 0x9E3779B9) >>> 0
    },

    randomizer(seed) {
        // mulberry32 PRNG
        let state = seed >>> 0;

        const random = function () {
            let t = state += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);

            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };

        random.getState = () => state >>> 0;

        return random;
    }
};