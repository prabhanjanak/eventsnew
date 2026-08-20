# Google Wallet Event Tickets Integration Guide

This document outlines the complete setup and architecture for generating official **Google Wallet Event Tickets** in the Sankara Events platform.

---

## 1. Architecture Overview

```text
Attendee Registration (PostgreSQL `participants`)
                  ↓
   Canonical Registration Number (e.g. CONF26-0001)
                  ↓
   Canonical QR Check-in URL (https://events.sankaraeye.in/q/CONF26-0001)
                  ↓
   Google Wallet Event Ticket Class (`{ISSUER_ID}.event_{eventId}_{slug}`)
                  ↓
   Google Wallet Event Ticket Object (`{ISSUER_ID}.event_{eventId}_{registrationNumber}`)
                  ↓
   Signed JWT Save Link (RS256 with Google Service Account)
                  ↓
   "Add to Google Wallet" Button in Pass & Confirmation Pages
```

---

## 2. Environment Variables Configuration

Add the following environment variables to your `.env` file (these are separate from Google OAuth Sign-In credentials):

```env
# ── Google Wallet API Credentials (Separate from Google Sign-In) ─────────
GOOGLE_WALLET_ISSUER_ID=3388000000022345678
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=sankara-wallet@sankara-events.iam.gserviceaccount.com
GOOGLE_WALLET_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

> [!IMPORTANT]
> The `GOOGLE_WALLET_PRIVATE_KEY` must include the header `-----BEGIN RSA PRIVATE KEY-----` and footer `-----END RSA PRIVATE KEY-----`. If storing as a single line, use `\n` to escape line breaks.

---

## 3. Google Cloud & Google Pay / Wallet Console Setup (Step-by-Step)

### Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `sankara-events-platform`) or select your existing project.

### Step 2: Enable the Google Wallet API
1. In Google Cloud Console, navigate to **APIs & Services > Library**.
2. Search for **Google Wallet API** and click **Enable**.

### Step 3: Create a Service Account
1. Go to **IAM & Admin > Service Accounts**.
2. Click **Create Service Account**.
   - Name: `sankara-wallet-issuer`
   - Description: Service account for signing Google Wallet event passes.
3. Click **Create and Continue**, then click **Done**.
4. Copy the service account email (e.g., `sankara-wallet-issuer@sankara-events-platform.iam.gserviceaccount.com`). This is your `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`.

### Step 4: Generate Service Account Private Key
1. Click on the created service account to open its details.
2. Go to the **Keys** tab -> Click **Add Key > Create new key**.
3. Select **JSON** format and click **Create**.
4. Open the downloaded JSON file:
   - Extract the `private_key` field value and set it as `GOOGLE_WALLET_PRIVATE_KEY` in `.env`.

### Step 5: Set Up Google Pay & Wallet Business Console
1. Navigate to the [Google Pay & Wallet Business Console](https://pay.google.com/business/console/).
2. Sign in with your organization's Google account and complete the business profile.
3. Go to the **Google Wallet** tab.
4. Under **Issuers**, copy your numeric **Issuer ID** (e.g., `3388000000022345678`). This is your `GOOGLE_WALLET_ISSUER_ID`.
5. Under **Users / Permissions** in the Wallet Console, click **Add User** and invite your Service Account email with **Developer** or **Admin** access.

---

## 4. API Endpoints Reference

### Generate Google Wallet Pass
- **Method**: `GET /api/wallet/google/:registrationId`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **URL Parameter**: `registrationId` (either participant DB `id` or `registrationNumber`, e.g. `CONF26-0001`).
- **Response**:
```json
{
  "success": true,
  "saveUrl": "https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiIs...",
  "classId": "3388000000022345678.event_1_conference_2026",
  "objectId": "3388000000022345678.event_1_CONF26-0001"
}
```

---

## 5. Scanner & Barcode Interoperability

The Google Wallet barcode uses the exact same QR identity as the physical and web passes:
- **Type**: `QR_CODE`
- **Value**: `https://events.sankaraeye.in/q/{registrationNumber}`
- **Alternative Text**: `{registrationNumber}`

Existing scanners (`/admin/attendance-scanner`, `/admin/food-scanner`, and the `/q/:regNumber` smart landing page) seamlessly read Google Wallet passes with zero configuration changes.
