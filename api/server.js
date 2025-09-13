// api/server.js
import express from "express";
import dotenv from "dotenv";
import serverless from "serverless-http";
import firebase from "firebase/compat/app";
import "firebase/compat/database";

dotenv.config();

const app = express();

// Basic CORS middleware (allows any origin)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // change to specific origin if needed
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// ---------- Initialize Firebase (client SDK) ----------
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || null,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
  databaseURL: process.env.FIREBASE_DATABASE_URL || null,
  projectId: process.env.FIREBASE_PROJECT_ID || null,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
  appId: process.env.FIREBASE_APP_ID || null,
};

let database = null;
try {
  if (
    !firebase.apps.length &&
    firebaseConfig.databaseURL // require the DB URL at minimum
  ) {
    firebase.initializeApp(firebaseConfig);
  }
  database = firebase.database();
  console.log("Firebase initialized (client SDK).");
} catch (err) {
  console.error("Firebase initialization error:", err);
}

// Helper: read all blogs from DB and normalize to array of objects with id
async function fetchAllBlogs() {
  if (!database) throw new Error("Firebase Database not initialized.");
  const snapshot = await database.ref("blogs").once("value");
  const data = snapshot.val() || {};
  // Normalize: attach id if missing
  return Object.entries(data).map(([key, obj]) => {
    if (obj && typeof obj === "object") {
      return { id: obj.id || key, ...obj };
    } else {
      return { id: key, value: obj };
    }
  });
}

// ---------- Static files (public) ----------
app.use(express.static("public"));

// ---------- API: all blogs ----------
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await fetchAllBlogs();
    // Cache at Vercel edge for 60s, stale-while-revalidate for 120s
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.json(blogs);
  } catch (err) {
    console.error("Error /api/blogs:", err);
    return res.status(500).json({ error: "Failed to fetch blogs." });
  }
});

// ---------- API: blog by ID ----------
app.get("/api/blogs/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!database) throw new Error("Firebase Database not initialized.");

    const snapshot = await database.ref(`blogs/${id}`).once("value");
    const blog = snapshot.val();
    if (!blog) {
      return res.status(404).json({ error: "Blog not found." });
    }

    const normalized = { id: blog.id || id, ...blog };
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.json(normalized);
  } catch (err) {
    console.error("Error /api/blogs/:id", err);
    return res.status(500).json({ error: "Failed to fetch blog." });
  }
});

// ---------- API: blogs by author (case-insensitive, includes) ----------
app.get("/api/blogs/author/:name", async (req, res) => {
  try {
    const rawName = req.params.name || "";
    const authorName = String(rawName).toLowerCase().trim();

    const all = await fetchAllBlogs();
    const filtered = all.filter((b) => {
      const aName = (b?.author?.name || "").toString().toLowerCase().trim();
      // exact or partial match both allowed
      return aName === authorName || aName.includes(authorName);
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.json(filtered);
  } catch (err) {
    console.error("Error /api/blogs/author/:name", err);
    return res.status(500).json({ error: "Failed to fetch blogs by author." });
  }
});

// ---------- env.js (keeps previous behavior) ----------
app.get("/env.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  // NOTE: this exposes the env vars into public JS — keep only what you intend to expose.
  res.send(`
    window.env = {
      FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY || ""}",
      FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN || ""}",
      FIREBASE_DATABASE_URL: "${process.env.FIREBASE_DATABASE_URL || ""}",
      FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID || ""}",
      FIREBASE_STORAGE_BUCKET: "${process.env.FIREBASE_STORAGE_BUCKET || ""}",
      FIREBASE_MESSAGING_SENDER_ID: "${
        process.env.FIREBASE_MESSAGING_SENDER_ID || ""
      }",
      FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID || ""}",
      GEMINI_API_KEY: "${process.env.GEMINI_API_KEY || ""}",
      SECRET_CODE: "${process.env.SECRET_CODE || ""}"
    };
  `);
});

// ---------- Fallback 404 for other API routes ----------
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

// Export wrapped handler for Vercel serverless
export default serverless(app);
