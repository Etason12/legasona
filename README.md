# 🏎️ Legasona Importer — ERP for Vehicle & Spare Parts Dealerships

**Live demo:** [legasonaimporter.onrender.com](https://legasonaimporter.onrender.com)

Legasona Importer is a full-featured ERP system built for a family-run vehicle and spare parts import business in Ethiopia. It handles everything from inventory and sales to customer relationships, branch transfers, and financial reporting — all in one place.

> Developed by **Ataklti** 🇪🇹 · Powered by **Etacom Technologies**

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

The project is deployed on **Render** as a single Python web service
(`https://legasonaimporter.onrender.com`). The Flask app serves both the
`/api` endpoints **and** the built React frontend (from `frontend/dist/`) at
the root — so one URL is the whole app. `start.sh` auto-runs migrations and
starts Gunicorn on every deploy.

Database: PostgreSQL 16 (Render managed).

> Note: `render.yaml` also documents an *optional* static-site service
> (`legasona-frontend`) for hosting the frontend separately. It is not
> required — the API service already serves the app.

### 🔄 Rebuilding & deploying the frontend

The built frontend lives in **`frontend/dist/` and is committed to git** — the
server does **not** run `npm install` / `npm run build` during deploy. So
whenever you change frontend code, you **must** rebuild and commit `dist` or
the deployed app keeps serving the old bundle:

```bash
cd frontend
npm install
VITE_API_URL=https://legasonaimporter.onrender.com/api npm run build
cd ..
git add frontend/dist
git commit -m "build: rebuild frontend dist"
git push origin main
```

Render auto-deploys the API service on every push to `main` (including the
committed `dist`), so the new build goes live automatically — no dashboard
action needed. `frontend/dist/` is intentionally **not** gitignored so the
committed bundle stays in sync with the source.

To deploy your own fork, connect your GitHub repo to Render and use
`render.yaml` as the blueprint.

---

## 🤝 Contributing

This is a personal project, but feel free to open issues or suggest improvements. If you find it useful, a star on GitHub means a lot!

---

## 📄 License

MIT
