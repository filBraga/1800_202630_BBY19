// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// import 'bootstrap/dist/css/bootstrap.min.css';
// import 'bootstrap';

// If you have custom global styles, import them as well:
// import '../styles/style.css';

function sayHello() {}

// document.addEventListener('DOMContentLoaded', sayHello);
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { setDoc, serverTimestamp } from "firebase/firestore";

// Function to fetch the signed-in user's name and display it in the UI
function showName() {
    // Get the DOM element where the user's name will be displayed
    // Example: <h1 id="name-goes-here"></h1>
    const nameElement = document.getElementById("name-goes-here");

    const d = (date = new Date()) =>
        date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    console.log(d(new Date()));

    // Wait until Firebase Auth finishes checking the user's auth state
    onAuthReady(async (user) => {
        // If no user is logged in, redirect to the login page
        if (!user) {
            location.href = "index.html";
            return; // Stop execution
        }

        // Get the user's Firestore document from the "users" collection
        // Document ID is the user's unique UID
        const userDoc = await getDoc(doc(db, "users", user.uid));

        // Determine which name to display:
        const name = userDoc.exists() // 1️⃣ Use Firestore name if document exists
            ? userDoc.data().name // 2️⃣ Otherwise fallback to Firebase displayName
            : user.displayName || user.email; // 3️⃣ Otherwise fallback to email

        // If the DOM element exists, update its text using a template literal to add "!"
        if (nameElement) {
            nameElement.textContent = `${name}!`;
        }
    });
}

showName();

function greetUser() {
    const greetingElement = document.getElementById("greeting-goes-here");
    if (greetingElement) {
        const now = new Date();
        const hours = now.getHours();
        let greeting;

        if (hours >= 6 && hours < 12) {
            greeting = "Good morning, ";
        } else if (hours >= 12 && hours < 18) {
            greeting = "Good afternoon, ";
        } else {
            greeting = "Good evening, ";
        }

        greetingElement.textContent = greeting;
    }
}

greetUser();

// ---------------------------------------------------------------
// Daily puzzle
// The "puzzles" collection holds one document per puzzle per
// difficulty per day, tagged with a `date` field (YYYY-MM-DD).
// Each user sees ONE card: the one matching the difficulty they
// chose on their profile (users/{uid}.difficulty). The first
// visitor who needs a given difficulty each day seeds it; everyone
// after just reads it.
// ---------------------------------------------------------------
// Keyed by the lowercase value stored in the user's profile.
const DAILY_PUZZLES = {
    easy: {
        puzzle: "sudoku",
        difficulty: "Easy",
        details: "A gentle warm-up grid with plenty of givens.",
    },
    medium: {
        puzzle: "sudoku",
        difficulty: "Medium",
        details: "A balanced grid that rewards steady scanning.",
    },
    hard: {
        puzzle: "sudoku",
        difficulty: "Hard",
        details: "Few givens. Bring your best candidate tricks.",
    },
};
// Used when the user hasn't picked a difficulty yet (or it's unrecognised).
const DEFAULT_DIFFICULTY = "easy";
const DIFFICULTY_BADGE = {
    easy: "text-bg-success",
    medium: "text-bg-warning",
    hard: "text-bg-danger",
};

// The key that decides which day's puzzles are "today's".
function todayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // getMonth() is 0-based
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
// Read the difficulty the user chose on their profile, falling back to the
// default if they haven't chosen one (or the stored value isn't recognised).
async function getUserDifficulty(uid) {
    const userDoc = await getDoc(doc(db, "users", uid));
    const saved = userDoc.data()?.difficulty;
    return Object.hasOwn(DAILY_PUZZLES, saved) ? saved : DEFAULT_DIFFICULTY;
}

// Create today's puzzle for this difficulty if it doesn't exist yet.
// Returns the puzzle's document ID so the caller can display it.
async function seedDailyPuzzles(dateKey, difficulty) {
    const p = DAILY_PUZZLES[difficulty];
    // Deterministic ID: if two visitors seed at once they write the same doc.
    const code = `${p.puzzle}-${difficulty}-${dateKey}`;
    const puzzleRef = doc(db, "puzzles", code);

    if ((await getDoc(puzzleRef)).exists()) {
        console.log(`Today's ${difficulty} puzzle already exists. Skipping seed.`);
        return code;
    }
    console.log(`Seeding today's ${difficulty} puzzle...`);
    await setDoc(puzzleRef, {
        ...p,
        code,
        name: `Daily ${p.difficulty} Sudoku`,
        date: dateKey,
        last_updated: serverTimestamp(),
    });
    return code;
}

// Fetch today's puzzle from Firestore and render its single card.
async function displayCardsDynamically(puzzleId) {
    const cardTemplate = document.getElementById("puzzleCardTemplate");
    const container = document.getElementById("puzzles-go-here");

    try {
        const docSnap = await getDoc(doc(db, "puzzles", puzzleId));

        container.replaceChildren();
        if (!docSnap.exists()) {
            container.textContent =
                "No puzzle available today. Check back soon!";
            return;
        }

        const puzzle = docSnap.data();
        const newcard = cardTemplate.content.cloneNode(true);
        const level = (puzzle.difficulty || "easy").toLowerCase();

        newcard.querySelector(".card-title").textContent = puzzle.name;
        newcard.querySelector(".card-text").textContent = puzzle.details || "";
        const badge = newcard.querySelector(".card-difficulty");
        badge.textContent = puzzle.difficulty;
        badge.classList.add(DIFFICULTY_BADGE[level] || "text-bg-secondary");
        // sudoku.html / progress.js read ?difficulty= to tag the saved solve time
        newcard.querySelector(".play-btn").href =
            `sudoku.html?difficulty=${encodeURIComponent(level)}&docID=${docSnap.id}`;

        container.appendChild(newcard);
    } catch (error) {
        console.error("Error getting documents: ", error);
        container.textContent =
            "Couldn't load today's puzzle. Please try again.";
    }
}

// Look up the user's difficulty, seed (if needed), then display — only once
// we know who is signed in.
onAuthReady(async (user) => {
    if (!user) return; // showName() already redirects logged-out users
    const dateKey = todayKey();
    try {
        const difficulty = await getUserDifficulty(user.uid);
        const puzzleId = await seedDailyPuzzles(dateKey, difficulty);
        await displayCardsDynamically(puzzleId);
    } catch (error) {
        console.error("Error loading daily puzzle: ", error);
        document.getElementById("puzzles-go-here").textContent =
            "Couldn't load today's puzzle. Please try again.";
    }
});
