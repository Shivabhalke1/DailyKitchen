import asyncio
import os
import sqlite3
import sys

# Ensure repository root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.core.security import hash_password, generate_customer_code


def wipe_database(db_path: str):
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist, skipping.")
        return

    print(f"\n==========================================")
    print(f"Wiping all data from: {db_path}")
    print(f"==========================================")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Enable foreign keys
    cur.execute("PRAGMA foreign_keys = OFF")

    # 1. Purge all orders, order details, payments, history, reservations
    tables_to_wipe = [
        "order_status_history",
        "order_items",
        "order_addresses",
        "payments",
        "inventory_reservations",
        "orders",
        "cart_items",
        "carts",
        "inventory",
        "product_variants",
        "products",
        "categories",
        "delivery_slots",
        "delivery_zones",
        "password_reset_tokens",
        "otp_challenges",
        "user_sessions",
        "addresses",
    ]

    for table in tables_to_wipe:
        try:
            cur.execute(f"DELETE FROM {table}")
            print(f"  ✓ Purged table: {table}")
        except sqlite3.OperationalError as e:
            print(f"  - Table {table} not found or skipped: {e}")

    # 2. Delete all non-admin users and profiles
    cur.execute("DELETE FROM profiles WHERE user_id NOT IN (SELECT id FROM users WHERE role = 'admin' OR phone = '+919999999999')")
    cur.execute("DELETE FROM users WHERE role != 'admin' AND phone != '+919999999999'")
    print("  ✓ Purged all customer accounts, profiles, and fake users")

    # 3. Ensure authentic Admin Account exists
    admin_phone = "+919999999999"
    cur.execute("SELECT id FROM users WHERE phone = ?", (admin_phone,))
    admin_row = cur.fetchone()

    admin_pass_hash = hash_password("Admin@123456")

    if not admin_row:
        import uuid
        admin_id = str(uuid.uuid4())
        admin_code = "DKC-7F2973D7"
        cur.execute(
            """
            INSERT INTO users (id, phone, email, hashed_password, is_phone_verified, is_email_verified, is_active, role, customer_code, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, 1, 1, 'admin', ?, datetime('now'), datetime('now'))
            """,
            (admin_id, admin_phone, "admin@dailykitchen.com", admin_pass_hash, admin_code)
        )
        profile_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO profiles (id, user_id, full_name, created_at, updated_at)
            VALUES (?, ?, 'Operations Administrator', datetime('now'), datetime('now'))
            """,
            (profile_id, admin_id)
        )
        print(f"  ✓ Provisioned fresh Admin account: {admin_phone} ({admin_code})")
    else:
        admin_id = admin_row[0]
        cur.execute(
            """
            UPDATE users SET
                hashed_password = ?,
                is_active = 1,
                role = 'admin',
                customer_code = COALESCE(customer_code, 'DKC-7F2973D7')
            WHERE id = ?
            """,
            (admin_pass_hash, admin_id)
        )
        print(f"  ✓ Verified Admin account: {admin_phone}")

    cur.execute("PRAGMA foreign_keys = ON")
    conn.commit()

    print("\n--- Summary of remaining rows in database ---")
    tables = [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'").fetchall()]
    for t in tables:
        count = cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        print(f"  {t}: {count}")

    conn.close()


if __name__ == "__main__":
    wipe_database("dailykitchen.db")
    wipe_database("backend/dailykitchen.db")
    print("\nSUCCESS: All dummy and mock data wiped completely from databases!")
