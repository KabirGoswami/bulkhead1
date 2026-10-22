# 🛡️ Bulkhead: Smart-Home Security Demo

Bulkhead is a conceptual smart-home security application designed to prevent "Unauthorized Access to Connected Devices." It operates on the principle that a single compromised IoT device should not become a gateway to the rest of the home.

## 🚀 Core Features

- **Access Health Audit**: Automatically scans for weak credentials, outdated firmware, and flat network placement.
- **Blast Radius Visualization**: Interactive graph showing how a compromise spreads via network zones and shared accounts.
- **Behavioral Detection**: Learns a "normal" baseline for every device and flags anomalies (Volume Spikes, Lateral Movement, Geo-Anomalies).
- **Autonomy Ladder**: Tiered response policy:
    - **Auto-Contain**: Immediate isolation for low-risk devices.
    - **User Confirmation**: Human-in-the-loop for high-criticality devices (Locks, Cameras).
    - **Notify Only**: Safety-critical devices (Thermostats) are never auto-isolated.
- **Attack Simulator**: One-click scenarios to test the system against realistic attack patterns.

---

## 🛠 Tech Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **Server**: Uvicorn
- **State**: In-memory (No DB for demo speed)
- **Logic**: BFS for reachability, NumPy for behavioral z-score detection.
- **Communication**: WebSockets for live event streaming.

### Frontend
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Visualization**: React Flow (for the Home Map)
- **Icons**: Lucide-React

---

## 📦 Build & Run Instructions

### Prerequisites
- Python 3.11+
- Node.js (v18+) & npm

### 1. Setup Backend
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install fastapi uvicorn pydantic numpy

# Start the server
python app.py
```
The backend will be available at: `http://localhost:8000`

### 2. Setup Frontend
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
The frontend will typically be available at: `http://localhost:5173`

---

## 🧪 Testing the Scenarios

Once the app is running, navigate to the **Simulation Control** panel at the bottom of the map:

1. **Scenario A (Compromised Plug)**: Watch a low-criticality device spike in traffic and attempt lateral movement. It should be **Auto-Contained**.
2. **Scenario B (Stolen Credentials)**: See a login from an unusual location. Because this affects the Smart Lock, it will require **User Confirmation**.
3. **Scenario C (Benign Update)**: A volume spike from a verified vendor. The system should identify this as benign and **not trigger containment**.

---

## 🌐 How this maps to real data
In a production environment, the `FlowEvent` and `AuthEvent` streams would be fed by:
- **Router Logs**: NetFlow/sFlow data from the home gateway.
- **Hub APIs**: Event logs from smart home hubs (Home Assistant, Hubitat).
- **Cloud Webhooks**: Auth logs from vendor clouds (Google, Amazon, Apple).

## ⚠️ Limitations
This is a **simulation**. The "containment" actions mutate a virtual state rather than modifying real firewall rules or API permissions.
