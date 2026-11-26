import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/index.css";
import { onAuthReady } from "/src/authentication.js";

// If the user is already logged in, skip this page and go to main.html.
// If the user is NOT logged in, do nothing, so index.html is shown.
onAuthReady((user) => {
    if (user) {
        location.href = "main.html";
    }
});
