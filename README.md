# Vision 2020 Conference Management & Submission Portal

Welcome to the official repository for the **Vision 2020 Conference Application**, designed and built for the **Sri Kanchi Kamakoti Medical Trust (SKKMT) / Sankara Eye Hospital**.

This project is a full-featured, secure monorepo application developed to handle attendee registrations, presenter logins, scientific paper/poster file uploads, and physical on-site QR/barcode check-ins for attendance and catering management.

---

## 🚀 Key System Features

### 🔐 1. Simple, Jargon-Free Login Gateways
* **Speaker & Presenter Portal (OTP/PIN-based)**:
  * Fast identification using the registered email.
  * Secure 6-digit OTP delivery integrated via **WhatsApp API**, **SMS**, or **Email**.
  * Simple 6-digit passcode (PIN) configuration on first login.
  * Device-friendly numeric keyboard activation on tablets and smartphones.
* **Staff & Coordinator Gateways**:
  * Role-based access control (Admin, Super Admin, Track Coordinator, Food Coordinator).
  * Secure Employee ID (Emp ID) and password login.

### 📄 2. Scientific Submission & Upload Portal
* Strict validation rules:
  * **Presentation Slides**: PPTX format only, max size **15 MB**.
  * **Poster Slides**: JPG/JPEG format only, max size **20 MB**.
* Backend auto-sanitization and file renaming according to conference scheduling templates: `Date_Track_Session_Time_Role_RegNo_Version.ext`.
* Support for bulk downloads in structured ZIP folders categorized by date, track, session, and time for AV console use.

### 👥 3. Advanced Duplicate Resolving & Role Handling
* Automated import script that scans spelling variations in Names and Institutions (e.g., "Hosp" vs "Hospital", "Inst" vs "Institute") using Levenshtein distance similarity.
* Merges redundant attendee list inputs into **one unified physical profile** (so they receive exactly one badge and food token).
* Correctly maps and links **multiple roles/sessions** (e.g., Chair on Day 1, Speaker on Day 2) to that single physical participant's schedule dashboard.

### 🎟️ 4. Attendance & Catering Coordinator Scanners
* Instant QR code scanning using device cameras or hardware barcode gun scans.
* **On-Spot Locking**: Rejects unassigned QR codes (`❌ Invalid Card`) and non-onboarded cards (`❌ Registration Pending`) to prevent unauthorized check-ins.
* Seamless check-in transitions: updates in real-time without manual screen refreshes, closing success dialog overlays automatically within 2 seconds.
* Built-in security: prevents double check-ins and detects already claimed food coupons.

---

## 📁 Repository Architecture

This project is organized as a monorepo workspace managed via `pnpm`:

```
vision2020-project/
├── artifacts/
│   ├── api-server/        # Express.js & TypeScript Backend API
│   │   ├── src/routes/    # API endpoints (auth, files, scan, food, goodies)
│   │   └── src/lib/       # Shared server utility libraries (mailer, whatsapp)
│   ├── vision2020/        # React, Vite, TailwindCSS & TypeScript Frontend App
│   │   └── src/pages/     # App pages (scanners, submission portal, dashboards)
│   └── mockup-sandbox/    # Mockups and dev prototypes
├── lib/
│   ├── db/                # Drizzle ORM schemas, database migrations, and queries
│   ├── api-zod/           # Zod validation schemas shared between frontend and backend
│   └── api-client-react/  # Auto-generated React API query client
├── scripts/               # Administrative tools, cleaning, and excel import scripts
└── meeting_notes.md       # Pre-demo and meeting outline documentation
```

---

## 🛠️ Tech Stack

* **Frontend**: React, TypeScript, TailwindCSS, Vite, Wouter (Routing), Lucide React (Icons).
* **Backend**: Node.js, Express, TypeScript, Multer (Upload handling), Pino (Logging).
* **Database**: PostgreSQL / SQLite powered by Drizzle ORM.
* **Integrations**: Meta WhatsApp Business Cloud Graph API, Nodemailer SMTP.

---

## ⚙️ Local Development Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **pnpm**: `v9.x` or higher

### 1. Install Dependencies
Run the following command at the root directory to install dependencies across the workspace:
```bash
pnpm install
```

### 2. Environment Configurations
Create a `.env` file in the root workspace folder based on `.env.example`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/vision2020
WHATSAPP_TOKEN=your-meta-whatsapp-token
WHATSAPP_PHONE_ID=your-whatsapp-phone-id
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
JWT_SECRET=your-secure-jwt-key
```

### 3. Database Seeding & Setup
Generate migrations and run the spreadsheet import script to load participant schedules:
```bash
# Apply schemas and migrate database
pnpm --filter "@workspace/db" run push

# Seed details, admins, food sessions, and roles from the Excel spreadsheet
pnpm --filter "scripts" run seed
```

### 4. Running the Applications
To run both the API server and the frontend client simultaneously in development mode, run:
```powershell
./START-APP.ps1
```
*Alternatively, run them separately in their folders:*
```bash
# In artifacts/api-server
pnpm run dev

# In artifacts/vision2020
pnpm run dev
```
* **Frontend Access**: `http://localhost:3000`
* **Backend API Access**: `http://localhost:5000`

### 5. Running Code Typechecks
Ensure absolute type safety across all libraries and applications prior to commits:
```bash
pnpm run typecheck
```
