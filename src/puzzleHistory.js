// mainv2.js
// "View your old puzzles!" section: lists the signed-in user's completed and
// started puzzles from Firestore (users/{uid}/sessions).
//
// A session is "completed" when it has a `solvedAt` timestamp (this is what
// src/progress.js writes when a puzzle is finished). Anything without one
// is treated as "started". An explicit `status` field wins if it's present.
import { onAuthReady } from "/src/authentication.js";
import { db } from "/src/firebaseConfig.js";
import { collection, getDocs } from "firebase/firestore";

const DIFFICULTY_BADGE = {
    easy: "text-bg-success",
    medium: "text-bg-warning",
    hard: "text-bg-danger",
};

function getStatus(session) {
    if (session.status) return session.status;
    return session.solvedAt ? "completed" : "started";
}

// Firestore Timestamp -> JS Date (or null if the field is missing/pending).
function toDate(timestamp) {
    return timestamp?.toDate ? timestamp.toDate() : null;
}

function formatSeconds(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

// Used by Array.sort. Return a negative number if `a` should be listed
// before `b`, positive if after, 0 if they're equal.
// Sessions are plain Firestore docs: { puzzle, difficulty, seconds, solvedAt?, startedAt? }
function compareSessions(a, b) {
    // Newest completion first. Sessions with no completion date (started,
    // or solvedAt not resolved yet) sort to the bottom, newest start first.
    const solvedA = toDate(a.solvedAt)?.getTime();
    const solvedB = toDate(b.solvedAt)?.getTime();

    if (solvedA !== undefined && solvedB !== undefined) return solvedB - solvedA;
    if (solvedA !== undefined) return -1;
    if (solvedB !== undefined) return 1;

    const startedA = toDate(a.startedAt)?.getTime() ?? 0;
    const startedB = toDate(b.startedAt)?.getTime() ?? 0;
    return startedB - startedA;
}

function buildRow(session) {
    const status = getStatus(session);
    const level = (session.difficulty || "").toLowerCase();

    const row = document.createElement("div");
    row.className =
        "list-group-item d-flex justify-content-between align-items-center";

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "fw-semibold";
    const puzzleName = session.puzzle || "puzzle";
    title.textContent = puzzleName.charAt(0).toUpperCase() + puzzleName.slice(1);

    if (level) {
        const badge = document.createElement("span");
        badge.className = `badge ms-2 ${DIFFICULTY_BADGE[level] || "text-bg-secondary"}`;
        badge.textContent = level.charAt(0).toUpperCase() + level.slice(1);
        title.appendChild(badge);
    }

    const detail = document.createElement("small");
    detail.className = "text-body-secondary";
    const when = toDate(session.solvedAt) || toDate(session.startedAt);
    const parts = [];
    if (when) parts.push(when.toLocaleDateString());
    if (status === "completed" && typeof session.seconds === "number") {
        parts.push(`Solved in ${formatSeconds(session.seconds)}`);
    }
    detail.textContent = parts.join(" · ");

    info.append(title, detail);

    const statusBadge = document.createElement("span");
    statusBadge.className = `badge rounded-pill ${
        status === "completed" ? "text-bg-success" : "text-bg-secondary"
    }`;
    statusBadge.textContent = status === "completed" ? "Completed" : "Started";

    // Same query-string convention as the daily card in src/main.js.
    // `session` is the Firestore doc ID of this entry under users/{uid}/sessions.
    const openBtn = document.createElement("a");
    openBtn.className = "btn btn-sm btn-primary";
    openBtn.textContent = status === "completed" ? "Open" : "Continue";
    openBtn.href =
        `sudoku.html?difficulty=${encodeURIComponent(level || "easy")}` +
        `&session=${encodeURIComponent(session.id)}`;

    const actions = document.createElement("div");
    actions.className = "d-flex align-items-center gap-2";
    actions.append(statusBadge, openBtn);

    row.append(info, actions);
    return row;
}

// Fetch this user's sessions and render them into #old-puzzles-go-here.
async function displayOldPuzzles(uid) {
    const container = document.getElementById("old-puzzles-go-here");
    if (!container) return;

    try {
        const snap = await getDocs(collection(db, "users", uid, "sessions"));
        container.replaceChildren();

        if (snap.empty) {
            container.textContent =
                "No puzzles yet. Play today's puzzle to get started!";
            return;
        }

        const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        sessions.sort(compareSessions);
        sessions.forEach((session) => container.appendChild(buildRow(session)));
    } catch (error) {
        console.error("Error loading old puzzles: ", error);
        container.textContent = "Couldn't load your puzzles. Please try again.";
    }
}

onAuthReady((user) => {
    if (!user) return; // main.js already redirects logged-out users
    displayOldPuzzles(user.uid);
});
