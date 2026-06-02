"""
One-time script: assign customers with NULL branch_id to a default branch.

Usage:
  python assign_customer_branches.py

Edit DEFAULT_BRANCH_ID below to your preferred branch.
"""

import sqlite3
import os

DEFAULT_BRANCH_ID = 2  # Mekelle

DB_PATH = os.path.join(os.path.dirname(__file__), 'backend', 'instance', 'dealership.db')

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id, full_name, branch_id FROM customers WHERE branch_id IS NULL")
    unassigned = cur.fetchall()

    print(f"Found {len(unassigned)} customers with NULL branch_id")

    if unassigned:
        for row in unassigned[:10]:
            print(f"  ID={row[0]}  name={row[1]}")
        if len(unassigned) > 10:
            print(f"  ... and {len(unassigned) - 10} more")

        cur.execute("UPDATE customers SET branch_id = ? WHERE branch_id IS NULL", (DEFAULT_BRANCH_ID,))
        conn.commit()
        print(f"Assigned {cur.rowcount} customers to branch_id={DEFAULT_BRANCH_ID}")

    conn.close()

if __name__ == '__main__':
    main()
