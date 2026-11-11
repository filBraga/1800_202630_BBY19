import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
    collection,
    getDocs,
    query,
    where,
    documentId,
    setDoc,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";

// The fields we store in Firestore (email comes from Auth, not from here)
const fields = ["name", "country", "school", "bio"];
let currentUser = null;
let favourites = []; // used in Part 3

onAuthReady(async function (user) {
    if (!user) {
        location.href = "index.html";
    } else {
        currentUser = user;

        // 1. Read the document
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.data() || {};
        favourites = data.favourites || [];

        // 2. Header: avatar initial, name, email
        showHeader(data.name || user.displayName || user.email, user.email);

        // 3. Pre-populate each input (empty string if the field doesn't exist yet)
        fields.forEach((field) => {
            document.getElementById(field + "Input").value = data[field] || "";
        });
        // 4. NOW favourites is filled, so draw the cards
        displayFavourites();
    }
});

// Fill the header: first letter in the circle, name, email
function showHeader(name, email) {
    document.getElementById("avatar").textContent = name
        .charAt(0)
        .toUpperCase(); //Get the first letter of the name in uppercase (e.g. "elmo" → "E")
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileEmail").textContent = email;
}
// ---- (1) What to do when Edit is clicked ----
function enableEdit() {
    fields.forEach(
        (field) => (document.getElementById(field + "Input").disabled = false),
    );
    document.getElementById("saveBtn").disabled = false;
    document.getElementById("nameInput").focus();
}

// ---- (2) Connect it to the button ----
document.getElementById("editBtn").addEventListener("click", enableEdit);

// ---- (1) What to do when the profile form is submitted ----
async function saveProfile(event) {
    event.preventDefault();

    // Build an object from the inputs: { name: "...", country: "...", school: "...", bio: "..." }
    const updates = {};
    fields.forEach((field) => {
        updates[field] = document.getElementById(field + "Input").value;
    });

    try {
        await updateDoc(doc(db, "users", currentUser.uid), updates);

        // Lock the form again, refresh the header, show a confirmation
        fields.forEach(
            (field) =>
                (document.getElementById(field + "Input").disabled = true),
        );
        document.getElementById("saveBtn").disabled = true;
        showHeader(updates.name, currentUser.email);
        const alertBox = document.getElementById("profileAlert");
        alertBox.textContent = "Profile saved!";
        alertBox.classList.remove("d-none");
    } catch (error) {
        alert(
            `Error saving profile:\n${error.code || ""}\n${error.message || error}`,
        );
    }
}

// ---- (2) Connect it to the form ----
document.getElementById("profileForm").addEventListener("submit", saveProfile);

// Bootstrap badge colour for each difficulty (same mapping as main.js)
const DIFFICULTY_BADGE = {
    easy: "text-bg-success",
    medium: "text-bg-warning",
    hard: "text-bg-danger",
};

// ------------------------------------------------------------
// Display Favourite Puzzles
// Retrieves the current user's favourite puzzles from Firestore
// and displays them as cards using the puzzle card template.
// If there are no favourites, displays a message instead.
// ------------------------------------------------------------
async function displayFavourites() {
    const container = document.getElementById("puzzles-go-here");
    const cardTemplate = document.getElementById("puzzleCardTemplate");

    if (favourites.length === 0) {
        container.innerHTML =
            "<p class='text-muted'>You haven't favourited any puzzles yet. Go find some!</p>";
        return;
    }

    // Fetch exactly those puzzles in ONE query
    const q = query(
        collection(db, "puzzles"),
        where(documentId(), "in", favourites),
    );
    const querySnapshot = await getDocs(q);

    // Same card loop as main.js. The callback param is `docSnap` (not `doc`)
    // so it doesn't shadow the `doc()` function imported from firestore.
    querySnapshot.forEach((docSnap) => {
        const newcard = cardTemplate.content.cloneNode(true);
        const puzzle = docSnap.data();

        const level = (puzzle.difficulty || "easy").toLowerCase();

        newcard.querySelector(".card-title").textContent = puzzle.name;
        newcard.querySelector(".card-text").textContent = puzzle.details || "";

        const badge = newcard.querySelector(".card-difficulty");
        badge.textContent = puzzle.difficulty;
        badge.classList.add(DIFFICULTY_BADGE[level] || "text-bg-secondary");

        // sudoku.html / progress.js read ?difficulty= to tag the saved solve time
        newcard.querySelector(".play-btn").href =
            `sudoku.html?difficulty=${encodeURIComponent(level)}&docID=${docSnap.id}`;

        // setupHeart(newcard, docSnap.id); // re-enable once a heart button exists in the template

        container.appendChild(newcard);
    });
}

// ------------------------------------------------------------
// Set Up Favourite Heart
// Displays a filled heart if the hike is already a favourite.
// Adds a click event listener to add or remove the favourite.
// ------------------------------------------------------------

// function setupHeart(card, hikeID) {
//     const heart = card.querySelector(".fav-btn");
//     if (favourites.includes(hikeID)) {
//         heart.classList.replace("bi-heart", "bi-heart-fill");
//     }
//     heart.addEventListener("click", function () {
//         toggleFavourite(heart, hikeID);
//     });
// }

// ------------------------------------------------------------
// Toggle Favourite Hike
// Adds or removes a hike ID from the user's favourites in
// Firestore, then updates the heart icon to match.
// ------------------------------------------------------------

// async function toggleFavourite(heart, hikeID) {
//     const userRef = doc(db, "users", currentUser.uid);
//     if (heart.classList.contains("bi-heart-fill")) {
//         await setDoc(
//             userRef,
//             { favourites: arrayRemove(hikeID) },
//             { merge: true },
//         );
//         heart.classList.replace("bi-heart-fill", "bi-heart");
//     } else {
//         await setDoc(
//             userRef,
//             { favourites: arrayUnion(hikeID) },
//             { merge: true },
//         );
//         heart.classList.replace("bi-heart", "bi-heart-fill");
//     }
// }

// Saves the user's preferred notification reminder time to Firestore, along with their time zone.
async function saveReminderTime(timeString) {
    // waitForUser() only exists inside push-notification.js (and isn't exported),
    // but onAuthReady above already stores the signed-in user in `currentUser`.
    const user = currentUser;
    if (!user) return;

    try {
        await setDoc(
            doc(db, "users", user.uid),
            {
                reminderTime: timeString,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            { merge: true },
        );
    } catch (error) {
        console.error("Could not save reminder time:", error);
    }
}
