export { settings }

// Global game settings
class Settings {
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

  constructor() {
    this.setDefaults();
  }

  setDefaults() {
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
    this.maxTnts = 99;
    this.mazeClearedBonusPoints = 5000;
    this.caveInThreshold = .80;

    this.chompPointsFactor = .5;
    this.blownUpPointsFactor = .25;
    this.blowUpRecoveryDuration = 2000;

    this.oddsOfBeingHunted = 10;
    this.powerUpSpeedBoost = 1.5;
    this.speedUpRatePerLevel = .05;
  }
}

const settings = new Settings();
