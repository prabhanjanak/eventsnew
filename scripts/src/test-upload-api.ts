import { db, participantsTable, assignmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function testUpload() {
  console.log("Starting upload test...");

  // 1. Get participant Rajesh Kumar
  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.registrationNumber, "V2020-00001"));
  if (!participant) {
    throw new Error("Dr. Rajesh Kumar not found in database.");
  }

  // 2. Get assignment
  const [assignment] = await db
    .select()
    .from(assignmentsTable)
    .where(eq(assignmentsTable.participantId, participant.id));
  if (!assignment) {
    throw new Error("Assignment not found for Dr. Rajesh Kumar.");
  }

  console.log("Participant:", participant.name);
  console.log("Assignment:", assignment.role, assignment.track, assignment.sessionName, assignment.time);

  // 3. Login via API to get token
  const loginResp = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "V2020-00001",
      password: "Test@1234",
      userType: "participant"
    })
  });

  if (!loginResp.ok) {
    const text = await loginResp.text();
    throw new Error(`Login failed: ${loginResp.status} - ${text}`);
  }

  const loginData = (await loginResp.json()) as any;
  const token = loginData.token;
  console.log("Successfully logged in, token acquired.");

  // 4. Perform upload using multipart form-data
  const workspaceRoot = process.cwd().endsWith("scripts")
    ? path.resolve(process.cwd(), "..")
    : process.cwd();

  const form = new FormData();
  const filePath = path.resolve(workspaceRoot, "test_presentation.pptx");
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  form.append("file", blob, "test_presentation.pptx");

  const uploadResp = await fetch(`http://localhost:5000/api/assignments/${assignment.id}/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!uploadResp.ok) {
    const text = await uploadResp.text();
    throw new Error(`Upload failed: ${uploadResp.status} - ${text}`);
  }

  const uploadData = (await uploadResp.json()) as any;
  console.log("Upload response:", uploadData);

  // 5. Verify physical location on disk
  const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
  const expectedRelativePath = uploadData.filename;
  const fullPathOnDisk = path.join(uploadsDir, expectedRelativePath);

  console.log("Checking file existence at:", fullPathOnDisk);
  if (!fs.existsSync(fullPathOnDisk)) {
    throw new Error(`File does not exist at expected path: ${fullPathOnDisk}`);
  }

  const fileContent = fs.readFileSync(fullPathOnDisk, "utf-8").trim();
  if (fileContent !== "dummy-pptx-content") {
    throw new Error(`File content mismatch. Expected 'dummy-pptx-content', got '${fileContent}'`);
  }

  console.log("Success! File was stored correctly under structured directory.");
}

testUpload()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
