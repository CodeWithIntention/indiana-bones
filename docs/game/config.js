import { Direction } from "./util.js";

export { OBJECTS, CHARACTERS, MESSAGES, TIMEOUTS }

const MESSAGES = {
  mazeClearedBonus: "Cave emptied!",
}

const TIMEOUTS = {
  startGameZoomDuration: 2500,
  characterPointsLabel: 2000,
  tallyScoreDelay: 2000,
  updateScoreCardInterval: 750,
  useArrowsMessageTimeout: 3000,
  nextMazeDelay: 1000,
  mazeRumbleDuration: 2000,
  caveInInterval: 1500,
  tntDetonationDelay: 1500,
}

// Object configurations starting at Level 1
const OBJECTS = {
    gem:        {points: NaN, qty: (level => level), inWalls: true, grabSound: 'grab', priority: 2},
    tnt:        {points:   0, qty: (level => level), grabSound: 'pickup', priority: 0},
    bone:       {points: 500, qty: (level => level*2), grabSound: 'grab', priority: 0},
    fountain:   {points: NaN, qty: (level => level-1), grabSound: 'powerup', priority: 0},
    cheese:     {points: 200, qty: (() =>  0), grabSound: 'grab', priority: 0},
    banana:     {points: 300, qty: (() =>  0), grabSound: 'grab', priority: 0},

    web:        {points: NaN, qty: (() =>  0), speedReduction: 1, speedReductionReason: 'webbed', grabSound: 'oops', priority: 0},
    poop:       {points: NaN, qty: (() =>  0), speedReduction: 1, speedReductionReason: 'pooped', grabSound: 'oops', priority: 0},

    path:       {fixed: true, visitable: true, priority: 0},
    wall:       {fixed: true, visitable: false, priority: 3},
    edge:       {fixed: true, visitable: false, priority: 4},
    exit:       {fixed: true, visitable: false, priority: 2},
};

Object.entries(OBJECTS).forEach(([key, value]) => value.kind = key);

// Character configurations starting at Level 1
const CHARACTERS = {
    player:     {points: 0, priority: 2, speed: 55, lives: 3, tnts: 1, qty: (() => 0), 
                    speedReductionRate: .10, chompSound: 'chomp',
                    powerUpDuration: 3000, rotationTransform: null},
    scorpion:   {points: 4000, priority: 2, speed: 50, lives: 1, qty: (level => Math.floor((level-1)/2)), 
                    dropObject: OBJECTS.poop, movesToDrop: 50, dropProbability: .75,
                    rotationTransform: [[Direction.UP, 180], [Direction.DOWN, 0], [Direction.LEFT, 90], [Direction.RIGHT, 270]]}, 
    spider:     {points: 2000, priority: 1, speed: 45, lives: 0, qty: (level => level), 
                    isChompable: true, 
                    dropObject: OBJECTS.web, movesToDrop: 50, dropProbability: .75,
                    rotationTransform: [[Direction.UP, 0], [Direction.DOWN, 180], [Direction.LEFT, 270], [Direction.RIGHT, 90]]},
    cat:        {points: 1000, priority: 0, speed: -45, lives: 0, qty: (level => Math.floor(level/2)+1), 
                    isChompable: true, isGrabable: true, grabSound: 'meow', chompSound: 'hiss',
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    mouse:      {points: 2000, priority: 0, speed: -35, lives: 0, qty: (level => level-2), 
                    isChompable: true, isGrabable: true, grabSound: "grab", chompSound: "eat",
                    dropObject: OBJECTS.cheese, movesToDrop: 25, dropProbability: .50,
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    monkey:     {points: 3000, priority: 0, speed: -25, lives: 0, qty: (level => level-4), 
                    isChompable: true, isGrabable: true, grabSound: "grab", chompSound: 'ack',
                    dropObject: OBJECTS.banana, movesToDrop: 25, dropProbability: .50,
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    rock:       {points: 1000, priority: 1, speed: 55, lives: 0, qty: 0, 
                    isChompable: true, chompSound: "splat", allowedDirections: [Direction.DOWN]},
    label:      {points: 0, priority: 0, speed: 0, lives: 0, qty: (() => 0), 
                    isChompable: false, isGrabable: false, grabSound: null, chompSound: null, rotationTransform: null},
};

Object.entries(CHARACTERS).forEach(([key, value]) => value.kind = key);

