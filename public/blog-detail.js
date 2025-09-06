import { firebaseConfig } from "./config.js";

let database;
let blogsRef;
let isFirebaseConnected = false;
let blogs = {};

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getBlogIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showError(message) {
  document.getElementById("blogTitle").textContent = "Error";
  document.getElementById("blogMeta").textContent = "";
  document.getElementById(
    "blogContent"
  ).innerHTML = `<p class="text-danger">${escapeHtml(message)}</p>`;
}

function displayBlog(blog) {
  document.getElementById("blogTitle").textContent = blog.title;
  document.getElementById("blogMeta").textContent = `By ${escapeHtml(
    blog.author.name
  )} • ${formatDate(blog.createdAt)}`;
  const contentDiv = document.getElementById("blogContent");
  if (blog.type === "markdown") {
    contentDiv.innerHTML = marked.parse(blog.content);
  } else {
    contentDiv.innerText = blog.content;
  }
}

function initializeFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      blogsRef = database.ref("blogs");
      isFirebaseConnected = true;
    } else {
      isFirebaseConnected = false;
      const storedBlogs = localStorage.getItem("minimalBlogs");
      if (storedBlogs) {
        blogs = JSON.parse(storedBlogs);
      }
    }
  } catch (error) {
    isFirebaseConnected = false;
    const storedBlogs = localStorage.getItem("minimalBlogs");
    if (storedBlogs) {
      blogs = JSON.parse(storedBlogs);
    }
  }
}

function loadBlog() {
  const blogId = getBlogIdFromURL();
  if (!blogId) {
    showError("No blog ID provided in URL.");
    return;
  }

  if (isFirebaseConnected) {
    blogsRef
      .once("value")
      .then((snapshot) => {
        const data = snapshot.val() || {};
        const blog = data[blogId];
        if (blog) {
          displayBlog(blog);
        } else {
          showError("Blog not found.");
        }
      })
      .catch(() => showError("Failed to load blog from Firebase."));
  } else {
    const blog = blogs[blogId];
    if (blog) {
      displayBlog(blog);
    } else {
      showError("Blog not found in local storage.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeFirebase();
  loadBlog();
});
