// scripts/sendReminders.js
// ---------------------------------------------------------------------
// Runs on GitHub Actions every hour (see .github/workflows/daily-reminder.yml).
// It is NOT browser code: it runs in Node with the Firebase ADMIN SDK, which
// can read every user's document and send push messages.
//
// For each user with notifications on, it asks "is it 6pm where this user is
// right now, and have we already reminded them today?" If yes, it sends.
// ---------------------------------------------------------------------
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const REMINDER_HOUR = 18; // 6pm, in 24-hour time
// PLACEHOLDER: the address of your deployed site, opened when the user clicks the notification.
const SITE_URL = "";

// The service account key arrives as a secret environment variable (a JSON string).
// It is set in the GitHub repo settings and is NEVER committed to the project.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const messaging = getMessaging();

// "What time is it for this user?" Intl can format "now" in any time zone.
function localHour(timeZone, now) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now)
  );
}

// Gives the user's local calendar date as "2026-11-07". The "en-CA" locale
// happens to write dates in this year-month-day order.
function localDate(timeZone, now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

// Decides whether this user should get a reminder today.
// Returns true (send) or false (skip). Skips anyone who already solved a puzzle today.
async function shouldSendReminder(userRef, user, today) {
  const latest = await userRef
    .collection("sessions")
    .orderBy("solvedAt", "desc")
    .limit(1)
    .get();

  // No sessions at all means they have never played, so they should be reminded.
  if (latest.empty) return true;

  //Turns firestore timestamp in JS date object
  const solvedAt = latest.docs[0].data().solvedAt?.toDate();
  if (!solvedAt) return true;

  //Convert time into users time zone
  const lastPlayedDate = localDate(user.timeZone, solvedAt);

  // If the last solve was NOT today, remind them. If it was today, skip.
  return lastPlayedDate !== today;
}

async function main() {
  const now = new Date();
  const snapshot = await db
    .collection("users")
    .where("notificationsEnabled", "==", true)
    .get();

  for (const docSnap of snapshot.docs) {
    const user = docSnap.data();
    const tokens = user.fcmTokens || [];
    const timeZone = user.timeZone;

    // Skip anyone we can't send to or whose time zone we don't know.
    if (tokens.length === 0 || !timeZone) continue;

    // Not 6pm for this user yet (or anymore): skip.
    if (localHour(timeZone, now) !== REMINDER_HOUR) continue;

    // Already reminded today (this guards against the job running twice): skip.
    const today = localDate(timeZone, now);
    if (user.lastReminderDate === today) continue;

    // "await" is required now because shouldSendReminder is async.
    if (!(await shouldSendReminder(docSnap.ref, user, today))) continue;

    // Send to every device the user has registered.
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "Time to play!",
        body: "Your daily puzzle is waiting.",
      },
      webpush: { fcmOptions: { link: SITE_URL } },
    });

    // FCM reports success per token. Collect the dead ones (the user revoked
    // permission or cleared their browser data) so we can remove them.
    const deadTokens = [];
    response.responses.forEach((result, i) => {
      const code = result.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        deadTokens.push(tokens[i]);
      }
    });

    const update = { lastReminderDate: today };
    if (deadTokens.length > 0) {
      update.fcmTokens = FieldValue.arrayRemove(...deadTokens);
    }
    await docSnap.ref.update(update);

    console.log(`Reminded ${docSnap.id}: ${response.successCount} sent, ${deadTokens.length} removed`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1); // marks the GitHub Actions run as failed so you notice
});


//FINISH NOTIFICATIONS SETUP

//1. Install the Admin SDK: run npm install --save-dev firebase-admin in the project folder, and commit the updated package.json and package-lock.json. The workflow's npm ci needs them.
//2. Create a service account key: in Firebase Console, go to Project settings, then Service accounts, then "Generate new private key". Unlike your web config, this one is a real secret. Never commit it or paste it into a project file.
//3. Add it as a GitHub secret: in your repo, go to Settings, then Secrets and variables, then Actions, then New repository secret. Name it FIREBASE_SERVICE_ACCOUNT and paste the whole JSON file contents. Then delete the downloaded file.
//4. Set SITE_URL in scripts/sendReminders.js to your deployed address. It's currently a placeholder.
//5. Re-enable notifications once. Click your button again while signed in so your existing user doc gets its timeZone field. Users saved earlier don't have one yet, and the script skips them.
//6. Test it: temporarily change REMINDER_HOUR to your current local hour, push, and use Actions, then Daily reminder, then "Run workflow". Change it back to 18 afterwards.


//Limits to know about

//- Timing is approximate. GitHub's scheduler can run late. Because the job runs hourly, a user gets their reminder sometime during the 6pm hour, not at exactly 6:00.
//- GitHub pauses scheduled workflows after 60 days with no repo activity. Any push to the repo reactivates them.
//- The workflow file must be on the default branch (main) for the schedule to fire.
//- Private repos have a monthly free allowance of minutes. Hourly runs are short, so they should fit comfortably. Public repos have no such limit.
 