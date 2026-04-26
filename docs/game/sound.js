export { Sound }

class Sound {
  static #ack = new Audio("sounds/ack.wav");
  static #eat = new Audio("sounds/eat.wav");
  static #alert = new Audio("sounds/alert.wav");
  static #ding_ding = new Audio("sounds/ding_ding.wav");
  static #chomp = new Audio("sounds/chomp.wav");
  static #grab = new Audio("sounds/grab.wav");
  static #ding = new Audio("sounds/ding.wav");
  static #ta_ding = new Audio("sounds/ta_ding.wav");
  static #tnt = new Audio("sounds/tnt.wav");
  static #pickup = new Audio("sounds/pickup.wav");
  static #powerup = new Audio("sounds/powerup.wav");
  static #oops = new Audio("sounds/oops.wav");
  static #meow = new Audio("sounds/meow.wav");
  static #hiss = new Audio("sounds/hiss.wav");
  static #yeah = new Audio("sounds/yeah.wav");
  static #dead = new Audio("sounds/dead.wav");
  static #respawn = new Audio("sounds/respawn.wav");
  static #maze = new Audio("sounds/maze.wav");
  static #level = new Audio("sounds/level.wav");
  static #deeper = new Audio("sounds/deeper.wav");
  static #gameover = new Audio("sounds/game_over.wav");
  static #intro = new Audio("sounds/intro.wav");

  static play(sound) {
    sound.currentTime = 0;
    sound.play();
  }

  static ack() {
    this.play(this.#ack);
  }

  static eat() {
    this.play(this.#eat);
  }

  static alert() {
    this.play(this.#alert);
  }

  static dingDing() {
    this.play(this.#ding_ding);
  }

  static chomp() {
    this.play(this.#chomp);
  }

  static grab() {
    this.play(this.#grab);
  }

  static ding() {
    this.play(this.#ding);
  }

  static ta_ding() {
    this.play(this.#ta_ding);
  }

  static pickup() {
    this.play(this.#pickup);
  }

  static tnt() {
    this.play(this.#tnt);
  }

  static powerup() {
    this.play(this.#powerup);
  }

  static oops() {
    this.play(this.#oops);
  }

  static meow() {
    this.play(this.#meow);
  }

  static hiss() {
    this.play(this.#hiss);
  }

  static yeah() {
    this.play(this.#yeah);
  }

  static dead() {
    this.play(this.#dead);
  }

  static respawn() {
    this.play(this.#respawn);
  }

  static maze() {
    this.play(this.#maze);
  }

  static level() {
    this.play(this.#level);
  }

  static deeper() {
    this.play(this.#deeper);
  }

  static gameover() {
    this.play(this.#gameover);
  }

  static intro() {
    this.play(this.#intro);
  }
}

