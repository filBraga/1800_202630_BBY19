// vite.config.js
// Tells Vite's bundler (Rollup) that each of these HTML files is a page of its own.
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: resolve(__dirname, "index.html"),
                login: resolve(__dirname, "login.html"),
                main: resolve(__dirname, "main.html"),
                gameRules: resolve(__dirname, "gameRules.html"),
                eachPuzzle: resolve(__dirname, "eachPuzzle.html"),
                puzzleHistory: resolve(__dirname, "puzzleHistory.html"),
                social: resolve(__dirname, "social.html"),
                streak: resolve(__dirname, "streak.html"),
                sudoku: resolve(__dirname, "sudoku.html"),
                timeSpent: resolve(__dirname, "timeSpent.html"),
                profile: resolve(__dirname, "profile.html"),
                landingPage: resolve(__dirname, "landing-page.html")
            },
        },
    },
});
