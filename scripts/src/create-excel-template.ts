import * as xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const wb = xlsx.utils.book_new();

  // Defined columns/format
  const headers = [
    "Sr. No",
    "Poster / Paper No",
    "Name",
    "Hospital Name",
    "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)",
    "Session name",
    "Day",
    "Track number",
    "Time",
    "Tittle",
    "Track Number"
  ];

  const sheetsConfig = [
    {
      name: "Chair",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "",
          "Name": "Dr. Alice Brown",
          "Hospital Name": "Sankara Eye Hospital",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Chair",
          "Session name": "Glaucoma Secrets",
          "Day": "2026-07-10",
          "Track number": "1",
          "Time": "09:30 - 10:30",
          "Tittle": "Overview of Modern Glaucoma Interventions",
          "Track Number": "1"
        }
      ]
    },
    {
      name: "Co-Chair",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "",
          "Name": "Dr. Bob Green",
          "Hospital Name": "Aravind Eye Care System",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Co-Chair",
          "Session name": "Retina Updates",
          "Day": "2026-07-10",
          "Track number": "2",
          "Time": "11:00 - 12:00",
          "Tittle": "Future of Retinal Imaging update",
          "Track Number": "2"
        }
      ]
    },
    {
      name: "Moderator",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "",
          "Name": "Dr. Charlie Davis",
          "Hospital Name": "LV Prasad Eye Institute",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Moderator",
          "Session name": "Cataract Innovations",
          "Day": "2026-07-11",
          "Track number": "3",
          "Time": "14:00 - 15:30",
          "Tittle": "Complex Cataract Surgery Techniques",
          "Track Number": "3"
        }
      ]
    },
    {
      name: "Panelist",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "",
          "Name": "Dr. Diana Evans",
          "Hospital Name": "Narayana Nethralaya",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Panelist",
          "Session name": "Cornea Panel",
          "Day": "2026-07-11",
          "Track number": "4",
          "Time": "16:00 - 17:00",
          "Tittle": "New Horizons in Corneal Transplants",
          "Track Number": "4"
        }
      ]
    },
    {
      name: "Speaker",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "",
          "Name": "Dr. Edward Fowler",
          "Hospital Name": "Sankara Eye Hospital",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Speaker",
          "Session name": "AI in Ophthalmology",
          "Day": "2026-07-12",
          "Track number": "5",
          "Time": "10:00 - 10:15",
          "Tittle": "Deep Learning for Diabetic Retinopathy",
          "Track Number": "5"
        }
      ]
    },
    {
      name: "Poster Presentations",
      data: [
        {
          "Sr. No": "1",
          "Poster / Paper No": "P-01",
          "Name": "Dr. Fiona Gallagher",
          "Hospital Name": "Postgraduate Institute of Ophthalmology",
          "Role (Chair/Co-Chair/Moderator/Panellist/Speaker)": "Poster",
          "Session name": "Poster Session Day 1",
          "Day": "2026-07-10",
          "Track number": "6",
          "Time": "12:00 - 13:00",
          "Tittle": "Rare Case of Bilateral Papilledema",
          "Track Number": "6"
        }
      ]
    }
  ];

  for (const sheetConf of sheetsConfig) {
    // Generate sheet representing correct headers and type order
    const worksheet = xlsx.utils.json_to_sheet(sheetConf.data, { header: headers });
    xlsx.utils.book_append_sheet(wb, worksheet, sheetConf.name);
  }

  const publicPath = path.resolve(__dirname, "../../artifacts/vision2020/public/vision2020_attendees_template.xlsx");
  const rootPath = path.resolve(__dirname, "../../Session_List_Template.xlsx");

  xlsx.writeFile(wb, publicPath);
  xlsx.writeFile(wb, rootPath);
  console.log("Multi-sheet database templates written successfully to public assets and root.");
}

main().catch(console.error);
