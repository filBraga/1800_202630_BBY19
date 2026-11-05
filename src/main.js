
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// import 'bootstrap/dist/css/bootstrap.min.css';
// import 'bootstrap';

// If you have custom global styles, import them as well:
// import '../styles/style.css';

function sayHello() {

}
// document.addEventListener('DOMContentLoaded', sayHello);
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { collection, getDocs, setDoc, query, where, serverTimestamp } from "firebase/firestore";

// Function to fetch the signed-in user's name and display it in the UI
function showName() {

    // Get the DOM element where the user's name will be displayed
    // Example: <h1 id="name-goes-here"></h1>
    const nameElement = document.getElementById("name-goes-here");

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
        const name = userDoc.exists()            // 1️⃣ Use Firestore name if document exists
            ? userDoc.data().name                // 2️⃣ Otherwise fallback to Firebase displayName
            : user.displayName || user.email;    // 3️⃣ Otherwise fallback to email

       // If the DOM element exists, update its text using a template literal to add "!"
        if (nameElement) {
            nameElement.textContent = `${name}!`;
        }
    });
}

showName();

// ---------------------------------------------------------------
// Daily puzzles
// The "puzzles" collection holds one document per puzzle per day,
// tagged with a `date` field (YYYY-MM-DD). The first signed-in
// visitor each day seeds today's set; everyone after just reads it.
// ---------------------------------------------------------------
const DAILY_PUZZLES = [
    { puzzle: "sudoku", difficulty: "Easy", details: "A gentle warm-up grid with plenty of givens." },
    { puzzle: "sudoku", difficulty: "Medium", details: "A balanced grid that rewards steady scanning." },
    { puzzle: "sudoku", difficulty: "Hard", details: "Few givens. Bring your best candidate tricks." },
];
const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };
const DIFFICULTY_BADGE = { easy: "text-bg-success", medium: "text-bg-warning", hard: "text-bg-danger" };

// The key that decides which day's puzzles are "today's".
function todayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // getMonth() is 0-based
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
// Create today's puzzles if they don't exist yet.
async function seedDailyPuzzles(dateKey) {
    const puzzlesRef = collection(db, "puzzles");
    const existing = await getDocs(query(puzzlesRef, where("date", "==", dateKey)));
    if (!existing.empty) {
        console.log("Today's puzzles already exist. Skipping seed.");
        return;
    }
    console.log("Seeding today's puzzles...");
    // Deterministic IDs: if two visitors seed at once they write the same docs.
    await Promise.all(DAILY_PUZZLES.map((p) => {
        const code = `${p.puzzle}-${p.difficulty.toLowerCase()}-${dateKey}`;
        return setDoc(doc(db, "puzzles", code), {
            ...p,
            code,
            name: `Daily ${p.difficulty} Sudoku`,
            date: dateKey,
            last_updated: serverTimestamp(),
        });
    }));
}

// Fetch today's puzzles from Firestore and render one card for each.
async function displayCardsDynamically(dateKey) {
    const cardTemplate = document.getElementById("puzzleCardTemplate");
    const container = document.getElementById("puzzles-go-here");

    try {
        const querySnapshot = await getDocs(
            query(collection(db, "puzzles"), where("date", "==", dateKey)),
        );
        const puzzles = querySnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) =>
                (DIFFICULTY_ORDER[a.difficulty?.toLowerCase()] ?? 99) -
                (DIFFICULTY_ORDER[b.difficulty?.toLowerCase()] ?? 99));

        container.replaceChildren();
        if (puzzles.length === 0) {
            container.textContent = "No puzzles available today. Check back soon!";
            return;
        }

        puzzles.forEach((puzzle) => {
            const newcard = cardTemplate.content.cloneNode(true);
            const level = (puzzle.difficulty || "easy").toLowerCase();

            newcard.querySelector(".card-title").textContent = puzzle.name;
            newcard.querySelector(".card-text").textContent = puzzle.details || "";
            const badge = newcard.querySelector(".card-difficulty");
            badge.textContent = puzzle.difficulty;
            badge.classList.add(DIFFICULTY_BADGE[level] || "text-bg-secondary");
            // sudoku.html / progress.js read ?difficulty= to tag the saved solve time
            newcard.querySelector(".play-btn").href =
                `sudoku.html?difficulty=${encodeURIComponent(level)}&docID=${puzzle.id}`;

            container.appendChild(newcard);
        });
    } catch (error) {
        console.error("Error getting documents: ", error);
        container.textContent = "Couldn't load today's puzzles. Please try again.";
    }
}

// Seed (if needed) and then display, only once we know who is signed in.
onAuthReady(async (user) => {
    if (!user) return; // showName() already redirects logged-out users
    const dateKey = todayKey();
    try {
        await seedDailyPuzzles(dateKey);
    } catch (error) {
        console.error("Error seeding daily puzzles: ", error);
    }
    await displayCardsDynamically(dateKey);
});
