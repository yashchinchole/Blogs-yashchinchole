import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// serve static frontend
app.use(express.static("public"));

// expose env.js dynamically
app.get("/env.js", (req, res) => {
  res.type("application/javascript");
  res.send(`
    window.env = {
      FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY}",
      FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN}",
      FIREBASE_DATABASE_URL: "${process.env.FIREBASE_DATABASE_URL}",
      FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID}",
      FIREBASE_STORAGE_BUCKET: "${process.env.FIREBASE_STORAGE_BUCKET}",
      FIREBASE_MESSAGING_SENDER_ID: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
      FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID}",
      GEMINI_API_KEY: "${process.env.GEMINI_API_KEY}",
      SECRET_CODE: "${process.env.SECRET_CODE}"
    };
  `);
});

export default app;
