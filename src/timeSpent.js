// src/timeSpent.js
// Fills timeSpent.html with today's puzzle time, a 7-day bar chart (both from
// the last 7 days of sessions) and the all-time total (users/{uid}.totalPuzzleSeconds).
import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from "firebase/firestore";
import { dateKey } from "./streakUtils.js";

const todayEl = document.getElementById("time-spent");
const totalEl = document.getElementById("total-time");
const chartEl = document.getElementById("weekly-chart");

// 3725 -> "1h 02m"
const format = (seconds) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;

onAuthReady(async (user) => {
  if (!user) return; // logged-out redirect is handled elsewhere (Ryan's navbar card)
  try {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0); // midnight 6 days ago, local time -> 7 days incl. today
    const sessions = await getDocs(
      query(
        collection(db, "users", user.uid, "sessions"),
        where("solvedAt", ">=", Timestamp.fromDate(start)),
      ),
    );
    // "YYYY-MM-DD" -> seconds, oldest day first
    const days = new Map([6, 5, 4, 3, 2, 1, 0].map((n) => [dateKey(n), 0]));
    sessions.forEach((d) => {
      const { solvedAt, seconds } = d.data();
      const key = solvedAt?.toDate().toLocaleDateString("en-CA");
      if (days.has(key)) days.set(key, days.get(key) + (seconds || 0));
    });
    todayEl.textContent = format(days.get(dateKey()));
    renderChart(days);

    const userDoc = await getDoc(doc(db, "users", user.uid));
    totalEl.textContent = format(userDoc.data()?.totalPuzzleSeconds || 0);
  } catch (error) {
    console.error("Error loading time spent:", error);
    todayEl.textContent = "--";
    totalEl.textContent = "--";
    chartEl.textContent = "Couldn't load this week's time.";
  }
});

function renderChart(days) {
  const max = Math.max(...days.values(), 1);
  chartEl.innerHTML = [...days]
    .map(([key, seconds]) => {
      const label = new Date(`${key}T00:00`).toLocaleDateString("en-US", { weekday: "short" });
      const minutes = Math.round(seconds / 60);
      const pct = Math.round((seconds / max) * 100);
      return `<div class="d-flex align-items-center gap-2 mb-2">
        <span style="width: 3em">${label}</span>
        <div class="progress flex-grow-1" role="progressbar" aria-label="${label}: ${minutes} minutes"
          aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${pct}%"></div>
        </div>
        <span class="text-end" style="width: 4em">${minutes} min</span>
      </div>`;
    })
    .join("");
}
