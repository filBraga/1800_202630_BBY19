// Run: node src/streakUtils.test.js
import assert from "node:assert/strict";
import { nextStreak, currentStreak } from "./streakUtils.js";

const T = "2026-11-11", Y = "2026-11-10", OLD = "2026-11-01";
assert.equal(nextStreak({}, T, Y), 1); // empty doc
assert.equal(nextStreak({ streak: 4, lastPlayedDate: Y }, T, Y), 5); // yesterday -> +1
assert.equal(nextStreak({ streak: 4, lastPlayedDate: T }, T, Y), 4); // today -> unchanged
assert.equal(nextStreak({ streak: 4, lastPlayedDate: OLD }, T, Y), 1); // older -> reset
const day1 = nextStreak({}, Y, "2026-11-09"); // first ever play, yesterday
assert.equal(nextStreak({ streak: day1, lastPlayedDate: Y }, T, Y), 2); // then today -> 2
assert.equal(currentStreak({ streak: 4, lastPlayedDate: OLD }, T, Y), 0);
assert.equal(currentStreak({ streak: 4, lastPlayedDate: Y }, T, Y), 4);
console.log("streak tests ok");
