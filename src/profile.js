//User Profile JavaScript file















// Saves the user's preferred notification reminder time to Firestore, along with their time zone.
async function saveReminderTime(timeString) {
  const user = await waitForUser();
  if (!user) return;

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        reminderTime: timeString,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Could not save reminder time:", error);
  }
}