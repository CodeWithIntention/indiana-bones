import { CHARACTERS } from "./config.js";
import { Character } from "./character.js";
import { Player } from "./player.js";

export { Ghost, Relic, Spider, Scorpion, Cat, Monkey, Mouse, Rock, Label, Skull }

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

class Skull extends Character {
  constructor(position) {
    super(CHARACTERS.skull, position.row, position.col)
  }
}

class Relic extends Character {
  constructor(position) {
    // Copy the configuration so that kind can be modified for each instance
    const config = {};
    Object.entries(CHARACTERS.relic).forEach(([key, value]) => {
        config[key] = value;
    });
    super(config, position.row, position.col)
  }

  set kind(value) {
    this.config.kind = value;

    if (this.gridCell) {
        this.gridCell.textContent = value;
    }
  }
}

class Label extends Character {
  constructor(row, col) {
    super(CHARACTERS.label, row, col)
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
CHARACTERS.skull.class = Skull;
