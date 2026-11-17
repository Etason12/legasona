"""Import vehicles from Legasona_27_S2_Vehicle_Import.xlsx into Railway production DB.

Usage (PowerShell):
    $env:DATABASE_URL = "postgresql://postgres:PASSWORD@HOST:5432/railway"
    python backend/import_vehicles_railway.py

The script is idempotent: rows whose VIN already exists are skipped.
"""
import os
import sys
from datetime import datetime, timezone

import openpyxl
from sqlalchemy import create_engine, text

EXCEL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'Legasona_27_S2_Vehicle_Import.xlsx')
)


def normalize_type(value):
    s = str(value or '').strip()
    mapping = {'3-WHEEL': '3-wheel', '2-WHEEL': '2-wheel', '4-WHEEL': '4-wheel'}
    return mapping.get(s.upper(), s.lower() if s else None)


def normalize_power(value):
    s = str(value or '').strip().lower()
    if s in ('electric', 'e', 'ev'):
        return 'electric'
    if s in ('non-electric', 'nonelectric', 'non electric', 'petrol', 'diesel', 'ice'):
        return 'non-electric'
    return s or None


def normalize_status(value):
    s = str(value or '').strip().lower()
    mapping = {
        'available': 'available', 'sold': 'sold', 'reserved': 'reserved',
        'in-transit': 'in-transit', 'in transit': 'in-transit',
    }
    return mapping.get(s, s or 'available')


def main():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print('ERROR: DATABASE_URL environment variable not set.')
        print('Set it to your Railway PostgreSQL connection string and re-run.')
        sys.exit(1)

    # SQLAlchemy needs postgresql:// (not postgres://)
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)

    # Strip any trailing garbage (e.g. ", postgresql")
    database_url = database_url.split(',')[0].strip()

    engine = create_engine(database_url)

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(min_row=2, values_only=True))

    added = 0
    skipped = 0
    now = datetime.now(timezone.utc).isoformat()

    with engine.begin() as conn:
        res = conn.execute(text("SELECT id FROM branches WHERE name = 'Mekelle'")).fetchone()
        if not res:
            print("ERROR: Mekelle branch not found in production branches table.")
            sys.exit(1)
        mekelle_id = res[0]

        existing = {r[0] for r in conn.execute(text('SELECT vin FROM vehicles')).fetchall()}

        for row in rows:
            if not row or all(c is None for c in row):
                continue
            s_n, model, vin, specification, color, op_status, body_class, propulsion, selling_price = row
            if not vin:
                skipped += 1
                continue
            vin = str(vin).strip().upper()[:17]
            if vin in existing:
                skipped += 1
                continue

            conn.execute(text("""
                INSERT INTO vehicles
                (vin, type, power_type, model, color, chassis_number, engine_number,
                 cost_price, selling_price, branch_id, status, received_date, image)
                VALUES (:vin, :type, :power_type, :model, :color, :chassis_number, :engine_number,
                        :cost_price, :selling_price, :branch_id, :status, :received_date, :image)
            """), {
                'vin': vin,
                'type': normalize_type(body_class),
                'power_type': normalize_power(propulsion),
                'model': str(model).strip()[:100] if model else None,
                'color': str(color).strip()[:50] if color else None,
                'chassis_number': str(specification).strip()[:50] if specification else None,
                'engine_number': None,
                'cost_price': None,
                'selling_price': float(selling_price) if selling_price not in (None, '') else 0.0,
                'branch_id': mekelle_id,
                'status': normalize_status(op_status),
                'received_date': now,
                'image': None,
            })
            existing.add(vin)
            added += 1

        total = conn.execute(
            text('SELECT count(*) FROM vehicles WHERE branch_id = :bid'),
            {'bid': mekelle_id}
        ).scalar()

    print(f"Imported {added} vehicles to Mekelle (branch id={mekelle_id}); "
          f"{skipped} skipped (missing VIN or already exist).")
    print(f"Total vehicles now at Mekelle (production): {total}")


if __name__ == '__main__':
    main()
