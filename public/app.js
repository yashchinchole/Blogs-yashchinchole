import { firebaseConfig, appConfig } from "./config.js";

const SECRET_CODE = appConfig.secretCode;

// Application State
let database;
let blogsRef;
let currentBlogId = null;
let blogs = {};
let upvotedBlogs = JSON.parse(localStorage.getItem("upvotedBlogs") || "[]");
let isFirebaseConnected = false;

// DOM Elements
const loadingSpinner = document.getElementById("loadingSpinner");
const blogContainer = document.getElementById("blogContainer");
const emptyState = document.getElementById("emptyState");
let blogModal, adminModal;

// Initialize Application
document.addEventListener("DOMContentLoaded", function () {
  console.log("Application initialized");
  initializeModals();
  initializeFirebase();
  setupEventListeners();
  loadBlogs();
});

// Initialize Bootstrap modals
function initializeModals() {
  blogModal = new bootstrap.Modal(document.getElementById("blogModal"));
  adminModal = new bootstrap.Modal(document.getElementById("adminModal"));
}

// Initialize Firebase with error handling
function initializeFirebase() {
  try {
    if (typeof firebase !== "undefined") {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      blogsRef = database.ref("blogs");
      isFirebaseConnected = true;
      console.log("Firebase initialized successfully");
    } else {
      console.warn("Firebase not available, using local storage fallback");
      initializeLocalStorage();
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    console.log("Using local storage fallback");
    initializeLocalStorage();
  }
}

// Initialize local storage as fallback
function initializeLocalStorage() {
  isFirebaseConnected = false;
  const storedBlogs = localStorage.getItem("minimalBlogs");
  if (storedBlogs) {
    blogs = JSON.parse(storedBlogs);
  } else {
    addSampleBlogToLocal();
  }
}

// Setup Event Listeners
function setupEventListeners() {
  document
    .getElementById("blogForm")
    .addEventListener("submit", handleManualBlogSubmit);

  document
    .getElementById("secretCodeInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        authenticateAdmin();
      }
    });
}

// Load blogs
async function loadBlogs() {
  try {
    showLoading(true);
    if (isFirebaseConnected) {
      blogsRef.on(
        "value",
        (snapshot) => {
          const data = snapshot.val();
          blogs = data || {};
          if (Object.keys(blogs).length === 0) {
            addSampleBlogToFirebase();
          } else {
            renderBlogs();
            showLoading(false);
          }
        },
        (error) => {
          console.error(
            "Firebase error, falling back to local storage:",
            error
          );
          isFirebaseConnected = false;
          initializeLocalStorage();
          renderBlogs();
          showLoading(false);
        }
      );
    } else {
      setTimeout(() => {
        renderBlogs();
        showLoading(false);
      }, 1000);
    }
  } catch (error) {
    console.error("Error loading blogs:", error);
    initializeLocalStorage();
    renderBlogs();
    showLoading(false);
  }
}

// Render blogs in the UI
function renderBlogs() {
  const blogArray = Object.values(blogs).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  if (blogArray.length === 0) {
    blogContainer.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  blogContainer.style.display = "block";
  blogContainer.innerHTML = blogArray
    .map((blog) => createBlogCard(blog))
    .join("");

  addEventListeners();
}

// Create blog card HTML
function createBlogCard(blog) {
  const isUpvoted = upvotedBlogs.includes(blog.id);
  const upvoteClass = isUpvoted ? "upvoted" : "";
  const formattedDate = formatDate(blog.createdAt);
  const preview = blog.preview || blog.content.substring(0, 300) + "...";

  return `
    <div class="blog-card" data-blog-id="${blog.id}">
      <h3 class="blog-card-title">${escapeHtml(blog.title)}</h3>
      <p class="blog-card-preview">${escapeHtml(preview)}</p>
      <div class="blog-card-meta">
        <div class="author-info">
          <span class="author-name">${escapeHtml(blog.author)}</span>
          ${
            blog.authorLinkedin
              ? `<a href="${escapeHtml(
                  blog.authorLinkedin
                )}" target="_blank" class="author-linkedin">LinkedIn</a>`
              : ""
          }
        </div>
        <div class="d-flex gap-2 align-items-center">
          <span class="blog-date">${formattedDate}</span>
          <button class="upvote-btn ${upvoteClass}" onclick="handleUpvote('${
    blog.id
  }')" data-blog-id="${blog.id}">
            👍 ${blog.upvotes || 0}
          </button>
          <button class="read-more-btn" onclick="openBlog('${blog.id}')">
            Read More
          </button>
        </div>
      </div>
    </div>
  `;
}

// Add event listeners to dynamically created elements
function addEventListeners() {
  document.querySelectorAll(".blog-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      if (
        e.target.closest(".upvote-btn") ||
        e.target.closest(".read-more-btn") ||
        e.target.closest(".author-linkedin")
      ) {
        return;
      }
      const blogId = card.getAttribute("data-blog-id");
      openBlog(blogId);
    });
  });
}

// Show/hide loading spinner
function showLoading(show) {
  if (show) {
    loadingSpinner.style.display = "flex";
    blogContainer.style.display = "none";
  } else {
    loadingSpinner.style.display = "none";
    blogContainer.style.display = "block";
  }
}

// Open blog in modal
function openBlog(blogId) {
  const blog = blogs[blogId];
  if (!blog) return;

  currentBlogId = blogId;
  document.getElementById("modalBlogTitle").textContent = blog.title;
  document.getElementById("modalBlogMeta").innerHTML = `
    <strong>By:</strong> ${escapeHtml(blog.author)} | 
    <strong>Date:</strong> ${formatDate(blog.createdAt)} | 
    <strong>Upvotes:</strong> ${blog.upvotes || 0}
  `;
  document.getElementById("modalBlogContent").textContent = blog.content;

  blogModal.show();
}

// Handle upvote
function handleUpvote(blogId) {
  if (upvotedBlogs.includes(blogId)) {
    showAlert("You have already upvoted this blog!", "warning");
    return;
  }

  const blog = blogs[blogId];
  if (!blog) return;

  blog.upvotes = (blog.upvotes || 0) + 1;
  upvotedBlogs.push(blogId);

  localStorage.setItem("upvotedBlogs", JSON.stringify(upvotedBlogs));

  if (isFirebaseConnected) {
    blogsRef.child(blogId).update({ upvotes: blog.upvotes });
  } else {
    localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
  }

  renderBlogs();
  showAlert("Thank you for upvoting!", "success");
}

// Open admin modal
function openAdminModal() {
  adminModal.show();
}

// Authenticate admin
function authenticateAdmin() {
  const secretCode = document.getElementById("secretCodeInput").value;
  if (secretCode === SECRET_CODE) {
    adminModal.hide();
    document.getElementById("secretCodeInput").value = "";
    document.getElementById("authError").style.display = "none";

    // Reset and show the blog form modal
    document.getElementById("blogForm").reset();
    blogModal.show();
  } else {
    document.getElementById("authError").style.display = "block";
  }
}

// Handle manual blog submission
function handleManualBlogSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("blogTitle").value.trim();
  const content = document.getElementById("blogContent").value.trim();
  const author = document.getElementById("blogAuthor").value.trim();
  const authorLinkedin = document.getElementById("authorLinkedin").value.trim();

  if (!title || !content || !author) {
    showAlert("Please fill in all required fields", "danger");
    return;
  }

  const blog = {
    id: generateId(),
    title,
    content,
    author,
    authorLinkedin: authorLinkedin || null,
    createdAt: new Date().toISOString(),
    upvotes: 0,
    preview: content.substring(0, 300) + (content.length > 300 ? "..." : ""),
  };

  if (isFirebaseConnected) {
    blogsRef.child(blog.id).set(blog);
  } else {
    blogs[blog.id] = blog;
    localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
    renderBlogs();
  }

  blogModal.hide();
  document.getElementById("blogForm").reset();
  showAlert("Blog posted successfully!", "success");
}

// Utility Functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

function showAlert(message, type) {
  // Create alert element
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = `
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  document.body.appendChild(alertDiv);

  // Auto remove after 3 seconds
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.remove();
    }
  }, 3000);
}

// Add sample blog for demo
function addSampleBlogToFirebase() {
  const sampleBlog = {
    id: "sample-blog-1",
    title: "Welcome to Minimal Blog",
    content: `This is a sample blog post to demonstrate the functionality of this minimal blog application.

The application includes features like:
- Create and read blog posts
- Upvote system
- Author information with LinkedIn links
- Responsive design
- Firebase integration with local storage fallback

You can add new blog posts by clicking the "Add Blog" button and entering the secret code. The application is designed to be simple yet functional.`,
    author: "Blog Admin",
    authorLinkedin: "https://linkedin.com/in/example",
    createdAt: new Date().toISOString(),
    upvotes: 5,
    preview:
      "This is a sample blog post to demonstrate the functionality of this minimal blog application...",
  };

  blogsRef.child(sampleBlog.id).set(sampleBlog);
}

function addSampleBlogToLocal() {
  const sampleBlog = {
    id: "sample-blog-1",
    title: "Welcome to Minimal Blog",
    content: `This is a sample blog post to demonstrate the functionality of this minimal blog application.

The application includes features like:
- Create and read blog posts
- Upvote system
- Author information with LinkedIn links
- Responsive design
- Firebase integration with local storage fallback

You can add new blog posts by clicking the "Add Blog" button and entering the secret code. The application is designed to be simple yet functional.`,
    author: "Blog Admin",
    authorLinkedin: "https://linkedin.com/in/example",
    createdAt: new Date().toISOString(),
    upvotes: 5,
    preview:
      "This is a sample blog post to demonstrate the functionality of this minimal blog application...",
  };

  blogs[sampleBlog.id] = sampleBlog;
  localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
}

// Make functions globally available
window.openAdminModal = openAdminModal;
window.authenticateAdmin = authenticateAdmin;
window.handleUpvote = handleUpvote;
window.openBlog = openBlog;
