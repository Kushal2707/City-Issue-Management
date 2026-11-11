
document.addEventListener("DOMContentLoaded", () => {
    // ========================================
    // ELEMENTS
    // ========================================

    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");
    const issueType = document.getElementById("issueType");
    const description = document.getElementById("description");
    const submitButton = document.getElementById("submitButton");

    // Find camera button by ID, with a text-based fallback.
    const cameraButton =
        document.getElementById("cameraButton") ||
        Array.from(document.querySelectorAll("button")).find(
            button => button.textContent.trim().toLowerCase() === "open camera"
        );

    // Exact outer camera container ID is defined in user.html.
    const cameraBox = document.getElementById("cameraBox");

    const locationButton =
        document.getElementById("locationButton") ||
        Array.from(document.querySelectorAll("button")).find(
            button => button.textContent.trim().toLowerCase() === "detect location"
        );

    const locationStatus =
        document.getElementById("locationStatus") ||
        locationButton?.parentElement?.querySelector("span, p, div");

    const complaintIdInput = document.getElementById("complaintId");
    const trackButton = document.getElementById("trackButton");
    const publicReportsContainer =
        document.getElementById("publicReportsContainer");

    console.log("Camera button found:", !!cameraButton);
    console.log("Camera preview found:", !!cameraBox);
    console.log("Location button found:", !!locationButton);


    // ========================================
    // STATE
    // ========================================

    let cameraStream = null;
    let capturedImage = null;

    let latitude = null;
    let longitude = null;
    let place = "";
    let address = "";


    // ========================================
    // HELPERS
    // ========================================

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function setLocationMessage(message) {
        if (locationStatus) {
            locationStatus.textContent = message;
        } else {
            alert(message);
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
    }

    function showCameraError(error) {
        console.error("Camera error:", error);

        if (cameraBox) {
            cameraBox.innerHTML = `
                <div class="camera-placeholder">
                    <p><strong>Unable to open camera.</strong></p>
                    <p>${escapeHTML(error.name || "Error")}: ${escapeHTML(error.message || "Unknown camera error")}</p>
                </div>
            `;
        }

        let explanation = error.message || "Unknown camera error";

        if (!window.isSecureContext) {
            explanation = "Camera access requires HTTPS, except on localhost. Use https:// for your deployed website or http://127.0.0.1:5000 locally.";
        } else if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error.name)) {
            explanation = "Camera permission was denied or blocked. Allow camera access in your browser's site settings, then reload the page.";
        } else if (["NotFoundError", "DevicesNotFoundError"].includes(error.name)) {
            explanation = "No camera was detected. Connect or enable a camera, or try another device.";
        } else if (["NotReadableError", "TrackStartError"].includes(error.name)) {
            explanation = "The camera is detected but cannot be opened. Close Camera, Teams, Zoom and other apps using it, then retry.";
        } else if (error.name === "OverconstrainedError") {
            explanation = "The requested camera mode is unavailable. Check that your camera supports video, then retry.";
        } else if (error.name === "AbortError") {
            explanation = "Camera startup was interrupted. Please try again.";
        }

        alert("Camera error: " + explanation);
    }


        // CAMERA
    // ========================================

    if (!cameraButton || !cameraBox) {
        console.error(
            "Camera elements are missing. Check cameraButton and cameraBox in user.html."
        );
    } else {
        cameraButton.type = "button";

        cameraButton.addEventListener("click", async event => {
            event.preventDefault();

            try {
                if (!window.isSecureContext) {
                    throw new Error(
                        "Camera access requires HTTPS, except on localhost. Use https:// for the deployed website or http://127.0.0.1:5000 locally."
                    );
                }

                if (!navigator.mediaDevices ||
                    !navigator.mediaDevices.getUserMedia) {
                    throw new Error(
                        "This browser does not provide camera access. Use an up-to-date Chrome or Edge browser."
                    );
                }

                stopCamera();
                capturedImage = null;

                cameraBox.innerHTML = `
                    <div id="cameraMessage" class="camera-message">
                        Requesting camera access...
                    </div>

                    <video
                        id="cameraVideo"
                        autoplay
                        playsinline
                        muted
                        style="width:100%; max-width:650px; border-radius:12px;">
                    </video>

                    <button type="button" id="captureButton">
                        📸 Capture Image
                    </button>
                `;

                const video = cameraBox.querySelector("#cameraVideo");

                if (!video) {
                    throw new Error("Camera video element not found. Please check the camera HTML.");
                }

                try {
                    // A generic webcam request works for laptops and phones.
                    // Do not force a rear camera on desktop computers.
                    cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    });
                } catch (firstError) {
                    // Retry with the least restrictive request only when a
                    // requested video constraint is unsupported.
                    if (firstError.name !== "OverconstrainedError" &&
                        firstError.name !== "ConstraintNotSatisfiedError") {
                        throw firstError;
                    }
                    console.warn("Camera constraints unsupported; retrying with video:true", firstError);
                    cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                }

                video.srcObject = cameraStream;
                await video.play();

                document.getElementById("cameraMessage").textContent =
                    "Camera ready. Capture the issue image.";

                document.getElementById("captureButton")
                    .addEventListener("click", captureEvent => {
                        captureEvent.preventDefault();

                        if (!video.videoWidth || !video.videoHeight) {
                            alert("Camera is still loading. Try again shortly.");
                            return;
                        }

                        const canvas = document.createElement("canvas");
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;

                        const context = canvas.getContext("2d");
                        context.drawImage(
                            video, 0, 0, canvas.width, canvas.height
                        );

                        capturedImage =
                            canvas.toDataURL("image/jpeg", 0.85);

                        stopCamera();

                        cameraBox.innerHTML = `
                            <img src="${capturedImage}"
                                alt="Captured complaint image"
                                style="display:block;width:100%;max-width:500px;border-radius:8px;">
                            <p>Image captured successfully.</p>
                            <button type="button" id="retakeButton">
                                Retake Image
                            </button>
                        `;

                        document.getElementById("retakeButton")
                            .addEventListener("click", retakeEvent => {
                                retakeEvent.preventDefault();
                                capturedImage = null;
                                cameraButton.click();
                            });
                    });

            } catch (error) {
                stopCamera();
                showCameraError(error);
            }
        });
    }


    // ========================================
    // FULL LOCATION
    // ========================================

    if (!locationButton) {
        console.error(
            "Location button not found. Check the Detect Location button in user.html."
        );
    } else {
        locationButton.type = "button";

        locationButton.addEventListener("click", event => {
            event.preventDefault();

            if (!navigator.geolocation) {
                setLocationMessage(
                    "Your browser does not support location services."
                );
                return;
            }

            locationButton.disabled = true;
            setLocationMessage("Getting your current GPS location...");

            latitude = null;
            longitude = null;
            place = "";
            address = "";

            navigator.geolocation.getCurrentPosition(
                async position => {
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;

                    const accuracy = Math.round(position.coords.accuracy);

                    setLocationMessage(
                        `GPS acquired (accuracy approximately ${accuracy} m). Looking up full address...`
                    );

                    try {
                        const url =
                            "https://nominatim.openstreetmap.org/reverse" +
                            `?format=jsonv2&lat=${latitude}&lon=${longitude}`;

                        const response = await fetch(url);

                        if (!response.ok) {
                            throw new Error(
                                `Address service returned HTTP ${response.status}`
                            );
                        }

                        const data = await response.json();
                        address = data.display_name || "";

                        const a = data.address || {};

                        place =
                            a.city ||
                            a.town ||
                            a.village ||
                            a.municipality ||
                            a.county ||
                            a.state ||
                            "";

                        if (address) {
                            setLocationMessage(
                                `Full location: ${address}\nGPS: ${latitude}, ${longitude}`
                            );
                        } else {
                            setLocationMessage(
                                `GPS: ${latitude}, ${longitude}. Full address unavailable.`
                            );
                        }

                    } catch (error) {
                        console.error("Address lookup error:", error);

                        setLocationMessage(
                            `GPS obtained: ${latitude}, ${longitude}. The full address service is unavailable.`
                        );
                    } finally {
                        locationButton.disabled = false;
                    }
                },

                error => {
                    console.error("Geolocation error:", error);

                    const messages = {
                        1: "Location permission denied. Allow location in Chrome site settings.",
                        2: "Your device could not determine location. Check Windows location services.",
                        3: "Location request timed out. Try again."
                    };

                    setLocationMessage(
                        messages[error.code] || "Unable to get your location."
                    );

                    locationButton.disabled = false;
                },

                {
                    enableHighAccuracy: true,
                    timeout: 30000,
                    maximumAge: 0
                }
            );
        });
    }


    // ========================================
    // SUBMIT COMPLAINT
    // ========================================

    if (submitButton) {
        submitButton.type = "button";

        submitButton.addEventListener("click", async event => {
            event.preventDefault();

            const name = userName?.value.trim() || "";
            const email = userEmail?.value.trim() || "";
            const selectedIssue = issueType?.value || "";
            const issueDescription = description?.value.trim() || "";

            if (!name) return alert("Please enter your name.");
            if (!email) return alert("Please enter your email.");

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return alert("Please enter a valid email address.");
            }

            if (!selectedIssue) return alert("Please select an issue type.");
            if (!issueDescription) return alert("Please enter the description.");
            if (!capturedImage) return alert("Please capture the issue image.");

            if (latitude === null || longitude === null) {
                return alert("Please detect your GPS location first.");
            }

            submitButton.disabled = true;
            const originalText = submitButton.textContent;
            submitButton.textContent = "Submitting...";

            try {
                const response = await fetch("/api/complaints", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        email,
                        issue_type: selectedIssue,
                        description: issueDescription,
                        image: capturedImage,
                        latitude,
                        longitude,
                        place,
                        address
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.error || "Unable to submit complaint."
                    );
                }

                let message =
                    `Complaint submitted successfully!\nComplaint ID: ${result.complaint_id}`;

                if (result.email_sent === false) {
                    message +=
                        "\n\nComplaint saved, but the acknowledgment email could not be sent. Check the Flask terminal.";
                } else {
                    message +=
                        `\n\nThe acknowledgment is addressed to ${email}.`;
                }

                alert(message);

                if (userName) userName.value = "";
                if (userEmail) userEmail.value = "";
                if (issueType) issueType.value = "";
                if (description) description.value = "";

                capturedImage = null;
                latitude = null;
                longitude = null;
                place = "";
                address = "";

                stopCamera();

                if (cameraBox) {
                    cameraBox.innerHTML = `
                        <div class="camera-placeholder">
                            <span class="camera-icon">📷</span>
                            <p>Camera will be available here</p>
                        </div>
                    `;
                }

                setLocationMessage("Location not detected.");

                await loadPublicReports();

            } catch (error) {
                console.error("Submission error:", error);
                alert(error.message || "Unable to submit complaint.");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }


    // ========================================
    // TRACK COMPLAINT
    // ========================================

    if (trackButton) {
        trackButton.type = "button";

        trackButton.addEventListener("click", async event => {
            event.preventDefault();

            const id = complaintIdInput?.value.trim().toUpperCase() || "";

            if (!id) return alert("Please enter your Complaint ID.");

            trackButton.disabled = true;
            const originalText = trackButton.textContent;
            trackButton.textContent = "Checking...";

            try {
                const response = await fetch(
                    `/api/complaints/${encodeURIComponent(id)}`
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || "Complaint not found.");
                }

                const c = result.complaint;

                const statusClass =
                    c.status === "Resolved" ? "status-resolved" :
                    c.status === "In Progress" ? "status-progress" :
                    "status-pending";

                let box = document.getElementById("trackingResult");

                if (!box) {
                    box = document.createElement("div");
                    box.id = "trackingResult";
                    trackButton.insertAdjacentElement("afterend", box);
                }

                box.innerHTML = `
                    <div class="tracking-card">
                        <h3>Complaint ${escapeHTML(c.complaint_id)}</h3>
                        <p><strong>Issue:</strong> ${escapeHTML(c.issue_type)}</p>
                        <p><strong>Description:</strong> ${escapeHTML(c.description)}</p>
                        <p><strong>Place:</strong> ${escapeHTML(c.place || "Not available")}</p>
                        <p><strong>Address:</strong> ${escapeHTML(c.address || "Not available")}</p>
                        <p><strong>Date:</strong> ${escapeHTML(c.created_at)}</p>
                        <p><strong>Status:</strong>
                            <span class="${statusClass}">${escapeHTML(c.status)}</span>
                        </p>
                    </div>
                `;

            } catch (error) {
                console.error("Tracking error:", error);
                alert(error.message || "Unable to track complaint.");
            } finally {
                trackButton.disabled = false;
                trackButton.textContent = originalText;
            }
        });
    }


    // ========================================
    // PUBLIC REPORTS
    // ========================================

    async function loadPublicReports() {
        if (!publicReportsContainer) {
            console.error("publicReportsContainer not found.");
            return;
        }

        publicReportsContainer.innerHTML = "<p>Loading public reports...</p>";

        try {
            const response = await fetch("/api/complaints");

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Unable to load reports.");
            }

            const complaints = result.complaints || [];

            if (complaints.length === 0) {
                publicReportsContainer.innerHTML = `
                    <div class="no-reports">
                        <h3>No reports available</h3>
                        <p>Registered complaints will appear here.</p>
                    </div>
                `;
                return;
            }

            publicReportsContainer.innerHTML = complaints.map(c => {
                const statusClass =
                    c.status === "Resolved" ? "status-resolved" :
                    c.status === "In Progress" ? "status-progress" :
                    "status-pending";

                return `
                    <div class="public-report-card">
                        <div class="report-header">
                            <h3>${escapeHTML(c.complaint_id)}</h3>
                            <span class="${statusClass}">
                                ${escapeHTML(c.status)}
                            </span>
                        </div>
                        <p><strong>Issue:</strong> ${escapeHTML(c.issue_type)}</p>
                        <p><strong>Description:</strong> ${escapeHTML(c.description)}</p>
                        <p><strong>Place:</strong> ${escapeHTML(c.place || "Location unavailable")}</p>
                        <p><strong>Reported:</strong> ${escapeHTML(c.created_at)}</p>
                    </div>
                `;
            }).join("");

        } catch (error) {
            console.error("Public reports error:", error);

            publicReportsContainer.innerHTML = `
                <div class="no-reports">
                    <h3>Unable to load reports</h3>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }


    // ========================================
    // INITIALIZE
    // ========================================

    loadPublicReports();

    // Release the camera if the page is being closed or reloaded.
    window.addEventListener("pagehide", stopCamera);
});
