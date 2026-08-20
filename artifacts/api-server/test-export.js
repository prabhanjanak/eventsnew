import { db, participantsTable, assignmentsTable } from "@workspace/db";
import * as xlsx from "xlsx";

async function run() {
  console.log("Fetching participants...");
  const participants = await db
    .select()
    .from(participantsTable);
  
  console.log(`Found ${participants.length} participants.`);

  const assignments = await db
    .select()
    .from(assignmentsTable);

  const assignMap = {};
  for (const a of assignments) {
    if (!assignMap[a.participantId]) assignMap[a.participantId] = [];
    assignMap[a.participantId].push(a);
  }

  const rows = participants.map((p) => {
    const roles = (assignMap[p.id] || []).map((a) => a.role).join(", ");
    const tracks = [...new Set((assignMap[p.id] || []).map((a) => a.track))].join(", ");
    const sessions = (assignMap[p.id] || []).map((a) => a.sessionName).filter(Boolean).join("; ");
    const qrUrl = `http://localhost:5000/q/${p.registrationNumber}`;

    const paymentStatus = p.isPaid ? "Paid" : (p.isSponsored ? "Sponsored" : "Unpaid");

    return {
      "Reg No.": p.registrationNumber,
      "Name": p.name,
      "Institution": p.institution,
      "Mobile": p.mobile || "",
      "Email": p.email || "",
      "Payment Status": paymentStatus,
      "UTR Number": p.isPaid ? (p.utrNumber || "") : "NA",
      "Delegate Type": p.delegateType || "delegate",
      "Is Sponsored": p.isSponsored ? "Yes" : "No",
      "Sponsor Type": p.isSponsored ? (p.sponsorType || "") : "NA",
      "Role(s)": roles,
      "Track(s)": tracks,
      "Session(s)": sessions,
      "Is On-Spot": p.isOnSpot ? "Yes" : "No",
      "Is Active": p.isActive ? "Yes" : "No",
      "Registered On": p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
      "QR Code URL": qrUrl,
      "QR Code Link (ID Card)": qrUrl,
    };
  });

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 18 }, { wch: 32 }, { wch: 40 }, { wch: 14 }, { wch: 36 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 16 },
    { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 12 }, { wch: 10 },
    { wch: 22 }, { wch: 50 }, { wch: 50 },
  ];

  xlsx.utils.book_append_sheet(wb, ws, "Delegates");
  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  console.log("Generated Excel buffer size:", buf.length);
}

run().then(()=>console.log("Success")).catch(console.error);
