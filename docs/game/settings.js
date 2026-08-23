export { settings }

// Global game settings
class Settings {
  gameStepInterval;
  maxTimeSlice;

  mazesPerLevel;
  maxRows;
  maxCols;
  rows;
  cols;

  pointsPerPath;
  pointsPerFreeLife;
  freeTNTsWithLife;
  maxLives;
  maxTnts;
  mazeClearedBonusPoints;
  caveInThreshold;

  chompPointsFactor;
  blownUpPointsFactor;
  blowUpRecoveryDuration;

  oddsOfBeingHunted;
  powerUpSpeedBoost;
  speedUpRatePerLevel;

  relicChamberSize;

  collisionThreshold;
  positionThreshold;

  pointsPerTrophy;

  constructor() {
    this.setDefaults();
  }

  setDefaults() {
    this.gameStepInterval = 1000/60;
    this.maxTimeSlice = 250;

    this.mazesPerLevel = 3;
    this.maxRows = 21;
    this.maxCols = 19;

    this.cellSize = 24;
    this.rows = 11;
    this.cols = 11;

    this.pointsPerPath = 100;
    this.pointsPerFreeLife = 10000;
    this.freeTNTsWithLife = 5;
    this.maxLives = 5;
    this.maxTnts = 50;
    this.mazeClearedBonusPoints = 5000;
    this.caveInThreshold = .80;

    this.chompPointsFactor = .5;
    this.blownUpPointsFactor = .25;
    this.blowUpRecoveryDuration = 2000;

    this.oddsOfBeingHunted = 10;
    this.powerUpSpeedBoost = 1.5;
    this.speedUpRatePerLevel = 0;

    this.collisionThreshold = 0.55;
    this.positionThreshold = 0.05;

    this.pointsPerTrophy = 100_000;
  }
}

const settings = new Settings();
