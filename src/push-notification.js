// Push notification setup (Firebase Cloud Messaging, v9 modular SDK).
//
// Flow: user clicks button -> browser permission prompt -> register the service
// worker -> ask FCM for this device's token -> save the token so a server can
// send reminders to it later.
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app, db } from "/src/firebaseConfig.js";
import { onAuthReady } from "/src/authentication.js";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

const messaging = getMessaging(app);

function waitForUser() {
  return new Promise((resolve) => {

    const unsubscribe = onAuthReady((user) => {
      unsubscribe();
      resolve(user); // user is the logged-in user object, or null if logged out
    });
  });
}

async function saveTokenForUser(token) {
  const user = await waitForUser();

  if (!user) {
    console.log("Not logged in, so the token was not saved.");
    return;
  }
  const userRef = doc(db, "users", user.uid);
  //Write to firebase if notifications are enabled 
  try {
    await setDoc(
      userRef,
      {
        notificationsEnabled: true,
        fcmTokens: arrayUnion(token),
        // Browser's time zone name, e.g. "America/Vancouver". The reminder sender
        // uses it to work out when it is 6pm for this user.
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { merge: true }
    );
    console.log("Notification token saved for", user.uid);
  } catch (error) {
    console.error("Could not save notification token:", error);
  }
}

async function saveNotificationsDenied() {
  const user = await waitForUser();
  if (!user) return;

  try {
    await setDoc(
      doc(db, "users", user.uid),
      { notificationsEnabled: false },
      { merge: true }
    );
  } catch (error) {
    console.error("Could not save notification preference:", error);
  }
}

export async function requestPermissionAndGetToken() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.log("This browser does not support push notifications.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Notification permission was not granted:", permission);
    await saveNotificationsDenied();
    return null;
}

  try {
    // Register the worker from the site root (it lives in /public).
    // Build "?apiKey=...&authDomain=..." so the service worker can read its config.
    const params = new URLSearchParams({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });

    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`
    );
    
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.log("No registration token available.");
      return null;
    }

    console.log("FCM registration token:", token);
    await saveTokenForUser(token);
    return token;
  } catch (error) {
    console.error("An error occurred while retrieving token.", error);
    return null;
  }
}

async function syncNotificationStatus() {
  if (!("Notification" in window)) return;

  const user = await waitForUser();
  if (!user) return;

  const isGranted = Notification.permission === "granted";

  if (!isGranted && Notification.permission === "denied") {
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { notificationsEnabled: false },
        { merge: true }
      );
    } catch (error) {
      console.error("Could not sync notification status:", error);
    }
  }
}
syncNotificationStatus()

// While this tab is open and focused, FCM does NOT show a notification on its
// own. It hands the payload to the page, so we display it ourselves.
onMessage(messaging, (payload) => {
  //debug line
  console.log("Foreground message:", payload);
  //
  const { title, body } = payload.notification || {};
  new Notification(title || "Time to play!", { body, icon: "/favicon.ico" });
});

document
  .getElementById("enable-notifications")
  ?.addEventListener("click", requestPermissionAndGetToken);

export default requestPermissionAndGetToken;
