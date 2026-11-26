// src/theme.js
// Dark mode, applied globally. Loaded by <site-navbar> (src/components/siteNavbar.js),
// so every logged-in page gets it without touching each HTML file.
//
// Firestore: users/{uid} holds  darkMode (boolean)  and  darkPalette ("midnight" | "ember").
// localStorage keeps a copy so the page can be coloured instantly on load, before
// Firestore answers. Firestore stays the source of truth and overwrites the copy.
import "./styles/dark-theme.css";
import { auth, db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const PALETTES = ["midnight", "ember"];
const CACHE_KEY = "theme";

// Set once the user flips a control, so a slow Firestore read can't undo their choice.
let userHasChosen = false;

// What to do for someone who has never picked a mode (no darkMode saved yet).
function defaultDarkMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Turn a users/{uid} document into a full theme, filling gaps with defaults.
export function resolveTheme(data = {}) {
    return {
        darkMode:
            typeof data.darkMode === "boolean"
                ? data.darkMode
                : defaultDarkMode(),
        palette: PALETTES.includes(data.darkPalette)
            ? data.darkPalette
            : PALETTES[0],
    };
}

// Paint the page. Bootstrap handles data-bs-theme; dark-theme.css handles the palette.
export function applyTheme({ darkMode, palette }) {
    const root = document.documentElement;
    root.setAttribute("data-bs-theme", darkMode ? "dark" : "light");
    root.setAttribute("data-dark-palette", palette);
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ darkMode, palette }));
    } catch {
        // private mode / storage full: the cache is only an optimisation
    }
}

// Apply a user's choice immediately, then save it to Firestore.
// Rejects if the save fails (the page keeps the new look either way).
export async function setTheme(theme) {
    userHasChosen = true;
    applyTheme(theme);
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    await setDoc(
        doc(db, "users", user.uid),
        { darkMode: theme.darkMode, darkPalette: theme.palette },
        { merge: true },
    );
}

// 1) Instant: use the cached copy, if any.
try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached) {
        applyTheme(
            resolveTheme({
                darkMode: cached.darkMode,
                darkPalette: cached.palette,
            }),
        );
    }
} catch {
    // corrupt cache: ignore, Firestore will fill it in
}

// 2) Authoritative: load the saved setting once we know who is signed in.
onAuthReady(async (user) => {
    if (!user) return;
    try {
        const data = (await getDoc(doc(db, "users", user.uid))).data() || {};
        if (!userHasChosen) applyTheme(resolveTheme(data));
    } catch (error) {
        console.error("Error loading theme:", error);
    }
});
