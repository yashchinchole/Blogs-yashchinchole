import { firebaseConfig } from "./config.js";

let database;
let blogsRef;
let isFirebaseConnected = false;
let blogs = {};

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
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(dateString));
}

function getBlogIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showError(message) {
  document.getElementById("blogTitle").textContent = "Error";
  document.getElementById("blogMeta").textContent = "";
  document.getElementById("upvoteCount").textContent = "";
  document.getElementById(
    "blogContent"
  ).innerHTML = `<p class="text-danger">${escapeHtml(message)}</p>`;
}

function displayBlog(blog) {
  document.getElementById("blogTitle").textContent = blog.title;

  let authorLink = blog.author.linkedin
    ? `<a href="${escapeHtml(
        blog.author.linkedin
      )}" target="_blank">${escapeHtml(blog.author.name)}</a>`
    : escapeHtml(blog.author.name);

  document.getElementById(
    "blogMeta"
  ).innerHTML = `By ${authorLink} • ${formatDate(blog.createdAt)}`;

  document.getElementById("upvoteCount").textContent = `${
    blog.upvotes || 0
  } Upvotes`;

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
