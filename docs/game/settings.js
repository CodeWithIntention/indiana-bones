export { Settings }

// Global game settings
class Settings {
  mazesPerLevel;
  maxRows;
  maxCols;
  rows;
  cols;

  pointsPerFreeLife;
  freeTNTsWithLife;
  mazeClearedBonusPoints;

  chompPointsFactor;
  blownUpPointsFactor;
  blowUpRecoveryDuration;

  oddsOfBeingHunted;
  powerUpSpeedBoost;
  speedUpRatePerLevel;

  constructor() {
    this.setDefaults();
  }

  setDefaults() {
    this.mazesPerLevel = 3;
    this.maxRows = 21;
    this.maxCols = 19;

    this.cellSize = 24;
    this.rows = 9;
    this.cols = 9;

    this.pointsPerFreeLife = 10000;
    this.freeTNTsWithLife = 5;
    this.mazeClearedBonusPoints = 5000;

    this.chompPointsFactor = .5;
    this.blownUpPointsFactor = .25;
    this.blowUpRecoveryDuration = 2000;

    this.oddsOfBeingHunted = 10;
    this.powerUpSpeedBoost = 1.5;
    this.speedUpRatePerLevel = .05;
  }
}
