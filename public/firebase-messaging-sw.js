// Must live in /public so it is served at https://yoursite/firebase-messaging-sw.js
// (FCM looks for exactly that path, and a service worker can only control pages
// at or below its own URL).
//
// Service workers cannot read Vite's import.meta.env, so these values are pasted in.
// They are public identifiers (same ones that ship in your page JS), not secrets.
importScripts("https://www.gstatic.com/firebasejs/9.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.14.0/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Runs when a push arrives while the site is NOT in the foreground.
// If the push has a "notification" payload, FCM displays it automatically,
// so this handler only matters for data-only messages.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || payload.data || {};
  self.registration.showNotification(title || "Time to play!", {
    body: body || "Your daily puzzle is waiting.",
    icon: "/favicon.ico",
  });
});
