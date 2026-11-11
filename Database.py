import sqlite3


# Connect to the database file
connection = sqlite3.connect("city_issues.db")


# Create complaints table
connection.execute("""
CREATE TABLE complaints (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    complaint_id TEXT UNIQUE NOT NULL,

    name TEXT NOT NULL,

    email TEXT NOT NULL,

    issue_type TEXT NOT NULL,

    description TEXT NOT NULL,

    image TEXT NOT NULL,

    latitude REAL NOT NULL,

    longitude REAL NOT NULL,

    place TEXT,

    address TEXT,

    status TEXT NOT NULL DEFAULT 'Pending',

    created_at TEXT NOT NULL

)
""")


connection.commit()

connection.close()


print("Database created successfully!")
print("File: city_issues.db")
print("Table: complaints")