# Vision 2020 Conference Application — Meeting & Demo Guide

This document is a simple, jargon-free guide for the upcoming team meeting and live demonstration. It covers how users log in, how duplicates/roles are managed, and how to perform an end-to-end system demo.

---

## 📅 Meeting Agenda & Discussion Points

1. **Go-Live Readiness check**: Verify that the file submission portal is active and working.
2. **Scanner & On-Spot Lock**: Confirm that unregistered QR codes show "Invalid Card ❌" or "Registration Pending ❌" on scanners until the participant is fully onboarded.
3. **WhatsApp OTP Verification**: Align on credentials and check that OTP delivery is functional.
4. **Excel Data Import**: Finalize the list of participants and confirm all sessions are imported.
5. **On-Site Coordination Roles**: Clarify responsibilities for Registration Desk staff, Food Coordinators, and Track/Hall Coordinators.

---

## 🔐 Login Connections & Access (Simple Overview)

We have two main entry points for the application, designed to be as simple as possible.

### 1. Participant / Speaker Portal (OTP & PIN Access)
Designed so speakers can log in instantly without remembering complex passwords.
* **First-Time Setup**:
  1. The speaker enters their **registered email address**.
  2. The system checks their name and sends a **6-digit verification code (OTP)** to their **WhatsApp** (preferred), **SMS**, or **Email**.
  3. The speaker enters the code.
  4. The system prompts them to choose a **6-digit passcode (PIN)** (e.g., `123456`). In mobile and tablet devices, the **number keypad** will automatically open so it is easy to type.
* **Subsequent Logins**:
  1. The speaker enters their email.
  2. The system prompts them for their chosen **6-digit PIN** directly. (If they forget, they can always request a new OTP code to reset it).
* **What they see**: A clean dashboard showing their custom presentation schedule (Date, Time, Hall, Track) and buttons to upload/verify their files.

### 2. Staff & Coordinators Portal (ID & Password Access)
Designed for the organizing team and staff members.
* **Credentials**: Log in using their **Employee ID** and a secure **Password**.
* **Roles & Permissions**:
  * **Super Admin & Admin**: Full system control. Can view all statistics, manage user accounts, update settings, search and download files (individual or bulk ZIP downloads), and run all scanners.
  * **Track Coordinator**: Assigned to specific tracks (e.g., Track 1, Track 2). Can view schedules, upload/delete files for speakers in their track, and monitor submissions.
  * **Food Coordinator**: Accesses the food scanning system to verify participant check-ins and issue coupons.
  * **Scientific Committee**: Reviews all presentation uploads and handles bulk downloads.

---

## 👥 Handling Duplicate Profiles & Multiple Roles

It is common for some presenters to have multiple speaking slots, or for their names to appear multiple times in registration lists. Here is how we handle it:

### 1. The Duplicate Merging Strategy
When we import participants from Excel or when the database is cleaned:
* The system looks at the **Name** and **Institution** (School/Hospital/Foundation).
* It uses a similarity formula to check if the names and institutions are basically the same (even with slight spelling differences or abbreviations like "Hospital" vs "Hosp").
* If there is no conflict in contact info (emails/phone numbers match or are empty), the system **merges** them.
* **Result**: The duplicate entries are removed, and only **one** master participant profile is kept.

### 2. Supporting Multiple Roles
* By keeping only **one** participant profile, the participant gets:
  * **One registration number**.
  * **One physical ID card / QR code**.
  * **One set of lunch/dinner tokens** (so they can't claim food multiple times).
* However, that single participant can have **multiple speaking/moderating roles** assigned to them.
* **Result**: On their dashboard, they will see a list of all their speaking assignments (e.g., *Speaker* on Day 1 at Hall A, and *Chairperson* on Day 2 at Hall B) and can upload separate PPTX files for each speaking assignment.

---

## 🖥️ End-to-End Live Demonstration Checklist

To demonstrate that the application is fully working, run through the following scenario steps:

### Phase 1: Unassigned Card Security
1. Take an **unassigned QR code** (a blank card that hasn't been linked to any participant yet).
2. Go to the **Attendance Scanner** or **Food Scanner** screen on a mobile/desktop device.
3. Scan the QR code.
4. **Expectation**: The scanner immediately rejects it and displays: **`❌ Invalid Card`**.
5. Log into the Registration Desk portal, take that blank QR code, scan it, and choose to link/register it to a new participant (*On-Spot Registration*).
6. Try to scan the card on the scanner *before* completing the registration details.
7. **Expectation**: The scanner rejects it and displays: **`❌ Registration Pending`**.

### Phase 2: On-Spot Onboarding
1. At the Registration Desk, complete the details for the new participant (Name, Email, Mobile, Institution).
2. Submit the form to link their QR code.
3. **Expectation**: The participant profile is created, and they are now active in the database.

### Phase 3: Speaker Login & Upload
1. Open the **Presenter Portal** (or log out and go to the submission screen).
2. Enter the registered email address of the participant you just registered.
3. Select **WhatsApp** to receive the OTP.
4. **Expectation**: The system sends a WhatsApp notification with the 6-digit OTP code.
5. Enter the OTP code, verify it, and set a **6-digit PIN** (e.g., `999888`). Notice that on mobile, the numeric keyboard opens automatically.
6. Once logged in, view the schedule.
7. Attempt to upload a poster or presentation slide:
   * Select a `.pptx` file under 15MB -> **Success**.
   * Try to select a `.pdf` or a file over 15MB -> **Expectation**: The system blocks the upload with an error message.
8. Submit the files. A confirmation screen appears showing a unique reference number.

### Phase 4: Event Day Scanning (Attendance & Food)
1. Go back to the **Attendance Scanner** screen.
2. Scan the participant's QR code.
3. **Expectation**: The screen highlights green and shows: **`Check-in Successful ✓`** (no manual refresh needed, popup auto-closes in 2 seconds).
4. Try to scan the same QR code a second time.
5. **Expectation**: The screen displays: **`Already Checked-in ⚠️`** (no manual refresh needed).
6. Go to the **Food Coordinator Dashboard**.
7. Scan the QR code.
8. **Expectation**: The screen shows **`Food Coupon Issued ✓`** (highlighting paid/unpaid or sponsored flags as needed). Try scanning a second time to verify it prevents double-claiming.

---

## 🔍 Step-by-Step Demo Checklist: Attenders Login Flow
Use this guide to demonstrate the attendee login flow and show how secure, simple, and mobile-friendly it is.

### 1. Verification Step (Look Up)
* [ ] **What to do**: Go to the Presenter Portal and enter a test attendee's registered email address.
* [ ] **What to point out**: The system does not show complex registration IDs or require a pre-set password. The lookup is instant and hides sensitive details (masked email and phone number appear for privacy).

### 2. Multi-Channel OTP Selection
* [ ] **What to do**: Show the channel selector (WhatsApp, SMS, Email). Click **Send OTP**.
* [ ] **What to point out**: If WhatsApp is selected, explain that the message is delivered via Meta's Business APIs. If the participant doesn't have WhatsApp, they can choose SMS or Email.

### 3. OTP Code Input & 6-Digit Passcode Setup
* [ ] **What to do**: Enter the 6-digit OTP code received. On the next screen, enter a new 6-digit passcode (PIN) twice to save it.
* [ ] **What to point out**: 
  * Show the clean PIN boxes.
  * *On mobile*: Highlight that the screen automatically triggers a **numeric keypad** (number pad) instead of a standard text keyboard.
  * Explain that setting a PIN is a one-time step. In the future, the attendee can log in immediately using this PIN without waiting for OTPs.

### 4. Direct Passcode Login (Subsequent Logins)
* [ ] **What to do**: Log out of the session, enter the same email, and enter the newly set 6-digit PIN.
* [ ] **What to point out**: Show how the attendee enters the portal in under 5 seconds without waiting for any verification messages.

---

## 🔍 Step-by-Step Demo Checklist: Submissions & Upload Flow
Use this guide to demonstrate the presentation schedule review and the robust slide/poster submission logic.

### 1. View Personal Schedule
* [ ] **What to do**: Point to the schedule grid displayed upon login.
* [ ] **What to point out**:
  * Show how the participant can see their specific Date, Time, Hall (A or B), and Track.
  * Point out the status indicators: **Pending Upload** (orange highlight) or **File Submitted** (green checkmark).

### 2. Edit Presentation Title
* [ ] **What to do**: Click the edit pencil icon next to the presentation title, change the title, and save.
* [ ] **What to point out**: The speaker can finalize or correct their presentation topic up until the deadline without needing to request coordinator assistance.

### 3. Test File Limits (Strict Error Handling Demo)
Show them that the system actively blocks incorrect file formats and sizes to ensure high quality and prevent server storage overflow:
* [ ] **Test 1: Wrong Format (PPTX Validation)**
  * *What to do*: Under Presentation Slides, try uploading a `.pdf` or a `.png` file.
  * *Expectation*: The system pops up a red warning: *“Invalid File Format: Presenters must upload .pptx presentation slides only.”*
* [ ] **Test 2: Large PPTX Size Validation**
  * *What to do*: Under Presentation Slides, try uploading a PPTX file larger than 15 MB (e.g., 18 MB).
  * *Expectation*: The system blocks the upload and shows: *“File Too Large: Presentation slides must be under 15 MB.”*
* [ ] **Test 3: Wrong Format (Poster Validation)**
  * *What to do*: Under Poster Image, try uploading a `.pptx` or a `.png` file.
  * *Expectation*: The system blocks the upload: *“Invalid File Format: Poster presenters must upload .jpg or .jpeg images only.”*
* [ ] **Test 4: Large Poster Size Validation**
  * *What to do*: Under Poster Image, try uploading a JPG file larger than 20 MB (e.g., 22 MB).
  * *Expectation*: The system blocks the upload: *“File Too Large: Poster JPG images must be under 20 MB.”*

### 4. Valid Upload & Review
* [ ] **What to do**: Select a valid `.pptx` file (under 15 MB) and a valid `.jpg` image (under 20 MB). Type a short message in the "Message for Secretariat" box. Click **Review Submission**.
* [ ] **What to point out**: Point to the review summary card. Explain that the files are automatically renamed behind the scenes to follow conference standards (naming format: `Date_Track_Session_Time_Role_RegNo_Version`), avoiding manual naming mistakes.

### 5. Final Submission & Reference Code
* [ ] **What to do**: Click **Submit Files**.
* [ ] **What to point out**: Point to the final screen showing the unique reference code (e.g., `V2020-123456`) which confirms the files have been locked in successfully.

---

## ⚙️ Pre-Demo Preparation Steps
Before starting your live demonstration, make sure you have the following ready to ensure everything runs smoothly:

1. **Test Accounts Ready**:
   - Ensure you have a test participant profile set up in the database with a known test email and mobile number (where you can receive WhatsApp or Email OTPs in real-time).
   - Ensure this test participant is assigned a presentation role (e.g., "Presenter") and a poster role (e.g., "Poster") so you can demo both upload sections.
2. **Demo Files Ready**:
   - Prepare a **valid `.pptx` file** (e.g., 2 MB).
   - Prepare an **oversized `.pptx` file** (e.g., 16 MB or larger).
   - Prepare a **valid `.jpg` image** (e.g., 1 MB).
   - Prepare an **oversized `.jpg` image** (e.g., 21 MB or larger).
   - Prepare an **incorrect format file** (e.g., a `.pdf` or `.png` file).
3. **Blank QR Code**:
   - Have a printable or screen-scannable QR code that represents a blank/unlinked card (e.g., containing an unassigned serial like `ONSPOT-999`) to show the unassigned card scanning rejection flow.
4. **Environment Check**:
   - Verify that your local API server and database are running.
   - Verify your internet connectivity (required for WhatsApp/Email OTP dispatching).
   - If demoing on a mobile device, make sure your mobile device is connected to the same local network or staging URL.
