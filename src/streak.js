// src/streak.js
// Fills streak.html from users/{uid}: streak, bestStreak, lastPlayedDate.
import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { doc, getDoc } from "firebase/firestore";
import { currentStreak } from "./streakUtils.js";

const countEl = document.getElementById("streak-count");
const bestEl = document.getElementById("best-streak");

onAuthReady(async (user) => {
  if (!user) return; // logged-out redirect is handled elsewhere
  try {
    const data = (await getDoc(doc(db, "users", user.uid))).data() || {};
    countEl.textContent = currentStreak(data);
    bestEl.textContent = `Best streak: ${data.bestStreak || 0}`;
  } catch (error) {
    console.error("Error loading streak:", error);
    countEl.textContent = "--";
  }
});
