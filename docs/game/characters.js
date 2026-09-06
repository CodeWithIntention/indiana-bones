import { CHARACTERS } from "./config.js";
import { Character } from "./character.js";
import { Player } from "./player.js";

export { Characters, Ghost, Relic, Spider, Scorpion, Cat, Monkey, Mouse, Rock, Label }

class Killer extends Character {
    constructor(config, position) {
        super(config, position.row, position.col);
    }

    canKill(character) {
        return character instanceof Player;
    }
}

class Spider extends Killer {
    constructor(position) {
        super(CHARACTERS.spider, position);
    }

}

class Scorpion extends Killer {
    constructor(position) {
        super(CHARACTERS.scorpion, position);
    }
}

class Ghost extends Killer {
    constructor(position) {
        super(CHARACTERS.ghost, position);
    }
}

class Rock extends Character {
    constructor(position) {
        super(CHARACTERS.rock, position.row, position.col);
    }

    canKill(character) {
        return !(character instanceof Rock) && this.priority >= character.priority;
    }

    get powerUp() {
        return true;
    }
}

class Cat extends Character {
    constructor(position) {
        super(CHARACTERS.cat, position.row, position.col);
    }
}

class Mouse extends Character {
    constructor(position) {
        super(CHARACTERS.mouse, position.row, position.col);
    }
}

class Monkey extends Character {
    constructor(position) {
        super(CHARACTERS.monkey, position.row, position.col);
    }
}

class Relic extends Character {
  level;
  symbol;
  description;

  static maxLevel = 10;

  static kindForLevel(level) {
    return `${CHARACTERS.relic.kind}-${Math.min(level, Relic.maxLevel)}`;
  }

  static parse(symbolDescription) {
    return symbolDescription.split(':');
  }

  constructor(position) {
    // Copy the configuration so that kind can be modified for each instance
    const config = {};
    Object.entries(CHARACTERS.relic).forEach(([key, value]) => {
      config[key] = value;
    });
    super(config, position.row, position.col);
  }

  setRelic(relic) {
    this.config.kind = relic.kind;
    this.level = relic.level;
    this.symbol = relic.symbol;
    this.description = relic.description;

    if (this.gridCell) {
      this.gridCell.textContent = this.symbol;
    }
  }
}

class Label extends Character {
  constructor(row, col) {
    super(CHARACTERS.label, row, col);
  }
}

// Map class to configurations for screen intialization
CHARACTERS.scorpion.class = Scorpion;
CHARACTERS.spider.class = Spider;
CHARACTERS.cat.class = Cat;
CHARACTERS.mouse.class = Mouse;
CHARACTERS.monkey.class = Monkey;
CHARACTERS.rock.class = Rock;
CHARACTERS.ghost.class = Ghost;
CHARACTERS.relic.class = Relic;

class Characters {
  #characters = [];

  characterIndex(character) {
    return this.#characters.findIndex((element) => character === element);
  }

  contains(character) {
    return this.characterIndex(character) >= 0;
  }

  remove(character) {
    const index = this.characterIndex(character);
    if (index >= 0) {
      this.#characters.splice(index, 1)[0];
      return true;
    }
    return false;
  }

  add(character) {
    const index = this.characterIndex(character);
    if (index === -1) {
      this.#characters.push(character);
      return true;
    }
    return false;
  }

  atRowCol(row, col) {
    return this.#characters.find((character) => character.isAtRowCol(row, col));
  }

  allAtRowCol(row, col) {
    return this.#characters.filter((character) =>
      character.isAtRowCol(row, col),
    );
  }

  all(row, col) {
    if (row === undefined && col === undefined) {
      return this.#characters;
    }
    return this.#characters.filter((character) =>
      character.isAtRowCol(row, col),
    );
  }

  killers(victim) {
    return this.#characters.filter((item) => item.canKill(victim));
  }

  killables(character) {
    return this.#characters.filter(
      (prey) => prey !== character && prey.priority <= character.priority,
    );
  }

  forEach(callback) {
    this.#characters.forEach(callback);
  }

  removeAll() {
    this.#characters = [];
  }
}
