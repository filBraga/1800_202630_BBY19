// src/timeSpent.js
// Fills timeSpent.html with today's puzzle time (sum of today's sessions)
// and the all-time total (users/{uid}.totalPuzzleSeconds).
import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";

const todayEl = document.getElementById("time-spent");
const totalEl = document.getElementById("total-time");

// 3725 -> "1h 02m"
const format = (seconds) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;

onAuthReady(async (user) => {
  if (!user) return; // logged-out redirect is handled elsewhere (Ryan's navbar card)
  try {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0); // start of today, local time
    const todaySessions = await getDocs(
      query(
        collection(db, "users", user.uid, "sessions"),
        where("solvedAt", ">=", Timestamp.fromDate(midnight)),
      ),
    );
    let todaySeconds = 0;
    todaySessions.forEach((d) => (todaySeconds += d.data().seconds || 0));
    todayEl.textContent = format(todaySeconds);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    totalEl.textContent = format(userDoc.data()?.totalPuzzleSeconds || 0);
  } catch (error) {
    console.error("Error loading time spent:", error);
    todayEl.textContent = "--";
    totalEl.textContent = "--";
  }
});
