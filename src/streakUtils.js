// src/streakUtils.js
// Pure streak helpers (no DOM/Firebase) so both progress.js and streak.js share one rule.

// Local-time "YYYY-MM-DD" (en-CA formats dates that way); daysAgo=1 -> yesterday.
export function dateKey(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-CA");
}

// Streak after playing today, given the stored user doc fields.
export function nextStreak({ streak = 0, lastPlayedDate } = {}, today = dateKey(), yesterday = dateKey(1)) {
  if (lastPlayedDate === today) return Math.max(streak, 1);
  if (lastPlayedDate === yesterday) return streak + 1;
  return 1;
}

// Streak to display: it's broken if the last play was before yesterday.
export function currentStreak({ streak = 0, lastPlayedDate } = {}, today = dateKey(), yesterday = dateKey(1)) {
  return lastPlayedDate === today || lastPlayedDate === yesterday ? streak : 0;
}
