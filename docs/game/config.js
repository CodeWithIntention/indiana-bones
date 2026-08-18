import { Direction } from "./util.js";

export { OBJECTS, CHARACTERS, MESSAGES, TIMEOUTS, RELIC_CHAMBERS }

const MESSAGES = {
  mazeClearedMessage: "Cave Bonus",
  mazeNotClearedMessage: "Cave NOT emptied!",
  relicRetrievedMessage: "Relic Bonus",
  nextMazeLinkText: "Go Deeper",
  nextLevelLinkText: "Next Level",
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
  guardianDelay: 3000,
  guardianDelayLevelReduction: 200,
}

// Object configurations
const OBJECTS = {
    tnt:        {points: 100, qty: (level => level), grabSound: 'pickup', priority: 1.5},
    bone:       {points: 1000, qty: (level => level*2), grabSound: 'grab', priority: 0},
    fountain:   {points: 5000, qty: (level => level-1), grabSound: 'powerup', priority: 0},
    
    cheese:     {points: 200, qty: (() => 0), grabSound: 'grab', priority: 0},
    banana:     {points: 300, qty: (() => 0), grabSound: 'grab', priority: 0},
    gem:        {points: 10000, qty: (() => 0), grabSound: 'dingDing', priority: 0, isBaggable: false},

    web:        {points: NaN, qty: (() =>  0), priority: 0, 
                  speedReduction: .50, speedReductionDuration: 1000, speedReductionReason: 'webbed', grabSound: 'oops', priority: 0},
    poop:       {points: NaN, qty: (() =>  0), priority: 0, 
                  speedReduction: .75, speedReductionDuration: 2000, speedReductionReason: 'pooped', grabSound: 'oops', priority: 0},

    key:        {points: NaN, qty: (level => level), inWalls: true, grabSound: 'grab', priority: 2, fixed: true},

    path:       {priority: 0, visitable: true,  fixed: false},
    rock:       {priority: 4, visitable: false, fixed: true},
    wall:       {priority: 3.5, visitable: false, fixed: false,
                  speedReduction: .75, speedReductionDuration: 500, speedReductionReason: 'phasing'},
    edge:       {priority: 4, visitable: false, fixed: true},
    exit:       {priority: 2, visitable: true, fixed: true},
};

Object.entries(OBJECTS).forEach(([key, value]) => value.kind = key);

// Character configurations starting at Level 1
const CHARACTERS = {
    player:     {points: 0, priority: 2, speed: 55, lives: 3, tnts: 1, qty: () => 0, 
                    chompSound: 'chomp',
                    powerUpDuration: 3000, rotationTransform: null},
    ghost:      {points: 0, priority: 3, speed: 60, lives: -1, qty: (level => 0), 
                    phaseProbability: .50,
                    rotationTransform: null}, 
    scorpion:   {points: 4000, priority: 2, speed: 50, lives: 1, qty: (level => Math.floor((level-1)/2)), 
                    dropObject: OBJECTS.poop, movesToDrop: 50, dropProbability: .75,
                    rotationTransform: [[Direction.UP, 180], [Direction.DOWN, 0], [Direction.LEFT, 90], [Direction.RIGHT, 270]]}, 
    spider:     {points: 2000, priority: 1, speed: 45, lives: 0, qty: (level => level), 
                    isChompable: true, 
                    dropObject: OBJECTS.web, movesToDrop: 50, dropProbability: .75,
                    rotationTransform: [[Direction.UP, 0], [Direction.DOWN, 180], [Direction.LEFT, 270], [Direction.RIGHT, 90]]},
    cat:        {points: 1000, priority: 0.75, speed: -45, lives: 0, qty: (level => Math.floor(level/2)+1), 
                    isChompable: true, isGrabable: true, grabSound: 'meow', chompSound: 'hiss',
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    mouse:      {points: 2000, priority: 0.75, speed: -35, lives: 0, qty: (level => level-2), 
                    isChompable: true, isGrabable: true, grabSound: "grab", chompSound: "eat",
                    dropObject: OBJECTS.cheese, movesToDrop: 25, dropProbability: .50,
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    monkey:     {points: 3000, priority: 0.75, speed: -25, lives: 0, qty: (level => level-4), 
                    isChompable: true, isGrabable: true, grabSound: "grab", chompSound: 'ack',
                    dropObject: OBJECTS.banana, movesToDrop: 25, dropProbability: .50,
                    rotationTransform: [[Direction.UP, 90], [Direction.DOWN, 270], [Direction.LEFT, 0], [Direction.RIGHT, -180]]},
    rock:       {points: 1000, priority: 2.5, speed: 55, lives: 0, qty: () => 0, 
                    isChompable: true, chompSound: "splat", allowedDirections: [Direction.DOWN],
                    dropObject: OBJECTS.gem, movesToDrop: 1, dropProbability: .005},
    relic:      {points: 50000, priority: 4, speed: 0, lives: 0, qty: () => 0, 
                    isChompable: false, isGrabable: true, isBaggable: false, isRelic: true},
    skull:      {points: 10000, priority: 4, speed: 0, lives: 0, qty: () => 0, 
                    isChompable: false, isGrabable: true, isBaggable: false, isRelic: true},
    label:      {points: 0, priority: 0, speed: 0, lives: 0, qty: () => 0, 
                    isChompable: false, isGrabable: false},
};

Object.entries(CHARACTERS).forEach(([key, value]) => value.kind = key);

const RELIC_CHAMBERS = [
    // Level 1 — 3x3 Diamond
    // Introduces the mechanic with no ambiguity.
    [
        "010",
        "111",
        "010",
    ],

    // Level 2 — 5x5 Chamber
    // Bigger visually, but only 13 rocks.
    [
        "01110",
        "11011",
        "10101",
        "11011",
        "01110"
    ],

    // Level 3 — 5x5 Chamber
    [
        "11011",
        "11011",
        "00100",
        "11011",
        "11011"
    ],

    // Level 4 — 7x7 Stepped Pyramid
    [
        "0001000",
        "0011100",
        "0010100",
        "0111110",
        "0101010",
        "1111111",
        "1111111"
    ],

    // Level 5 — 7x7 Church
    [
        "0011100",
        "0110110",
        "1100011",
        "1110111",
        "1110111",
        "1100011",
        "1111111"
    ],

    // Level 6 — 7x7 Fortress
    [
        "1111111",
        "1000001",
        "1011101",
        "1011101",
        "1011101",
        "1000001",
        "1111111"
    ],

    // Level 7 — 9x9 Spiral Maze
    [
        "111111111",
        "000000001",
        "111111101",
        "100000101",
        "101110101",
        "101010101",
        "101011101",
        "101000000",
        "111111111"
    ],

    // Level 7 — 9x9 Spider
    [
        "100010001",
        "110111011",
        "011111110",
        "001111100",
        "011111110",
        "110111011",
        "100010001",
        "010000010",
        "100000001"
    ],

    // Level 9 — 9x9 Ghost
    [
        "001111100",
        "011111110",
        "111111111",
        "110111011",
        "110111011",
        "111111111",
        "111111111",
        "110101011",
        "100010001"
    ],

    // Level 10 — 11x11 Skull
    [
        "00011111000",
        "00111111100",
        "01111111110",
        "11001110011",
        "11001110011",
        "11111111111",
        "11111011111",
        "01110001110",
        "00111111100",
        "00011111000",
        "00010101000"
    ]
];
