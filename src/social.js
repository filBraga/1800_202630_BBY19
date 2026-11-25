// src/social.js
// Friends page: send a friend request by email, accept/decline incoming
// requests, cancel sent ones, and see accepted friends' tracks.
//
// Firestore:
//   userLookup/{email}       -> { uid, name }   public email -> uid lookup
//   friendships/{uidA_uidB}  -> one doc per pair (uids sorted), shared by both:
//     { users: [uidA, uidB], requester, recipient,
//       requesterName, requesterEmail, recipientName, recipientEmail,
//       status: "pending" | "accepted", createdAt, acceptedAt }
// Only the recipient can accept. Either side can delete (decline, cancel, remove).
// firestore.rules lets you read someone's users/{uid} and sessions only once
// your friendship with them is "accepted", so nothing is shared before that.
import { db } from "./firebaseConfig.js";
import { onAuthReady } from "./authentication.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { currentStreak } from "./streakUtils.js";

const form = document.getElementById("addFriendForm");
const emailInput = document.getElementById("friendEmailInput");
const addBtn = document.getElementById("addFriendBtn");
const alertEl = document.getElementById("socialAlert");
const listEl = document.getElementById("friends-go-here");
const emptyEl = document.getElementById("friendsEmpty");
const incomingSection = document.getElementById("incomingSection");
const incomingEl = document.getElementById("incomingList");
const outgoingSection = document.getElementById("outgoingSection");
const outgoingEl = document.getElementById("outgoingList");
const template = document.getElementById("friendCardTemplate");

let me = null; // { uid, email, name }

// 3725 -> "1h 02m" (same format as timeSpent.js)
const format = (seconds) =>
  `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;

// Same id no matter who sends the request, so a pair can only have one doc.
const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

function showAlert(message, type = "success") {
  alertEl.className = `alert alert-${type} mt-3 mb-0`;
  alertEl.textContent = message;
}

onAuthReady(async (user) => {
  if (!user) return; // logged-out redirect is handled by the navbar
  const email = user.email.toLowerCase();
  let name = user.displayName || email;
  try {
    name = (await getDoc(doc(db, "users", user.uid))).data()?.name || name;
    // Make sure older accounts are findable by email too.
    await setDoc(doc(db, "userLookup", email), { uid: user.uid, name });
  } catch (error) {
    console.error("Error saving email lookup:", error);
  }
  me = { uid: user.uid, email, name };
  await render();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!me) return;
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !emailInput.checkValidity()) return showAlert("Please enter a valid email address.", "warning");
  if (email === me.email) return showAlert("That's your own email.", "warning");

  addBtn.disabled = true;
  try {
    const lookup = await getDoc(doc(db, "userLookup", email));
    if (!lookup.exists()) {
      return showAlert("No user found with that email. They need to sign up (or open their Friends page once).", "warning");
    }
    const { uid, name } = lookup.data();
    const ref = doc(db, "friendships", pairId(me.uid, uid));
    const existing = await getDoc(ref);

    if (existing.exists()) {
      const f = existing.data();
      if (f.status === "accepted") return showAlert(`${name || email} is already your friend.`, "info");
      if (f.requester === me.uid) return showAlert(`You already sent ${name || email} a request.`, "info");
      // They already asked me -> sending one back counts as accepting.
      await acceptRequest(ref.id);
      return showAlert(`${name || email} had already sent you a request, so you're now friends!`);
    }

    await setDoc(ref, {
      users: [me.uid, uid],
      requester: me.uid,
      requesterName: me.name,
      requesterEmail: me.email,
      recipient: uid,
      recipientName: name || email,
      recipientEmail: email,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    showAlert(`Friend request sent to ${name || email}. You'll see each other's progress once they accept.`);
    emailInput.value = "";
    await render();
  } catch (error) {
    console.error("Error sending friend request:", error);
    showAlert("Couldn't send the request (check your connection or Firestore rules).", "danger");
  } finally {
    addBtn.disabled = false;
  }
});

async function acceptRequest(id) {
  await updateDoc(doc(db, "friendships", id), {
    status: "accepted",
    recipientName: me.name, // keep my current name on the shared doc
    acceptedAt: serverTimestamp(),
  });
  await render();
}

// Decline, cancel and remove all just delete the shared doc.
async function deleteFriendship(id, confirmText, doneText) {
  if (confirmText && !confirm(confirmText)) return;
  try {
    await deleteDoc(doc(db, "friendships", id));
    if (doneText) showAlert(doneText, "info");
    await render();
  } catch (error) {
    console.error("Error deleting friendship:", error);
    showAlert("Something went wrong. Please try again.", "danger");
  }
}

async function render() {
  try {
    const snap = await getDocs(query(collection(db, "friendships"), where("users", "array-contains", me.uid)));
    const incoming = [];
    const outgoing = [];
    const accepted = [];
    snap.forEach((d) => {
      const f = { id: d.id, ...d.data() };
      if (f.status === "accepted") accepted.push(f);
      else if (f.recipient === me.uid) incoming.push(f);
      else outgoing.push(f);
    });

    renderRequests(incoming, outgoing);
    await renderFriends(accepted);
  } catch (error) {
    console.error("Error loading friends:", error);
    emptyEl.textContent = "Couldn't load your friends.";
    emptyEl.classList.remove("d-none");
  }
}

function requestRow(name, email, buttons) {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex align-items-center gap-2";
  const text = document.createElement("div");
  text.className = "me-auto text-truncate";
  text.innerHTML = `<div class="fw-semibold"></div><small class="text-muted"></small>`;
  text.children[0].textContent = name;
  text.children[1].textContent = email;
  li.appendChild(text);
  buttons.forEach(([label, cls, onClick]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-sm ${cls}`;
    btn.textContent = label;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await onClick();
      btn.disabled = false;
    });
    li.appendChild(btn);
  });
  return li;
}

function renderRequests(incoming, outgoing) {
  incomingEl.innerHTML = "";
  incomingSection.classList.toggle("d-none", incoming.length === 0);
  incoming.forEach((f) =>
    incomingEl.appendChild(
      requestRow(f.requesterName, f.requesterEmail, [
        [
          "Accept",
          "btn-success",
          async () => {
            try {
              await acceptRequest(f.id);
              showAlert(`You and ${f.requesterName} are now friends!`);
            } catch (error) {
              console.error("Error accepting request:", error);
              showAlert("Couldn't accept the request.", "danger");
            }
          },
        ],
        ["Decline", "btn-outline-secondary", () => deleteFriendship(f.id, null, `Declined ${f.requesterName}'s request.`)],
      ]),
    ),
  );

  outgoingEl.innerHTML = "";
  outgoingSection.classList.toggle("d-none", outgoing.length === 0);
  outgoing.forEach((f) =>
    outgoingEl.appendChild(
      requestRow(f.recipientName, f.recipientEmail, [
        ["Cancel", "btn-outline-secondary", () => deleteFriendship(f.id, null, `Cancelled request to ${f.recipientName}.`)],
      ]),
    ),
  );
}

async function renderFriends(accepted) {
  listEl.innerHTML = "";
  if (accepted.length === 0) {
    emptyEl.textContent = "No friends yet. Send a request by email above!";
    emptyEl.classList.remove("d-none");
    return;
  }
  emptyEl.classList.add("d-none");

  const friends = await Promise.all(accepted.map(loadFriend));
  friends
    .sort((a, b) => b.streak - a.streak) // longest streak first
    .forEach((f) => listEl.appendChild(friendCard(f)));
}

// Reads an accepted friend's user doc + their last 7 days of sessions.
async function loadFriend(f) {
  const iAmRequester = f.requester === me.uid;
  const uid = iAmRequester ? f.recipient : f.requester;
  const friend = {
    id: f.id,
    name: (iAmRequester ? f.recipientName : f.requesterName) || "Unknown",
    email: iAmRequester ? f.recipientEmail : f.requesterEmail,
    streak: 0,
    best: 0,
    total: 0,
    week: 0,
    last: "never",
  };
  try {
    const data = (await getDoc(doc(db, "users", uid))).data() || {};
    friend.name = data.name || friend.name;
    friend.streak = currentStreak(data);
    friend.best = data.bestStreak || 0;
    friend.total = data.totalPuzzleSeconds || 0;
    friend.last = data.lastPlayedDate || "never";

    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0); // 7 days including today, like timeSpent.js
    const sessions = await getDocs(
      query(collection(db, "users", uid, "sessions"), where("solvedAt", ">=", Timestamp.fromDate(start))),
    );
    sessions.forEach((d) => (friend.week += d.data().seconds || 0));
  } catch (error) {
    console.error(`Error loading friend ${uid}:`, error);
  }
  return friend;
}

function friendCard(f) {
  const card = template.content.cloneNode(true);
  card.querySelector(".friend-avatar").textContent = f.name.charAt(0).toUpperCase();
  card.querySelector(".friend-name").textContent = f.name;
  card.querySelector(".friend-email").textContent = f.email;
  card.querySelector(".friend-streak").textContent = f.streak;
  card.querySelector(".friend-best").textContent = f.best;
  card.querySelector(".friend-week").textContent = format(f.week);
  card.querySelector(".friend-total").textContent = format(f.total);
  card.querySelector(".friend-last").textContent = f.last;
  card
    .querySelector(".remove-btn")
    .addEventListener("click", () =>
      deleteFriendship(f.id, `Remove ${f.name}? You'll both stop seeing each other's progress.`, `Removed ${f.name}.`),
    );
  return card;
}
