import { CHARACTERS } from "./config.js";
import { Character } from "./character.js";
import { Player } from "./player.js";

export { Spider, Scorpion, Cat, Monkey, Mouse, Rat, Label }

class Spider extends Character {
    constructor(position) {
        super(CHARACTERS.spider, position.row, position.col);
    }

    canKill(character) {
        return character instanceof Player;
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

class Rat extends Character {
    constructor(position) {
        super(CHARACTERS.rat, position.row, position.col);
    }
}

class Monkey extends Character {
    constructor(position) {
        super(CHARACTERS.monkey, position.row, position.col);
    }
}

class Scorpion extends Character {
    constructor(position) {
        super(CHARACTERS.scorpion, position.row, position.col);
    }

    canKill(character) {
        return character instanceof Player;
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
CHARACTERS.rat.class = Rat;
CHARACTERS.mouse.class = Mouse;
CHARACTERS.monkey.class = Monkey;