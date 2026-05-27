# 🏎️ Legasona Importer — ERP for Vehicle & Spare Parts Dealerships

**Live demo:** [legasonaimporter.onrender.com](https://legasonaimporter.onrender.com)

Legasona Importer is a full-featured ERP system built for a family-run vehicle and spare parts import business in Ethiopia. It handles everything from inventory and sales to customer relationships, branch transfers, and financial reporting — all in one place.

> Built with love by **Etason12** 🇪🇹

---

## ✨ What It Does

- **Inventory Management** — Track vehicles (2-wheel, 3-wheel, 4-wheel, electric) and spare parts with stock quantities, pricing, and images.
- **Point-of-Sale** — Record sales for vehicles and spare parts, accept payments (cash / bank transfer), print receipts, and generate PDF invoices.
- **Customer CRM** — Maintain a customer database with full purchase history, loyalty points, and credit limits. View every vehicle or part a customer has ever bought.
- **Order Queue** — Manage customer deposit orders (waiting → fulfilled → cancelled) with Cash/Bank deposit tracking.
- **Stock Transfers** — Move inventory between branches with multi-level approval workflow.
- **Purchasing** — Log supplier purchases with cost tracking and receipt attachments.
- **Expense Tracking** — Categorize and approve operational expenses.
- **Reports & Dashboard** — Visual dashboards with charts, Excel and PDF export, date-range filtering, and formatted number output.
- **Multi-Branch Support** — Operate multiple locations with per-branch inventory, users, and budgets.
- **Role-Based Access** — Admin, Manager, Sales, Storeman, Accountant — each with tailored permissions.
- **Dark Mode** — Easy on the eyes, everywhere.
- **Amharic 🇪🇹** — Full Amharic translation for local users.

---

## 🧰 Built With

| Layer | Tech |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Recharts, Lucide Icons |
| **Backend** | Python 3, Flask, SQLAlchemy, Flask-Migrate, JWT Auth |
| **Database** | PostgreSQL 16 (production), SQLite (development) |
| **Mobile** | Capacitor 8 (Android APK support) |
| **Deployment** | Render (2 services: Python API + static site) |
| **Other** | jsPDF, xlsx (Excel), QR code generation, PDF invoice printing |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (or stick with SQLite for local dev)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
flask db upgrade
python run.py
```

The API starts at `http://localhost:5000`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The UI starts at `http://localhost:5173` and automatically talks to the backend.

### Default Login

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |

---

## 🗂️ Project Structure

```
legasona/
├── backend/
│   ├── app/
│   │   ├── __init__.py         # App factory, blueprint registration
│   │   ├── models.py           # All database models
│   │   ├── routes/             # API route blueprints (14 modules)
│   │   ├── utils/              # Auth helpers, role decorators
│   │   └── templates/
│   ├── migrations/             # Alembic schema migrations
│   ├── requirements.txt
│   ├── run.py                  # Entry point
│   └── start.sh                # Production startup script
├── frontend/
│   ├── src/
│   │   ├── pages/              # All page components
│   │   ├── components/         # Shared components
│   │   ├── services/           # API client, export helpers
│   │   ├── i18n/               # English + Amharic translations
│   │   └── utils/              # Role checks, formatters
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── render.yaml                 # Render deployment config
└── README.md                   # You are here ✌️
```

---

## 🌐 Deployment

The project is deployed on **Render** with two services:

1. **`legasona-api`** — Python web service, runs `start.sh` (auto-migrates + starts Gunicorn)
2. **`legasona-frontend`** — Static site, serves the built React app with SPA rewrite rules

Database: PostgreSQL 16 (Render managed).

To deploy your own fork, connect your GitHub repo to Render and use `render.yaml` as the blueprint.

---

## 🤝 Contributing

This is a personal project, but feel free to open issues or suggest improvements. If you find it useful, a star on GitHub means a lot!

---

## 📄 License

MIT
