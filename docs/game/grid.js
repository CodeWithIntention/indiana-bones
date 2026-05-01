import { Direction } from "./util.js";
import { OBJECTS } from "./config.js";
import { Character } from "./character.js";
import { Label } from "./characters.js";

export { Maze, Grid }

class Maze {
  #maze;

  constructor(rows, cols, cellSize) {
    this.cellSize = cellSize;
    this.#createGrid(rows, cols);
          
    // Ensure the exit is cleared
    this.placeObjectAt(this.rows - 2, this.cols - 2, OBJECTS.path);
    this.placeObjectAt(this.rows - 2, this.cols - 1, OBJECTS.exit);
  }

  get rows() {
    return this.#maze.length;
  }

  get cols() {
    return this.#maze[0].length;
  }

  objectAt(row, col) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return this.#maze[row][col];
    }
    return null;
  }

  placeObjectAt(row, col, obj) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.#maze[row][col] = obj;
    }
  }

  objectKindAt(row, col) {
    const obj = this.objectAt(row, col);
    return obj.kind;
  }

  #createGrid(rows, cols) {
    const maze = Array.from({ length: rows }, () =>
      Array(cols).fill(OBJECTS.wall),
    );

    for (let row = 0; row < rows; row++) {
      if (row === 0 || row === rows - 1) {
        for (let col = 0; col < cols; col++) {
          maze[row][col] = OBJECTS.edge;
        }
      } else {
        maze[row][0] = maze[row][cols - 1] = OBJECTS.edge;
      }
    }

    function carve(row, col) {
      maze[row][col] = OBJECTS.path;

      const directions = [
        [0, 2],
        [0, -2],
        [2, 0],
        [-2, 0],
      ];

      Direction.shuffle(directions);

      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;

        if (
          newRow > 0 &&
          newRow < rows - 1 &&
          newCol > 0 &&
          newCol < cols - 1 &&
          maze[newRow][newCol] === OBJECTS.wall
        ) {
          maze[row + dr / 2][col + dc / 2] = OBJECTS.path;
          carve(newRow, newCol);
        }
      }
    }

    carve(1, 1);

    this.#maze = maze;
  }
}

class Grid {
  static mazeEl = document.getElementById("maze");

  static symbolFor(name) {
    if (name) return getComputedStyle(this.mazeEl).getPropertyValue(`--sym-${name}`).replaceAll('"', '');
    return null;
  }

  #maze;
  #cells;
  #collisionPercentage;

  constructor(rows, cols, cellSize) {
    this.#maze = new Maze(rows, cols, cellSize);
    this.#cells = null;
    this.#collisionPercentage = .5;

    this.#createCells(this.#maze);
  }

  get maze() {
    return this.#maze;
  }

  get rows() {
    return this.#cells.length;
  }

  get cols() {
    return this.#cells[0].length;
  }

  get cellSize() {
    return this.#cells[0][1].offsetLeft;
  }

  get isMazeCleared() {
    for (let row = 1; row < this.rows-1; row++) {
      for (let col = 1; col < this.cols-1; col++) {
        const objectAtRowCol = this.#maze.objectAt(row, col);

        if (!(objectAtRowCol === OBJECTS.wall || objectAtRowCol === OBJECTS.path)) return false;
      }
    }
    return true;
  }

  cellAtRowCol(row, col) {
    if (!(row >= 0 && row < this.rows && col >= 0 && col < this.cols)) return null;

    return this.#cells[row][col];
  }

  cellRectAtRowCol(row, col) {
    const cell = this.cellAtRowCol(row, col);
    return (cell && cell.getBoundingClientRect()) || null;
  }

  objectAt(characterOrRow, col) {
    let targetRow;
    let targetCol;

    if (characterOrRow instanceof Character) {
      targetRow = characterOrRow.row;
      targetCol = characterOrRow.col;
    } else {
      targetRow = Number(characterOrRow);
      targetCol = Number(col);
    }

    return this.#maze.objectAt(targetRow, targetCol);
  }

  isCharacterAtEntrance(character) {
    return character.row === 1 && character.col === 0;
  }

  canCharacterSeeTheOther(character, other, sightDistance = Infinity) {
    if (!(other instanceof Character && character instanceof Character) || !Direction.isGood(character.direction)) return false;
    if (character.row === other.row && character.col === other.col) return true;
    if (character.row !== other.row && character.col !== other.col) return false;

    const there = character.manhattanDistanceTo(other);
    if (!Number.isFinite(there) && there <= sightDistance) return false;
    
    let row = character.row;
    let col = character.col;
    let distance;

    do {
      row += character.direction[0];
      col += character.direction[1];

      if (!Grid.canMoveTo(row, col, other.priority === 1)) return false;
      distance = other.manhattanDistanceTo(row, col);
    } while (distance > 0 && distance < there);

    return distance === 0;
  }

  render(visitor) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.updateCellAtRowCol(row, col);
        visitor(cell, row, col);
      }
    }
  }

  updateCellAtRowCol(row, col) {
    const cell = this.cellAtRowCol(row, col);
    if (cell) {
        cell.className = "cell";
        cell.classList.add(this.#maze.objectKindAt(row, col));
    };
    return cell;
  }

  addScoreCharacterFor(character, score, duration) {
    const style = score < 0 ? "score minus" : "score";
    this.addHtmlCharacterFor(character, `<span class='${style}'>${String(Math.abs(score))}</span>`, duration);
  }

  addLabelCharacterFor(character, text, duration) {
    this.addHtmlCharacterFor(character, `<span>${text}</span>`, duration);
  }

  addHtmlCharacterFor(character, html, duration) {
    if (!((character instanceof Character) || text)) return;
    
    const label = new Label(character.row, character.col);
    this.addCharacter(label, character.gridCell.offsetTop, character.gridCell.offsetLeft);
    label.gridCell.innerHTML = html;
    
    if (duration > 0) {
      setTimeout(this.removeCharacter, duration, label);
    }
  }

  addCharacter(character, top, left) {
    if (!(character instanceof Character)) return;
    if (character.gridCell && character.gridCell.parent === Grid.mazeEl) return;

    character.gridCell = this.#createCell();
    character.gridCell.classList.add("character", character.kind);

    this.placeCharacter(character, top, left);
  }

  removeCharacter(character) {
    if (!(character instanceof Character)) return;

    const characterCell = character.gridCell;
    if (characterCell) {
        character.gridCell = null;
        characterCell.remove();
    }
  }

  placeCharacter(character, top, left) {
    const characterCell = character.gridCell;
    
    if (characterCell) {
      let offsetTop = top;
      let offsetLeft = left;

      if (!(Number.isFinite(offsetTop) && Number.isFinite(offsetLeft))) {
        const cell = this.cellAtRowCol(character.row, character.col);
        if (cell) {
          offsetTop = cell.offsetTop;
          offsetLeft = cell.offsetLeft;
        }
      }
      if (Number.isFinite(offsetTop) && Number.isFinite(offsetLeft)) {
        characterCell.style.top = `${offsetTop}px`;
        characterCell.style.left = `${offsetLeft}px`;
      }
      this.#orientCharacter(character, characterCell);
    }
  }

  #orientCharacter(character, characterCell) {
    const rotationTransform = character.rotationTransform;

    if (rotationTransform && rotationTransform.length > 0 && rotationTransform[0].length == 2) {
        const transformMap = new Map(rotationTransform);
        const rotationAngle = Number(transformMap.get(character.direction));

        if (Number.isInteger(rotationAngle)) {
            const rotateFunc = rotationAngle < 0 ? "rotateY" : "rotate";
            characterCell.style.transform = `${rotateFunc}(${Math.abs(rotationAngle)}deg)`;
        }
    }
  }

  haveCollided(character1, character2) {
    return this.hasRectCollidedWithRect(character1.gridCell.getBoundingClientRect(), 
      character2.gridCell.getBoundingClientRect());
  }

  hasCharacterCollidedWithRect(character, rect) {
    return this.hasRectCollidedWithRect(rect, character.gridCell.getBoundingClientRect());
  }

  hasRectCollidedWithRect(rect1, rect2) {
    if (!(rect1 && rect2)) return false;
    
    const targetWidth = rect2.right - rect2.left;
    const targetHeight = rect2.bottom - rect2.top;

    const widthSpan = (rect1.right - rect1.left) + targetWidth;
    const heightSpan = (rect1.bottom - rect1.top) + targetHeight;

    const widthCollision = rect1.left < rect2.left ? rect2.right - rect1.left : rect1.right - rect2.left;
    const heightCollision = rect1.top < rect2.top ? rect2.bottom - rect1.top : rect1.bottom - rect2.top;
  
    return widthCollision < widthSpan && heightCollision < heightSpan &&
      ((widthSpan - widthCollision) / targetWidth >= this.#collisionPercentage) && 
      ((heightSpan - heightCollision) / targetHeight >= this.#collisionPercentage);
  }
  
  #hasCharacterArrived(character, characterCell) {
    const MIN_COURSE_CORRECTION_DISTANCE = 2;
    const cell = this.cellAtRowCol(character.row, character.col);
    if (!cell) return false;

    return (Math.abs(characterCell.offsetLeft - cell.offsetLeft) < MIN_COURSE_CORRECTION_DISTANCE) 
      && (Math.abs(characterCell.offsetTop - cell.offsetTop) < MIN_COURSE_CORRECTION_DISTANCE);
  }

  moveCharacter(character, direction, delta, row, col) {
    // reserved: row, col

    if (!(character instanceof Character)) return;

    const characterCell = character.gridCell;
    
    if (characterCell) {
        // Test if character is not enroute
        if (direction !== character.direction) {
          if (Direction.isOnSameLine(character.direction, direction)) {
            // Allow transitional direction 
            character.direction = direction;
            this.#orientCharacter(character, characterCell);
          } else if (this.#hasCharacterArrived(character, characterCell)) {
            // Commit to new course
            character.direction = direction;
            this.placeCharacter(character);
          }
        }
        this.#updateCharacterPosition(character, characterCell, delta);
    }
  }

  isCharacterEnroute(character, delta) {
    if (!(character instanceof Character && Direction.isGood(character.direction))) return false;

    const characterCell = character.gridCell;
    
    if (characterCell) {
        this.#updateCharacterPosition(character, characterCell, delta);
        return !this.#hasCharacterArrived(character, characterCell);
    }
    return false;
  }

  #updateCharacterPosition(character, characterCell, delta) {
    character.updateVelocity(character.direction, delta);

    const currentRow = character.row;
    const currentCol = character.col;

    const offsetTop = characterCell.offsetTop + character.vy;
    const offsetLeft = characterCell.offsetLeft + character.vx;

    const row = offsetTop / this.cellSize;
    const col = offsetLeft / this.cellSize;

    let nextRow = Direction.isUp(character.direction) ? Math.floor(row) : Math.ceil(row);
    let nextCol = Direction.isLeft(character.direction) ? Math.floor(col) : Math.ceil(col);
   
    if (Grid.canMoveTo(nextRow, nextCol, character.priority === 1)) {
      nextRow = Direction.isUp(character.direction) ? Math.ceil(row) : Math.floor(row);
      nextCol = Direction.isLeft(character.direction) ? Math.ceil(col) : Math.floor(col);

      characterCell.style.top = `${offsetTop}px`;
      characterCell.style.left = `${offsetLeft}px`;

      character.row = nextRow;
      character.col = nextCol;
    } else {
        character.row = nextRow - character.direction[0];
        character.col = nextCol - character.direction[1];
        this.placeCharacter(character);
    }

    if (character.row !== currentRow || character.col !== currentCol) {
        character.moves++;
        Grid.onCharacterMoved(character);
    }
  }

  showCharacterLabel(character, label, duration) {
    const hideLabel = (label) => {
      if (label && label !== characterCell.textContent) return;
      characterCell.innerHTML = "";
    }

    if (!(character instanceof Character)) return;

    const characterCell = character.gridCell;

    if (characterCell) {
      if (label) {
        if (duration < 0) {
          hideLabel(label);
        } else {
          characterCell.innerHTML = `<span>${label}</span>`;
          if (duration > 0) {
            setTimeout(hideLabel, duration, label);
          }
        }
      } else {
        hideLabel();
      }
    }
  }

  setCharacterAttributes(character, attributes) {
    if (!(character instanceof Character)) return;

    const characterCell = character.gridCell;

    if (characterCell) {
        for (const [key, value] of Object.entries(attributes)) {
          characterCell.classList.toggle(key, value);
        }
    }
  }

  placeObjectAt(row, col, obj) {
    this.maze.placeObjectAt(row, col, obj);
    this.updateCellAtRowCol(row, col);
  }

  #createCells(maze) {
    Grid.mazeEl.style.gridTemplateColumns = `repeat(${maze.cols}, ${maze.cellSize}px)`;
    Grid.mazeEl.innerHTML = "";
    let cells = [];

    for (let row = 0; row < maze.rows; row++) {
      const cellRow = [];

      for (let col = 0; col < maze.cols; col++) {
        const cell = this.#createCell();
        cellRow.push(cell);
      }

      cells.push(cellRow);
    }

    this.#cells = cells;
  }

  #createCell() {
    const cell = Grid.mazeEl.ownerDocument.createElement("div");

    cell.className = "cell";
    cell.style.width = `${maze.cellSize}px`;
    cell.style.height = `${maze.cellSize}px`;

    Grid.mazeEl.appendChild(cell);

    return cell;
  }
}
