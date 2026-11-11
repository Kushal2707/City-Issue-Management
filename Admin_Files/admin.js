
/* =========================================
   CITY ISSUE MANAGEMENT
   ADMIN DASHBOARD JAVASCRIPT
========================================= */

const loginPage = document.getElementById("loginPage");
const dashboardPage = document.getElementById("dashboardPage");

const adminLoginForm = document.getElementById("adminLoginForm");
const logoutButton = document.getElementById("logoutButton");
const refreshButton = document.getElementById("refreshButton");

const complaintsContainer = document.getElementById("complaintsContainer");

const totalComplaints = document.getElementById("totalComplaints");
const pendingComplaints = document.getElementById("pendingComplaints");
const progressComplaints = document.getElementById("progressComplaints");
const resolvedComplaints = document.getElementById("resolvedComplaints");

const filterButtons = document.querySelectorAll(".filter-button");

let allComplaints = [];
let currentFilter = "active";


/* =========================================
   ADMIN LOGIN
========================================= */

adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const loginButton = document.getElementById("loginButton");

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    const formData = new FormData(adminLoginForm);

    try {
        const response = await fetch("/admin", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error("Login failed.");
        }

        loginPage.style.display = "none";
        dashboardPage.style.display = "block";

        await loadComplaints();

    } catch (error) {
        console.error("Login error:", error);
        alert("Invalid admin username or password.");

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});


/* =========================================
   LOAD COMPLAINTS
========================================= */

async function loadComplaints() {
    complaintsContainer.innerHTML = `
        <p class="loading-message">Loading complaints...</p>
    `;

    refreshButton.disabled = true;

    try {
        const response = await fetch("/api/complaints");

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Unable to load complaints.");
        }

        allComplaints = data.complaints || [];

        updateStatistics(allComplaints);
        renderFilteredComplaints();

    } catch (error) {
        console.error("Load complaints error:", error);

        complaintsContainer.innerHTML = `
            <p class="error-message">
                Unable to load complaints.
                Please try refreshing.
            </p>
        `;

    } finally {
        refreshButton.disabled = false;
    }
}


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics(complaints) {
    totalComplaints.textContent = complaints.length;

    pendingComplaints.textContent =
        complaints.filter(c => c.status === "Pending").length;

    progressComplaints.textContent =
        complaints.filter(c => c.status === "In Progress").length;

    resolvedComplaints.textContent =
        complaints.filter(c => c.status === "Resolved").length;
}


/* =========================================
   COMPLAINT FILTER BUTTONS
========================================= */

filterButtons.forEach(button => {
    button.addEventListener("click", function () {
        currentFilter = this.dataset.filter;

        filterButtons.forEach(filterButton => {
            filterButton.classList.remove("active");
        });

        this.classList.add("active");

        renderFilteredComplaints();
    });
});


/* =========================================
   FILTER COMPLAINTS
========================================= */

function renderFilteredComplaints() {
    let filteredComplaints = [];

    if (currentFilter === "active") {
        filteredComplaints = allComplaints.filter(
            complaint => complaint.status !== "Resolved"
        );
    }

    else if (currentFilter === "resolved") {
        filteredComplaints = allComplaints.filter(
            complaint => complaint.status === "Resolved"
        );
    }

    else if (currentFilter === "all") {
        filteredComplaints = [...allComplaints];
    }

    renderComplaints(filteredComplaints);
}


/* =========================================
   RENDER COMPLAINTS
========================================= */

function renderComplaints(complaints) {

    if (complaints.length === 0) {
        let message = "No complaints found.";

        if (currentFilter === "active") {
            message = "No active complaints found.";
        }

        else if (currentFilter === "resolved") {
            message = "No resolved complaints found.";
        }

        complaintsContainer.innerHTML = `
            <p class="empty-message">${message}</p>
        `;

        return;
    }

    complaintsContainer.innerHTML = complaints.map(complaint => {

        const complaintId = Number(complaint.id);

        const imageUrl = safeImageUrl(complaint.image);

        const isResolved = complaint.status === "Resolved";

        return `
            <div class="complaint-card">

                <div class="complaint-header">

                    <div>
                        <h3>${escapeHTML(complaint.complaint_id)}</h3>

                        <p>${escapeHTML(complaint.issue_type)}</p>
                    </div>

                    <span class="status-badge ${getStatusClass(complaint.status)}">
                        ${escapeHTML(complaint.status)}
                    </span>

                </div>

                <div class="complaint-content">

                    <div class="complaint-image">

                        ${
                            imageUrl
                                ? `
                                    <img
                                        src="${imageUrl}"
                                        alt="Complaint Image"
                                        loading="lazy"
                                        onerror="
                                            this.style.display='none';
                                            this.nextElementSibling.style.display='block';
                                        "
                                    >

                                    <p
                                        class="empty-message"
                                        style="display:none;"
                                    >
                                        Unable to load complaint image.
                                    </p>
                                `
                                : `
                                    <p class="empty-message">
                                        No image available.
                                    </p>
                                `
                        }

                    </div>

                    <div class="complaint-details">

                        <p>
                            <strong>Name:</strong>
                            ${escapeHTML(complaint.name)}
                        </p>

                        <p>
                            <strong>Email:</strong>
                            ${escapeHTML(complaint.email)}
                        </p>

                        <p>
                            <strong>Description:</strong>
                            ${escapeHTML(complaint.description)}
                        </p>

                        <p>
                            <strong>Place:</strong>
                            ${escapeHTML(complaint.place || "Not available")}
                        </p>

                        <p>
                            <strong>Address:</strong>
                            ${escapeHTML(complaint.address || "Not available")}
                        </p>

                        <p>
                            <strong>Latitude:</strong>
                            ${escapeHTML(complaint.latitude ?? "Not available")}
                        </p>

                        <p>
                            <strong>Longitude:</strong>
                            ${escapeHTML(complaint.longitude ?? "Not available")}
                        </p>

                        <p>
                            <strong>Submitted:</strong>
                            ${escapeHTML(complaint.created_at)}
                        </p>

                    </div>

                </div>

                ${
                    !isResolved && Number.isSafeInteger(complaintId)
                        ? `
                            <div class="status-controls">

                                <button
                                    type="button"
                                    class="status-button pending-button"
                                    onclick="updateStatus(${complaintId}, 'Pending')"
                                >
                                    Mark Pending
                                </button>

                                <button
                                    type="button"
                                    class="status-button progress-button"
                                    onclick="updateStatus(${complaintId}, 'In Progress')"
                                >
                                    Mark In Progress
                                </button>

                                <button
                                    type="button"
                                    class="status-button resolved-button"
                                    onclick="updateStatus(${complaintId}, 'Resolved')"
                                >
                                    Mark Resolved
                                </button>

                            </div>
                        `
                        : `
                            <div class="status-controls">

                                <span class="status-badge status-resolved">
                                    ✓ Complaint Successfully Resolved
                                </span>

                            </div>
                        `
                }

            </div>
        `;

    }).join("");
}


/* =========================================
   UPDATE COMPLAINT STATUS
========================================= */

async function updateStatus(complaintId, newStatus) {

    const confirmation = confirm(
        "Are you sure you want to change this complaint status to " +
        newStatus + "?"
    );

    if (!confirmation) {
        return;
    }

    try {
        const response = await fetch(
            "/api/complaints/" + complaintId + "/status",
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    status: newStatus
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Unable to update complaint status."
            );
        }

        alert(
            "Complaint status successfully updated to " + newStatus
        );

        await loadComplaints();

    } catch (error) {
        console.error("Status update error:", error);

        alert(
            "Unable to update complaint status.\n\n" +
            error.message
        );
    }
}


/* =========================================
   REFRESH COMPLAINTS
========================================= */

refreshButton.addEventListener("click", function () {
    loadComplaints();
});


/* =========================================
   LOGOUT
========================================= */

logoutButton.addEventListener("click", function () {

    const confirmation = confirm(
        "Are you sure you want to logout?"
    );

    if (!confirmation) {
        return;
    }

    dashboardPage.style.display = "none";
    loginPage.style.display = "flex";

    adminLoginForm.reset();

    currentFilter = "active";

    filterButtons.forEach(button => {
        button.classList.remove("active");

        if (button.dataset.filter === "active") {
            button.classList.add("active");
        }
    });

    allComplaints = [];
});


/* =========================================
   STATUS CLASS
========================================= */

function getStatusClass(status) {

    if (status === "Pending") {
        return "status-pending";
    }

    if (status === "In Progress") {
        return "status-progress";
    }

    if (status === "Resolved") {
        return "status-resolved";
    }

    return "";
}


/* =========================================
   SAFE IMAGE URL
   SUPPORTS BASE64 + NORMAL IMAGE URLS
========================================= */

function safeImageUrl(value) {

    if (!value) {
        return "";
    }

    const imageValue = String(value).trim();

    // Support Base64 images stored in SQLite
    const base64ImagePattern =
        /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

    if (base64ImagePattern.test(imageValue)) {
        return escapeHTML(imageValue);
    }

    // Support normal HTTP and HTTPS image URLs
    try {
        const url = new URL(
            imageValue,
            window.location.origin
        );

        if (
            url.protocol !== "http:" &&
            url.protocol !== "https:"
        ) {
            return "";
        }

        return escapeHTML(url.href);

    } catch (error) {
        return "";
    }
}


/* =========================================
   HTML SECURITY
========================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
