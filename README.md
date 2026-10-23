# Bulkhead | Smart-Home Security

Bulkhead is a comprehensive security management system for smart homes, providing visibility into IoT device inventories, automated risk auditing, and active network quarantine capabilities.

## 🚀 Tech Stack

### Backend
- **Language:** Python 3.10+
- **Framework:** FastAPI
- **Database:** SQLAlchemy (supports PostgreSQL and SQLite)
- **Security:** PyJWT, Passlib, Google OAuth 2.0
- **External APIs:** NIST National Vulnerability Database (NVD)

### Frontend
- **Language:** TypeScript
- **Framework:** React
- **Styling:** Tailwind CSS
- **Build Tool:** Vite

## 📁 Folder Structure

```text
.
├── backend/
│   ├── app.py                # API Entry point & Middleware
│   ├── bulkhead/            # Core Business Logic
│   │   ├── auth.py          # Identity & Session management
│   │   ├── households.py    # Home & Membership management
│   │   ├── inventory.py     # Device tracking & Audit findings
│   │   ├── policies.py      # Network policy & Simulation engine
│   │   ├── incidents.py     # Alert tracking & Response actions
│   │   ├── integrations.py  # NVD & Email notifications
│   │   ├── events.py        # WebSocket real-time streaming
│   │   └── gateway.py       # Agent enrollment & Quarantine control
│   ├── migrations/          # Database schema versioning
│   └── tests/               # Backend test suite
└── frontend/
    ├── index.html           # App entry point
    └── src/
        ├── components/      # Page views (Devices, Policies, HomeMap, etc.)
        ├── lib/             # API client & Session helpers
        └── styles/          # Tailwind & Custom CSS
```

## 🛠️ Build & Installation

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the server:
   ```bash
   python app.py
   ```
   The API will be available at `http://localhost:8000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Or build for production:
   ```bash
   npm run build
   ```

## ⚙️ Manual Configuration

To fully enable all features, the following setup is required:

1. **Google OAuth:** Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend configuration to enable social login.
2. **Database:** Apply migrations found in `backend/migrations/` to your database instance.
3. **Gateway Agent:** For real-world quarantine, ensure the `adapter_enabled` flag is set to `True` and a compatible Bulkhead Agent is enrolled on your OpenWRT router.
4. **NVD API:** It is recommended to provide an NVD API key in the settings to avoid rate limits during security scans.
