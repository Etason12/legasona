"""Import spare parts from the final_list.pdf into the database."""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.models import SparePart, db
from config import Config


def generate_sku():
    return f"SP-{int(time.time() * 1000) % 1000000:06d}"


PARTS = [
    # (name_tigrinya, name, quantity, category)
    ('ቅድመት መብራህቲ ከቨር ናይ ፀጋም', 'Left Front Light Cover', 6, 'Lighting & Exterior'),
    ('ቅድመት መብራህቲ ከቨር ናይ የማን', 'Right Front Light Cover', 7, 'Lighting & Exterior'),
    ('ማእኸል ከቨር', 'Center Cover', 6, 'Body & Exterior'),
    ('አንቴና', 'Antenna', 20, 'Audio & Electronics'),
    ('ናይ ድሕሪት ጡሩንባ', 'Rear Horn', 4, 'Horn & Electrical'),
    ('H & L እጀታ', 'High/Low Beam Switch', 4, 'Lighting & Electrical'),
    ('R & D እጀታ', 'R & D Handle / Reverse & Drive Lever', 4, 'Controls & Transmission'),
    ('ስቶፕ ላይት ኬብል', 'Stop Light Cable', 4, 'Lighting & Electrical'),
    ('ክላክስ', 'Horn', 8, 'Horn & Electrical'),
    ('ኣቸራተር', 'Accelerator', 7, 'Engine Controls'),
    ('ኣሞርዛተር', 'Shock Absorber', 6, 'Suspension'),
    ('ዓብይ ሪለይ', 'Large Relay', 4, 'Electrical & Relays'),
    ('3555 ኩችኔት ሲል/seal/', 'Bearing Seal 3555', 6, 'Bearings & Seals'),
    ('248080 ኩችኔት ሲል/seal/', 'Bearing Seal 248080', 7, 'Bearings & Seals'),
    ('ሞሶ', 'Spring', 0, 'Suspension'),
    ('ቤሪንግ ዓብይ 355520', 'Large Bearing 355520', 13, 'Bearings'),
    ('መሪ ቤሪንግ ናይ ታሕቲ', 'Lower Steering Bearing', 13, 'Steering & Bearings'),
    ('6304 RS ቤሪንግ', '6304 RS Bearing', 13, 'Bearings'),
    ('6006 ቤሪንግ', '6006 Bearing', 13, 'Bearings'),
    ('ዋንጫ መሪ ቤሪንግ ናይ ላዕሊ', 'Upper Steering Bearing Cup', 41, 'Steering & Bearings'),
    ('ፍሬን ሻራ ናይ ቅድሚት', 'Front Brake Shoe', 8, 'Braking System'),
    ('ፒስተንቺኒ ናይ ቅድሚት', 'Front Brake Wheel Cylinder', 28, 'Braking System'),
    ('እስሚያስ ናይ ቅድሚት', 'Front Half Shaft', 13, 'Drivetrain & Axles'),
    ('ሸራ ናይ ድሕሪት', 'Rear Brake Shoe', 52, 'Braking System'),
    ('complete ናይ ድሕሪት ፍሬን ሸራ', 'Complete Rear Brake Shoe Set', 4, 'Braking System'),
    ('ስፕሪንግ ናይ ፍሬን ሸራ', 'Brake Shoe Spring', 27, 'Braking System'),
    ('ጎሚኒ ᣝሞርዛቶር', 'Shock Absorber Rubber', 11, 'Suspension'),
    ('Radio', 'Radio', 11, 'Audio & Electronics'),
    ('wiper ጎማ', 'Wiper Rubber', 7, 'Wipers & Exterior'),
    ('ኳድሮ ቁልፊ', 'Quadro Key / Ignition Switch Key Set', 4, 'Ignition & Electrical'),
    ('ስፒከር', 'Speaker', 11, 'Audio & Electronics'),
    ('እጂ ፍሬን ካቦ', 'Hand Brake Cable', 4, 'Braking System'),
    ('እግሪ ፍሬን ካቦ', 'Foot Brake Cable', 4, 'Braking System'),
    ('ብሮንዝ ሃይድሮሊክ', 'Hydraulic Bronze Bushing', 4, 'Hydraulics & Bushings'),
    ('ብሮንዝ ናይ ቅድሚት', 'Front Bronze Bushing', 7, 'Suspension & Bushings'),
    ('ብሬክ ናይ ድሕሪት', 'Rear Brake Assembly', 4, 'Braking System'),
    ('ኣክዝል', 'Axle', 3, 'Drivetrain & Axles'),
    ('ኣንግል ሆዝ', 'Angle Hose', 4, 'Hoses & Hydraulics'),
    ('Complete ናይ ቅድሚት ፍሬን ሸራ', 'Complete Front Brake Shoe Set', 4, 'Braking System'),
    ('ባውዛ ብፅምዲ', 'Pair of Bushings', 4, 'Suspension & Bushings'),
    ('ሙሉእ እጅ ፍሬን ብረት', 'Complete Hand Brake Metal Assembly', 6, 'Braking System'),
    ('ፍሬቻ ናይ ድሕሪት', 'Rear Turn Signal', 7, 'Lighting & Signals'),
    ('ማስተር ሲሊንደር', 'Master Cylinder', 4, 'Braking System'),
    ('ስፖክዮ', 'Side Mirror', 4, 'Mirrors & Exterior'),
    ('ዲስፕለይ /Dispay/', 'Display Unit', 4, 'Electronics'),
    ('ፍዩዝ 20A', 'Fuse 20A', 29, 'Fuses & Electrical'),
    ('ፒስተንቺኒ ናይ ድሕሪት', 'Rear Brake Wheel Cylinder', 13, 'Braking System'),
    ('ፍዩዝ 5A', 'Fuse 5A', 28, 'Fuses & Electrical'),
    ('ፍዩዝ 10A', 'Fuse 10A', 28, 'Fuses & Electrical'),
]


def seed():
    app = create_app(Config)
    with app.app_context():
        existing = {p.name for p in SparePart.query.all()}
        added = 0
        for name_tigrinya, name, qty, category in PARTS:
            if name in existing:
                continue
            p = SparePart(
                part_number=generate_sku(),
                name=name,
                name_tigrinya=name_tigrinya,
                category=category,
                quantity=qty,
                unit_price=2000,
                cost_price=2000,
                branch_id=1,
            )
            db.session.add(p)
            added += 1
        db.session.commit()
        print(f"Imported {added} spare parts ({len(PARTS) - added} already existed)")


if __name__ == '__main__':
    seed()
