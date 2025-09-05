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
        <div class="col-12">
            <div class="blog-card fade-in" data-blog-id="${blog.id}">
                <h3 class="blog-card-title">${escapeHtml(blog.title)}</h3>
                <p class="blog-card-preview">${escapeHtml(preview)}</p>
                <div class="blog-card-meta">
                    <div class="author-info">
                        <span class="author-name">${escapeHtml(
                          blog.author.name
                        )}</span>
                        ${
                          blog.author.linkedin
                            ? `<a href="${escapeHtml(
                                blog.author.linkedin
                              )}" target="_blank" class="author-linkedin">
                                <i class="fab fa-linkedin"></i>
                              </a>`
                            : ""
                        }
                        <span class="blog-date">${formattedDate}</span>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                        <button class="upvote-btn ${upvoteClass}" 
                                onclick="handleUpvote('${blog.id}', event)" 
                                data-blog-id="${blog.id}">
                            <i class="fas fa-arrow-up"></i>
                            <span>${blog.upvotes || 0}</span>
                        </button>
                        <button class="btn btn-outline-primary btn-sm read-more-btn" 
                                onclick="openBlogModal('${blog.id}', event)">
                            Read More
                        </button>
                    </div>
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
      const blogId = this.dataset.blogId;
      openBlogModal(blogId);
    });
  });
}

// Open blog detail modal
function openBlogModal(blogId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const blog = blogs[blogId];
  if (!blog) return;

  currentBlogId = blogId;
  const isUpvoted = upvotedBlogs.includes(blogId);
  const upvoteClass = isUpvoted ? "upvoted" : "";

  document.getElementById("blogModalTitle").textContent = blog.title;
  document.getElementById("blogModalMeta").innerHTML = `
        By ${escapeHtml(blog.author.name)} • ${formatDate(blog.createdAt)}
        ${
          blog.author.linkedin
            ? ` • <a href="${escapeHtml(
                blog.author.linkedin
              )}" target="_blank" class="author-linkedin"><i class="fab fa-linkedin"></i> LinkedIn</a>`
            : ""
        }
    `;
  document.getElementById("blogModalContent").textContent = blog.content;

  const modalUpvoteBtn = document.getElementById("modalUpvoteBtn");
  modalUpvoteBtn.className = `btn btn-outline-primary btn-sm upvote-btn ${upvoteClass}`;
  modalUpvoteBtn.onclick = () => handleUpvote(blogId);
  document.getElementById("modalUpvoteCount").textContent = blog.upvotes || 0;

  blogModal.show();
}

// Handle upvote functionality
async function handleUpvote(blogId, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (upvotedBlogs.includes(blogId)) {
    showToast("You have already liked this blog!", "warning");
    return;
  }

  try {
    const blog = blogs[blogId];
    const newUpvoteCount = (blog.upvotes || 0) + 1;

    blogs[blogId].upvotes = newUpvoteCount;

    if (isFirebaseConnected) {
      await database.ref(`blogs/${blogId}/upvotes`).set(newUpvoteCount);
    } else {
      localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
    }

    upvotedBlogs.push(blogId);
    localStorage.setItem("upvotedBlogs", JSON.stringify(upvotedBlogs));

    updateUpvoteButtons(blogId, newUpvoteCount, true);

    showToast("Thank you for your like!", "success");
  } catch (error) {
    console.error("Error updating upvote:", error);
    showToast("Failed to update like. Please try again.", "error");
  }
}

// Update upvote buttons in UI
function updateUpvoteButtons(blogId, count, isUpvoted) {
  document.querySelectorAll(`[data-blog-id="${blogId}"]`).forEach((btn) => {
    if (btn.classList.contains("upvote-btn")) {
      btn.classList.toggle("upvoted", isUpvoted);
      btn.querySelector("span").textContent = count;
    }
  });

  if (currentBlogId === blogId) {
    const modalBtn = document.getElementById("modalUpvoteBtn");
    modalBtn.classList.toggle("upvoted", isUpvoted);
    document.getElementById("modalUpvoteCount").textContent = count;
  }
}

// Show admin modal
function showAdminModal() {
  resetAdminModal();
  adminModal.show();
}

// Authenticate admin
function authenticateAdmin() {
  const secretCode = document.getElementById("secretCodeInput").value.trim();
  const authError = document.getElementById("authError");

  if (secretCode === SECRET_CODE) {
    document.getElementById("authStep").style.display = "none";
    document.getElementById("adminOptionsStep").style.display = "block";
    authError.style.display = "none";
  } else {
    authError.textContent = "Invalid secret code. Please try again.";
    authError.style.display = "block";
    document.getElementById("secretCodeInput").focus();
  }
}

// Show manual blog form
function showManualBlogForm() {
  document.getElementById("adminOptionsStep").style.display = "none";
  document.getElementById("manualBlogForm").style.display = "block";
  document.getElementById("blogTitle").focus();
}

// Handle manual blog submission
async function handleManualBlogSubmit(e) {
  e.preventDefault();

  const title = document.getElementById("blogTitle").value.trim();
  const authorName = document.getElementById("authorName").value.trim();
  const authorLinkedin = document.getElementById("authorLinkedin").value.trim();
  const content = document.getElementById("blogContent").value.trim();

  if (!title || !authorName || !content) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  const blog = createBlogObject(title, content, authorName, authorLinkedin);

  try {
    await saveBlog(blog);
    showToast("Blog published successfully!", "success");
    adminModal.hide();
    resetAdminModal();
    renderBlogs();
  } catch (error) {
    console.error("Error saving blog:", error);
    showToast("Failed to save blog. Please try again.", "error");
  }
}

// Create blog object
function createBlogObject(title, content, authorName, authorLinkedin) {
  const timestamp = new Date().toISOString();
  const blogId = `blog_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  return {
    id: blogId,
    title: title,
    content: content,
    preview: content.substring(0, 300) + "...",
    author: {
      name: authorName,
      linkedin: authorLinkedin || null,
    },
    createdAt: timestamp,
    upvotes: 0,
    status: "published",
    source: "manual",
  };
}

// Save blog
async function saveBlog(blog) {
  try {
    blogs[blog.id] = blog;

    if (isFirebaseConnected) {
      await database.ref(`blogs/${blog.id}`).set(blog);
    } else {
      localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
    }

    console.log("Blog saved successfully:", blog.id);
  } catch (error) {
    console.error("Error saving blog:", error);
    throw error;
  }
}

// Add sample blog to Firebase
async function addSampleBlogToFirebase() {
  const sampleBlog = createSampleBlog();
  try {
    await saveBlog(sampleBlog);
    console.log("Sample blog added to Firebase");
  } catch (error) {
    console.error("Error adding sample blog to Firebase:", error);
  }
}

// Add sample blog to local storage
function addSampleBlogToLocal() {
  const sampleBlog = createSampleBlog();
  blogs[sampleBlog.id] = sampleBlog;
  localStorage.setItem("minimalBlogs", JSON.stringify(blogs));
  console.log("Sample blog added to localStorage");
}

// Create sample blog
function createSampleBlog() {
  return {
    id: "blog_sample_" + Date.now(),
    title: "Welcome to Minimal Blog",
    content:
      'This is a sample blog post to demonstrate the functionality of our minimal blog application.\n\nFeatures:\n• Clean, responsive design\n• Firebase integration with localStorage fallback\n• Upvote functionality with duplicate prevention\n• Admin panel for adding blogs\n\nFeel free to explore all the features and add your own blog posts using the "Add Blog" button in the navigation bar. The secret code for admin access is "CODE".',
    preview:
      "This is a sample blog post to demonstrate the functionality of our minimal blog application. Features include clean design...",
    author: {
      name: "Demo Author",
      linkedin: null,
    },
    createdAt: new Date().toISOString(),
    upvotes: 5,
    status: "published",
    source: "manual",
  };
}

// Reset admin modal
function resetAdminModal() {
  document.getElementById("authStep").style.display = "block";
  document.getElementById("adminOptionsStep").style.display = "none";
  document.getElementById("manualBlogForm").style.display = "none";
  document.getElementById("authError").style.display = "none";

  document.getElementById("secretCodeInput").value = "";
  document.getElementById("blogForm").reset();
}

// Utility Functions
function showLoading(show) {
  loadingSpinner.style.display = show ? "block" : "none";
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `alert alert-${
    type === "error"
      ? "danger"
      : type === "success"
      ? "success"
      : type === "warning"
      ? "warning"
      : "info"
  } position-fixed`;
  toast.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 1060;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border-radius: 0.5rem;
    `;
  toast.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <span>${escapeHtml(message)}</span>
            <button type="button" class="btn-close btn-close-sm" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);

  toast.classList.add("fade-in");
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
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

// window.showAdminModal = showAdminModal;
// window.handleUpvote = handleUpvote;
// window.handleModalUpvote = handleModalUpvote;
// window.authenticateAdmin = authenticateAdmin;
// window.showManualBlogForm = showManualBlogForm;
// window.resetAdminModal = resetAdminModal;
// window.openBlogModal = openBlogModal;
