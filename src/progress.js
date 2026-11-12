// src/progress.js
// Puzzle timer (Start / Pause / Stop) + saving solve time to Firestore.
// Stop fires the "puzzle-solved" event; the listener below saves it.
// Later, sudoku.js can fire the same event when the board is solved.
import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
// same module sudoku.js loads, so there's only one Bootstrap instance on the page
import { dateKey, nextStreak } from "./streakUtils.js";
import { Modal } from "bootstrap/dist/js/bootstrap.bundle.min.js";

const display = document.getElementById("timer-display");
const startBtn = document.getElementById("timer-start");
const pauseBtn = document.getElementById("timer-pause");
const stopBtn = document.getElementById("timer-stop");
const statusMsg = document.getElementById("timer-status");

const difficultySelect = document.getElementById("difficulty-select");

let elapsedMs = 0; // time from earlier runs (before a pause)
let startedAt = null; // Date.now() of the current run, null when not running
let tick = null;

const totalSeconds = () =>
  Math.floor((elapsedMs + (startedAt ? Date.now() - startedAt : 0)) / 1000);

function render() {
  const s = totalSeconds();
  display.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  startBtn.disabled = startedAt !== null;
  pauseBtn.disabled = startedAt === null;
  stopBtn.disabled = s === 0 && startedAt === null;
}

startBtn.addEventListener("click", () => {
  startedAt = Date.now();
  tick = setInterval(render, 250);
  statusMsg.textContent = "";
  render();
});

pauseBtn.addEventListener("click", () => {
  elapsedMs += Date.now() - startedAt;
  startedAt = null;
  clearInterval(tick);
  render();
});

stopBtn.addEventListener("click", () => {
  const seconds = totalSeconds();
  clearInterval(tick);
  elapsedMs = 0;
  startedAt = null;
  render();
  document.dispatchEvent(
    new CustomEvent("puzzle-solved", {
      detail: { puzzle: "sudoku", difficulty: difficultySelect.value, seconds },
    }),
  );
});

// The select stays disabled until this runs, so a slow load can't overwrite a new choice.
onAuthReady(async (user) => {
  try {
    if (!user) return;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const saved = userDoc.data()?.difficulty;
    if (saved) difficultySelect.value = saved;
  } catch (error) {
    console.error("Error loading difficulty:", error);
    statusMsg.textContent = "Couldn't load your difficulty.";
  } finally {
    difficultySelect.disabled = false;
  }
});

difficultySelect.addEventListener("change", async () => {
  const user = auth.currentUser;
  if (!user) {
    statusMsg.textContent = "Log in to save your difficulty.";
    return;
  }
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { difficulty: difficultySelect.value },
      { merge: true },
    );
    statusMsg.textContent = "";
  } catch (error) {
    console.error("Error saving difficulty:", error);
    statusMsg.textContent = "Couldn't save your difficulty (check your connection or Firestore rules).";
  }
});

document.addEventListener("puzzle-solved", async (event) => {
  const { puzzle, difficulty, seconds } = event.detail;
  const user = auth.currentUser;
  if (!user) {
    statusMsg.textContent = "Log in to save your time.";
    return;
  }
  try {
    await addDoc(collection(db, "users", user.uid, "sessions"), {
      puzzle,
      difficulty,
      seconds,
      solvedAt: serverTimestamp(),
    });
    const userRef = doc(db, "users", user.uid);
    const data = (await getDoc(userRef)).data() || {};
    const streak = nextStreak(data);
    // merge: works even if the user doc is missing these fields (or missing entirely)
    await setDoc(
      userRef,
      {
        totalPuzzleSeconds: increment(seconds),
        streak,
        bestStreak: Math.max(streak, data.bestStreak || 0),
        lastPlayedDate: dateKey(),
      },
      { merge: true },
    );
    statusMsg.textContent = `Saved ${seconds}s. Nice work!`;
  } catch (error) {
    console.error("Error saving puzzle time:", error);
    statusMsg.textContent = "Couldn't save your time (check your connection or Firestore rules).";
  }
});

// Encouraging message after every puzzle; works logged out too.
document.addEventListener("puzzle-solved", async () => {
  let text = "Nice work! That's time well spent off the feed.";
  try {
    const snap = await getDocs(collection(db, "messages"));
    if (!snap.empty) text = snap.docs[Math.floor(Math.random() * snap.size)].data().text || text;
  } catch (error) {
    console.error("Error loading messages:", error);
  }
  document.getElementById("motivation-message").textContent = text;
  Modal.getOrCreateInstance("#motivation-modal").show();
});

render();
