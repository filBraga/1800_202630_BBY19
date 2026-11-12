// <site-navbar></site-navbar> — the logged-in menu, shared by every logged-in page.
import { logoutUser } from "/src/authentication.js";
import { onAuthReady } from "/src/authentication.js";

const LINKS = [
  ["main.html", "Home"],
  ["timeSpent.html", "Time Spent"],
  ["motivation.html", "Motivation"],
  ["streak.html", "Daily Streak"],
  ["social.html", "Friends"],
  ["#break-ideas", "Break ideas"],
  ["#progress", "My progress"],
];

function loginCheck() {
 onAuthReady(async (user) => {
   if (!user) {
            location.href = "login.html";
            return;}
 })}
loginCheck();
class SiteNavbar extends HTMLElement {
  connectedCallback() {
    
    const page = location.pathname.split("/").pop();
    const items = LINKS.map(([href, label]) => {
      const current = href === page ? ' active" aria-current="page' : "";
      return `<li class="nav-item"><a class="nav-link${current}" href="${href}">${label}</a></li>`;
    }).join("");

    this.innerHTML = `
      <nav class="navbar navbar-expand-lg bg-body-tertiary">
        <div class="container">
          <a class="navbar-brand fw-semibold" href="main.html">Doomscroll</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent"
            aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarSupportedContent">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">${items}</ul>
            <a class="btn btn-primary" href="#take-a-break">Take a break</a>
            <button type="button" class="btn btn-outline-secondary ms-2 logout-btn">Logout</button>
          </div>
        </div>
      </nav>`;
    this.querySelector(".logout-btn").addEventListener("click", logoutUser);
  }
}

customElements.define("site-navbar", SiteNavbar);
