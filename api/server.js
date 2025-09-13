import express from "express";
import dotenv from "dotenv";
import firebase from "firebase/compat/app";
import "firebase/compat/database";

dotenv.config();

const app = express();

// ---- Firebase Config ----
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ---- Serve static files ----
app.use(express.static("public"));

// ---- API: Get all blogs ----
app.get("/api/blogs", async (req, res) => {
  try {
    const snapshot = await database.ref("blogs").once("value");
    const blogs = snapshot.val() || {};
    res.json(Object.values(blogs));
  } catch (error) {
    console.error("Error fetching blogs:", error);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// ---- API: Get blogs by author ----
app.get("/api/blogs/author/:name", async (req, res) => {
  try {
    const snapshot = await database.ref("blogs").once("value");
    const blogs = snapshot.val() || {};
    const filtered = Object.values(blogs).filter(
      (blog) =>
        blog.author?.name?.toLowerCase() === req.params.name.toLowerCase()
    );
    res.json(filtered);
  } catch (error) {
    console.error("Error fetching blogs by author:", error);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

// ---- API: Get blog by ID ----
app.get("/api/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    const snapshot = await database.ref(`blogs/${blogId}`).once("value");
    const blog = snapshot.val();
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }
    res.json(blog);
  } catch (error) {
    console.error("Error fetching blog by ID:", error);
    res.status(500).json({ error: "Failed to fetch blog" });
  }
});

// ---- Expose env.js ----
app.get("/env.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
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
