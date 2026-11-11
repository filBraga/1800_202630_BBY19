// src/streak.js
// Fills streak.html from users/{uid}: streak, bestStreak, lastPlayedDate,
// and turns this week's M..S circles green on days with a session.
import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";
import { currentStreak } from "./streakUtils.js";

const countEl = document.getElementById("streak-count");
const bestEl = document.getElementById("best-streak");
const dayEls = document.querySelectorAll(".streak-day"); // Mon..Sun

onAuthReady(async (user) => {
  if (!user) return; // logged-out redirect is handled elsewhere
  try {
    const data = (await getDoc(doc(db, "users", user.uid))).data() || {};
    countEl.textContent = currentStreak(data);
    bestEl.textContent = `Best streak: ${data.bestStreak || 0}`;

    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // getDay: Sun=0 -> Mon=0
    monday.setHours(0, 0, 0, 0);
    const sessions = await getDocs(
      query(
        collection(db, "users", user.uid, "sessions"),
        where("solvedAt", ">=", Timestamp.fromDate(monday)),
      ),
    );
    sessions.forEach((d) => {
      const day = d.data().solvedAt?.toDate();
      const el = day && dayEls[(day.getDay() + 6) % 7];
      if (!el || el.classList.contains("bg-success")) return;
      el.classList.add("bg-success", "text-white");
      el.insertAdjacentHTML("beforeend", '<span class="visually-hidden"> (played)</span>');
    });
  } catch (error) {
    console.error("Error loading streak:", error);
    countEl.textContent = "--";
  }
});
