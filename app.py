
from flask import Flask, render_template, send_from_directory, request, jsonify
import sqlite3
from datetime import datetime
import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

# ===============================
# ENVIRONMENT CONFIGURATION
# ===============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = Flask(__name__)

DATABASE = os.path.join(BASE_DIR, "city_issues.db")

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME") or EMAIL_ADDRESS
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or os.getenv("EMAIL_APP_PASSWORD", "")


# ===============================
# DATABASE CONNECTION
# ===============================

def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


# ===============================
# COMMON EMAIL SENDER
# ===============================

def send_email(recipient_email, subject, body):

    try:
        if not EMAIL_ADDRESS or not SMTP_USERNAME or not SMTP_PASSWORD:
            print("Email configuration is incomplete.")
            return False

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = EMAIL_ADDRESS
        message["To"] = recipient_email
        message.set_content(body)

        if SMTP_PORT == 465:

            with smtplib.SMTP_SSL(
                SMTP_HOST,
                SMTP_PORT,
                timeout=20
            ) as server:

                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(message)

        else:

            with smtplib.SMTP(
                SMTP_HOST,
                SMTP_PORT,
                timeout=20
            ) as server:

                server.ehlo()
                server.starttls()
                server.ehlo()

                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(message)

        print(f"Email successfully sent to {recipient_email}")
        return True

    except Exception as error:

        print("Email sending error:", repr(error))
        return False


# ===============================
# COMPLAINT ACKNOWLEDGMENT EMAIL
# ===============================

def send_acknowledgment_email(
    recipient_email,
    complaint_id,
    name,
    issue_type,
    description,
    place,
    address,
    created_at
):

    subject = f"Complaint Acknowledgment - {complaint_id}"

    body = f"""
Dear {name},

Your civic complaint has been successfully registered.

COMPLAINT DETAILS
------------------------------

Complaint ID : {complaint_id}
Issue Type   : {issue_type}
Description  : {description}
Place        : {place or "Not available"}
Address      : {address or "Not available"}

Status       : Pending
Submitted On : {created_at}

Your complaint has been recorded successfully
in the City Issue Management System.

Please keep your Complaint ID safe:
{complaint_id}

You can use this ID to track your complaint.

Thank you for helping us improve our city.

Regards,
CivicConnect Support Team
City Issue Management System
"""

    return send_email(
        recipient_email,
        subject,
        body
    )


# ===============================
# COMPLAINT RESOLUTION EMAIL
# ===============================

def send_resolution_email(
    recipient_email,
    name,
    complaint_id,
    issue_type,
    resolved_at
):

    subject = f"Complaint Resolved - {complaint_id}"

    body = f"""
Dear {name},

We are pleased to inform you that your civic complaint
has been successfully resolved.

COMPLAINT DETAILS
------------------------------

Complaint ID : {complaint_id}
Issue Type   : {issue_type}

Status       : Resolved
Resolved On  : {resolved_at}

The concerned authorities have marked your complaint
as resolved in the City Issue Management System.

Thank you for bringing this issue to our attention
and helping us improve our city.

Regards,
CivicConnect Support Team
City Issue Management System
"""

    return send_email(
        recipient_email,
        subject,
        body
    )


# ===============================
# USER PAGE
# ===============================

@app.route("/")
def user_page():
    return render_template("user.html")


# ===============================
# ADMIN LOGIN
# ===============================

@app.route("/admin", methods=["GET", "POST"])
def admin_page():

    if request.method == "POST":

        username = request.form.get("username")
        password = request.form.get("password")

        if (
            username == ADMIN_USERNAME
            and password == ADMIN_PASSWORD
        ):
            return render_template("admin.html")

        return "Invalid username or password", 401

    return render_template("admin.html")


# ===============================
# SUBMIT COMPLAINT
# ===============================

@app.route("/api/complaints", methods=["POST"])

def submit_complaint():

    connection = None

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No complaint data received."
            }), 400

        name = data.get("name")
        email = data.get("email")
        issue_type = data.get("issue_type")
        description = data.get("description")
        image = data.get("image")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        place = data.get("place")
        address = data.get("address")

        if not name:
            return jsonify({
                "success": False,
                "error": "Name is required."
            }), 400

        if not email:
            return jsonify({
                "success": False,
                "error": "Email is required."
            }), 400

        if not issue_type:
            return jsonify({
                "success": False,
                "error": "Issue type is required."
            }), 400

        if not description:
            return jsonify({
                "success": False,
                "error": "Description is required."
            }), 400

        if not image:
            return jsonify({
                "success": False,
                "error": "Complaint image is required."
            }), 400

        if latitude is None or longitude is None:
            return jsonify({
                "success": False,
                "error": "Location is required."
            }), 400

        connection = get_db_connection()

        last_complaint = connection.execute(
            """
            SELECT id
            FROM complaints
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

        next_number = (
            last_complaint["id"] + 1
            if last_complaint else 1
        )

        complaint_id = f"CMP-{next_number:04d}"

        created_at = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        connection.execute(
            """
            INSERT INTO complaints
            (
                complaint_id,
                name,
                email,
                issue_type,
                description,
                image,
                latitude,
                longitude,
                place,
                address,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                complaint_id,
                name,
                email,
                issue_type,
                description,
                image,
                latitude,
                longitude,
                place,
                address,
                "Pending",
                created_at
            )
        )

        connection.commit()

        connection.close()
        connection = None

        # Send acknowledgment email
        email_sent = send_acknowledgment_email(
            recipient_email=email,
            complaint_id=complaint_id,
            name=name,
            issue_type=issue_type,
            description=description,
            place=place,
            address=address,
            created_at=created_at
        )

        return jsonify({
            "success": True,
            "message": "Complaint submitted successfully.",
            "complaint_id": complaint_id,
            "email_sent": email_sent
        }), 201

    except Exception as error:

        if connection:
            connection.rollback()
            connection.close()

        print("Complaint submission error:", repr(error))

        return jsonify({
            "success": False,
            "error": "Unable to submit complaint."
        }), 500


# ===============================
# GET ALL COMPLAINTS
# ===============================

@app.route("/api/complaints", methods=["GET"])

def get_complaints():

    try:

        connection = get_db_connection()

        complaints = connection.execute(
            """
            SELECT
                id,
                complaint_id,
                name,
                email,
                issue_type,
                description,
                image,
                latitude,
                longitude,
                place,
                address,
                status,
                created_at
            FROM complaints
            ORDER BY id DESC
            """
        ).fetchall()

        connection.close()

        complaint_list = []

        for complaint in complaints:

            complaint_list.append({
                "id": complaint["id"],
                "complaint_id": complaint["complaint_id"],
                "name": complaint["name"],
                "email": complaint["email"],
                "issue_type": complaint["issue_type"],
                "description": complaint["description"],
                "image": complaint["image"],
                "latitude": complaint["latitude"],
                "longitude": complaint["longitude"],
                "place": complaint["place"],
                "address": complaint["address"],
                "status": complaint["status"],
                "created_at": complaint["created_at"]
            })

        return jsonify({
            "success": True,
            "complaints": complaint_list
        })

    except Exception as error:

        print("Database error:", repr(error))

        return jsonify({
            "success": False,
            "error": "Unable to load complaints."
        }), 500


# ===============================
# UPDATE COMPLAINT STATUS
# ===============================

@app.route(
    "/api/complaints/<int:complaint_id>/status",
    methods=["PUT"]
)

def update_complaint_status(complaint_id):

    connection = None

    try:

        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "error": "No status data received."
            }), 400

        new_status = data.get("status")

        allowed_statuses = [
            "Pending",
            "In Progress",
            "Resolved"
        ]

        if new_status not in allowed_statuses:

            return jsonify({
                "success": False,
                "error": "Invalid complaint status."
            }), 400

        connection = get_db_connection()

        complaint = connection.execute(
            """
            SELECT *
            FROM complaints
            WHERE id = ?
            """,
            (complaint_id,)
        ).fetchone()

        if complaint is None:

            connection.close()

            return jsonify({
                "success": False,
                "error": "Complaint not found."
            }), 404

        old_status = complaint["status"]

        # Update only if the status changes
        if old_status != new_status:

            connection.execute(
                """
                UPDATE complaints
                SET status = ?
                WHERE id = ?
                """,
                (new_status, complaint_id)
            )

            connection.commit()

        connection.close()
        connection = None

        resolution_email_sent = None

        # Send email only when status changes to Resolved
        if (
            old_status != "Resolved"
            and new_status == "Resolved"
        ):

            resolved_at = datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            resolution_email_sent = send_resolution_email(
                recipient_email=complaint["email"],
                name=complaint["name"],
                complaint_id=complaint["complaint_id"],
                issue_type=complaint["issue_type"],
                resolved_at=resolved_at
            )

        return jsonify({
            "success": True,
            "message": "Complaint status updated successfully.",
            "complaint_id": complaint["complaint_id"],
            "status": new_status,
            "resolution_email_sent": resolution_email_sent
        })

    except Exception as error:

        if connection:
            connection.rollback()
            connection.close()

        print("Status update error:", repr(error))

        return jsonify({
            "success": False,
            "error": "Unable to update complaint status."
        }), 500


# ===============================
# TRACK COMPLAINT
# ===============================

@app.route(
    "/api/complaints/<complaint_id>",
    methods=["GET"]
)

def track_complaint(complaint_id):

    try:

        complaint_id = complaint_id.strip().upper()

        connection = get_db_connection()

        complaint = connection.execute(
            """
            SELECT
                complaint_id,
                issue_type,
                description,
                status,
                place,
                address,
                created_at
            FROM complaints
            WHERE complaint_id = ?
            """,
            (complaint_id,)
        ).fetchone()

        connection.close()

        if complaint is None:

            return jsonify({
                "success": False,
                "error": "Complaint not found."
            }), 404

        return jsonify({
            "success": True,
            "complaint": {
                "complaint_id": complaint["complaint_id"],
                "issue_type": complaint["issue_type"],
                "description": complaint["description"],
                "status": complaint["status"],
                "place": complaint["place"],
                "address": complaint["address"],
                "created_at": complaint["created_at"]
            }
        })

    except Exception as error:

        print("Track complaint error:", repr(error))

        return jsonify({
            "success": False,
            "error": "Unable to track complaint."
        }), 500


# ===============================
# USER CSS
# ===============================

@app.route("/user.css")

def user_css():

    return send_from_directory(
        os.path.join(BASE_DIR, "UserEntry_Files"),
        "user.css"
    )


# ===============================
# USER JS
# ===============================

@app.route("/user.js")

def user_js():

    return send_from_directory(
        os.path.join(BASE_DIR, "UserEntry_Files"),
        "user.js"
    )


# ===============================
# ADMIN CSS
# ===============================

@app.route("/admin.css")

def admin_css():

    return send_from_directory(
        os.path.join(BASE_DIR, "Admin_Files"),
        "admin.css"
    )


# ===============================
# ADMIN JS
# ===============================

@app.route("/admin.js")

def admin_js():

    return send_from_directory(
        os.path.join(BASE_DIR, "Admin_Files"),
        "admin.js"
    )


# ===============================
# RUN SERVER
# ===============================

if __name__ == "__main__":

    app.run(debug=True)
