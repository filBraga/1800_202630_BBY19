import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/index.css";
import "../styles/sudoku.css";

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
            const pattern =
                (rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9;
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

//drawGrid(SUDOKU_GRID_WIDTH, SUDOKU_GRID_HEIGHT);

let candidateMode = false;
let selectedCell = null;

const board = document.getElementById("board");
const numberButtons = document.getElementById("numbers");

// Store the state of all 81 cells
const cells = [];
const numbers = generateSudokuBoard();

// Create Sudoku board
for (let i = 0; i < 81; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");

    const actualNumber = document.createElement("span");
    actualNumber.classList.add("actual-number");
    actualNumber.innerText = numbers[Math.floor(i / 9)][i % 9];

    const candidatesContainer = document.createElement("div");
    candidatesContainer.classList.add("candidates");

    const candidateElements = [];

    // Create 9 candidate positions
    for (let n = 1; n <= 9; n++) {
        const candidate = document.createElement("span");
        candidatesContainer.appendChild(candidate);
        candidateElements.push(candidate);
    }

    cell.appendChild(actualNumber);
    cell.appendChild(candidatesContainer);

    // Data for this cell
    const cellData = {
        element: cell,
        value: null,
        candidates: new Set(),
        actualElement: actualNumber,
        candidateElements: candidateElements,
    };

    cells.push(cellData);

    // Select cell
    cell.addEventListener("click", () => {
        selectCell(cellData);
    });

    board.appendChild(cell);
}

// Select a cell
function selectCell(cellData) {
    if (selectedCell) {
        selectedCell.element.classList.remove("selected");
    }

    selectedCell = cellData;

    selectedCell.element.classList.add("selected");
}

// Enter a number
function enterNumber(number) {
    if (!selectedCell) return;

    if (candidateMode) {
        toggleCandidate(selectedCell, number);
    } else {
        setCellValue(selectedCell, number);
    }
}

// Toggle candidate number
function toggleCandidate(cell, number) {
    // Don't add candidates to filled cells
    if (cell.value !== null) return;

    if (cell.candidates.has(number)) {
        cell.candidates.delete(number);
    } else {
        cell.candidates.add(number);
    }

    renderCell(cell);
}

// Set actual number
function setCellValue(cell, number) {
    cell.value = number;

    // Clear candidates
    cell.candidates.clear();

    renderCell(cell);
}

// Erase cell
function eraseCell(cell) {
    cell.value = null;
    cell.candidates.clear();

    renderCell(cell);
}

// Update cell appearance
function renderCell(cell) {
    cell.actualElement.textContent = cell.value !== null ? cell.value : "";

    cell.candidateElements.forEach((element, index) => {
        const number = index + 1;

        element.textContent = cell.candidates.has(number) ? number : "";
    });
}

// Create number buttons
for (let n = 1; n <= 9; n++) {
    const button = document.createElement("button");

    button.textContent = n;
    button.dataset.number = n;
    button.classList.add("number-button");

    button.addEventListener("click", () => {
        enterNumber(n);
    });

    numberButtons.appendChild(button);
}

// Mode controls
const normalButton = document.getElementById("normal-button");
const pencilButton = document.getElementById("pencil-button");
const eraseButton = document.getElementById("erase-button");

normalButton.addEventListener("click", () => {
    candidateMode = false;

    normalButton.classList.add("active");
    pencilButton.classList.remove("active");
});

pencilButton.addEventListener("click", () => {
    candidateMode = true;

    pencilButton.classList.add("active");
    normalButton.classList.remove("active");
});

eraseButton.addEventListener("click", () => {
    if (!selectedCell) return;

    eraseCell(selectedCell);
});

// Keyboard input
document.addEventListener("keydown", (event) => {
    if (!selectedCell) return;

    if (event.key >= "1" && event.key <= "9") {
        enterNumber(Number(event.key));
    }

    if (event.key === "Backspace" || event.key === "Delete") {
        eraseCell(selectedCell);
    }

    if (event.key === "Escape") {
        if (selectedCell) {
            selectedCell.element.classList.remove("selected");
            selectedCell = null;
        }
    }
});
