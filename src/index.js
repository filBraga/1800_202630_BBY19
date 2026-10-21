import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/index.css";

const SUDOKU_GRID_WIDTH = 9;
const SUDOKU_GRID_HEIGHT = 9;

// someone make it suck less where possible
function generateSudokuBoard() {
  const size = 9;
  const board = [];

  // Shuffle an array randomly
  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Shuffle the digits 1–9
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  // Shuffle the order of the 3 row groups
  const rowGroups = shuffle([0, 1, 2]);

  // Shuffle the order of the 3 column groups
  const colGroups = shuffle([0, 1, 2]);

  const rows = [];
  const cols = [];

  for (const group of rowGroups) {
    for (const row of shuffle([0, 1, 2])) {
      rows.push(group * 3 + row);
    }
  }

  for (const group of colGroups) {
    for (const col of shuffle([0, 1, 2])) {
      cols.push(group * 3 + col);
    }
  }

  for (let r = 0; r < size; r++) {
    const currentRow = [];

    for (let c = 0; c < size; c++) {
      const pattern = (rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9;
      currentRow.push(numbers[pattern]);
    }

    board.push(currentRow);
  }

  return board;
}

let currentlySelected = null;

const drawGrid = (width, height) => {
  const boardValues = generateSudokuBoard();
  const board = document.getElementById("sudoku-board");

  board.style.gridTemplateColumns = `repeat(${width}, 1fr)`;

  for (let i = 0; i < width * height; i++) {
    const row = Math.floor(i / width);
    const col = i % width;
    const box = document.createElement("div");

    box.textContent = boardValues[row][col];
    box.classList.add(
      "d-flex",
      "justify-content-center",
      "align-items-center",
      "border",
      "border-dark",
      "border-2",
    );
    box.style.userSelect = "none";
    box.addEventListener("click", (event) => {
      const boxClicked = event.currentTarget;

      if (currentlySelected === null) {
        currentlySelected = boxClicked;
        currentlySelected.style.background = "yellow";
        return;
      }

      if (currentlySelected === boxClicked) {
        currentlySelected.style.background = "white";
        return;
      }

      currentlySelected.style.background = "white";
      currentlySelected = boxClicked;
      currentlySelected.style.background = "yellow";
    });

    board.appendChild(box);
  }
};

drawGrid(SUDOKU_GRID_WIDTH, SUDOKU_GRID_HEIGHT);
