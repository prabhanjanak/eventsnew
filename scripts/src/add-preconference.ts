import { db, participantsTable, assignmentsTable, getCleanName } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type PreconfAssignment = {
  speakerName: string;
  role: string;
  track: string;
  sessionName: string;
  hall: string;
  time: string;
  title: string;
};

const preconferenceAssignments: PreconfAssignment[] = [
  // ─── 1. Quality Beyond Accreditation (Hemavathi Hall) ───
  { speakerName: "Dr. Geeta Tulsi", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "12:00-12:05", title: "Welcome address & context setting" },
  { speakerName: "Dr. Vijayabhaskar Gojala", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "12:05-12:30", title: "Lessons Learned from Accreditation Inspections" },
  { speakerName: "Mr. R. Komala", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "12:30-13:00", title: "Small Steps, Big Change – Applying 5S & Kaizen in Healthcare" },
  { speakerName: "Dr. Kamala S", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "13:00-13:25", title: "Advancing Patient Care Through High-Performing Committees" },
  { speakerName: "Break", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "13:25-14:25", title: "Lunch Break" },
  { speakerName: "Mr. Arnold Sorkar", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "14:25-14:50", title: "Enhancing Patient Safety Through Standardized Communication" },
  { speakerName: "Dr. Nisha Ahuja", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "14:50-15:10", title: "Driving Better Patient Outcomes Through Clinical Audits" },
  { speakerName: "Dr. Geeta Tulsi", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "15:10-15:30", title: "Tools & Techniques – Analyze Root Cause and Improve Action" },
  { speakerName: "Break", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "15:30-15:45", title: "Networking & High Tea" },
  { speakerName: "Dr. Samina Zamindar", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "15:45-16:10", title: "Patient Safety and Cost of Poor Quality" },
  { speakerName: "Mr. Aroti Vitta", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "16:10-16:35", title: "Healthcare Exchange Ideas to Elevate Excellence" },
  { speakerName: "Mr. Ravi Tej", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "16:35-16:55", title: "Driving Eyecare Excellence Through Lean Principles" },
  { speakerName: "Dr. Geeta Tulsi", role: "Speaker", track: "Track 2: Collaboration for Universal Eye Health", sessionName: "PC01::Quality Beyond Accreditation", hall: "Hemavathi Hall", time: "16:55-17:00", title: "Feedback & Q&A" },

  // ─── 2. Optics in Optometry, Dispensing & Ocularistry (Arkavathi Hall) ───
  { speakerName: "Dr. Aditya Goyal", role: "Chair", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "12:00-16:45", title: "Workshop Organizing Team" },
  { speakerName: "Ms. Vandana Kamath", role: "CoChair", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "12:00-16:45", title: "Workshop Organizing Team" },
  { speakerName: "Mr. Jitendra Sahoo", role: "Moderator", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "12:00-16:45", title: "Workshop Organizing Team" },
  { speakerName: "Break", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "12:00-13:00", title: "Lunch" },
  { speakerName: "Mr. Sebin", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "13:00-14:00", title: "Optics in Clinical Optometry – Principles & Applications" },
  { speakerName: "Ms. Proteeksha", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "13:00-14:00", title: "Optics in Clinical Optometry – Principles & Applications" },
  { speakerName: "Ms. Paula Mukherjee", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "14:00-15:15", title: "Quality Check in Dispensing" },
  { speakerName: "Break", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "15:15-15:30", title: "Networking & High Tea" },
  { speakerName: "Ms. Sukanya Suresh", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "15:30-16:30", title: "Ocular Prosthesis – Who is a Candidate and Who is Not?" },
  { speakerName: "Mr. Jitendra Sahoo", role: "Speaker", track: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care", sessionName: "PC02::Optics in Optometry, Quality Check in Dispensing & Ocularistry", hall: "Arkavathi Hall", time: "16:30-16:45", title: "Workshop Summary & Feedback" },

  // ─── 3. 20/20 AI – See Further, Work Smarter (Netravathi Hall) ───
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:00-12:10", title: "Welcome & Workshop Introduction" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:00-12:10", title: "Welcome & Workshop Introduction" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:10-12:40", title: "Module 1: AI Without the Jargon" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:10-12:40", title: "Module 1: AI Without the Jargon" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:40-13:30", title: "Module 2: Hands-on AI (Live Prompt Writing)" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "12:40-13:30", title: "Module 2: Hands-on AI (Live Prompt Writing)" },
  { speakerName: "Break", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "13:30-14:15", title: "Lunch" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "14:15-15:00", title: "Module 3: AI for Clinical Documentation, Patient Communication, Literature Summaries" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "14:15-15:00", title: "Module 3: AI for Clinical Documentation, Patient Communication, Literature Summaries" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "15:00-15:45", title: "Module 4: AI for Project Scheduling, Funding, Patient FAQs, Workflows" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "15:00-15:45", title: "Module 4: AI for Project Scheduling, Funding, Patient FAQs, Workflows" },
  { speakerName: "Break", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "15:45-16:00", title: "Tea Break" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "16:00-17:00", title: "Module 5: Build AI Assistant, Personalized Prompts, Advanced Prompt Writing" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "16:00-17:00", title: "Module 5: Build AI Assistant, Personalized Prompts, Advanced Prompt Writing" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "17:00-17:45", title: "Open Q&A & Troubleshooting" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "17:00-17:45", title: "Open Q&A & Troubleshooting" },
  { speakerName: "Dr. Jaideep Rayapudi", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "17:45-18:00", title: "Closing Remarks & Certificate Distribution" },
  { speakerName: "Dr. Avneesh Khare", role: "Speaker", track: "Track 1: Innovations and Technological Solutions in Eye Care", sessionName: "PC03::20/20 AI – See Further, Work Smarter", hall: "Netravathi Hall", time: "17:45-18:00", title: "Closing Remarks & Certificate Distribution" },

  // ─── 4. Infection Prevention & Control Workshop (Varahi Hall) ───
  { speakerName: "Dr. Saishruti Iyer", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "12:00-12:30", title: "Standard Precautions, Environment & Biomedical Waste" },
  { speakerName: "Dr. Lalitha Prajna", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "12:30-13:00", title: "OT Protocols for Prevention of Post-operative Endophthalmitis" },
  { speakerName: "Mr. Sailesh Mehta", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "13:00-13:30", title: "Sterilisation & Kill Kinetics" },
  { speakerName: "Break", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "13:30-14:30", title: "Lunch" },
  { speakerName: "Dr. Meena Menon", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "14:30-15:00", title: "Endophthalmitis, TASS & Microbiology Surveillance" },
  { speakerName: "Mr. Sheli Boi", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "15:00-15:30", title: "Simulation Station 1" },
  { speakerName: "Mr. Sheli Boi", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "15:30-16:00", title: "Simulation Station 2" },
  { speakerName: "Break", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "16:00-16:15", title: "Tea Break" },
  { speakerName: "Mr. Sheli Boi", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "16:15-16:45", title: "Simulation Station 3" },
  { speakerName: "Break", role: "Speaker", track: "Track 5 Hall A: Sharing Knowledge Repository: Towards Organization's Excellence & Growth", sessionName: "PC04::Infection Prevention & Control Workshop", hall: "Varahi Hall", time: "16:45-17:00", title: "Closing Remarks & Certificate Distribution" },

  // ─── 5. CSR: Investment & Partnerships in Eye Care (Vedavathi Hall) ───
  { speakerName: "Dr. Rajesh Saini", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Dr. Praveen Vashist", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Dr. Shailender Sabherwal", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Dr. Umesh Mathur", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Mr. Sameer Beg", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Mr. Akhter Jyoti", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Mr. Soujotit Biswas", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },
  { speakerName: "Mr. Bharat Balasubramaniam", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:00-16:50", title: "Session 1: Eye Care in India: Progress & Gaps" },

  { speakerName: "Mr. Kuldeep Singh", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Ms. Usha Rani", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Ms. Chetana Thittai", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Mr. Anupama Shetty", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Ms. Dhanalakshmi", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Mr. Sunil Kumar Dhoreeshwar", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },
  { speakerName: "Mr. K. Chandrasekhar", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "16:50-17:40", title: "Session 2: Multiple Entry Points—No Single Model: How NGOs Engage with Eyecare" },

  { speakerName: "Break", role: "Speaker", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:40-17:50", title: "Tea Break" },

  { speakerName: "Dr. Sucheta Kulkarni", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:50-18:30", title: "Session 3: Systems Thinking in Action: Rethinking Opportunity" },
  { speakerName: "Mr. Pritesh Dhingra", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:50-18:30", title: "Session 3: Systems Thinking in Action: Rethinking Opportunity" },
  { speakerName: "Mr. Vineet Mathur", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:50-18:30", title: "Session 3: Systems Thinking in Action: Rethinking Opportunity" },
  { speakerName: "Mr. Amaresh Kumar Pandev", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:50-18:30", title: "Session 3: Systems Thinking in Action: Rethinking Opportunity" },
  { speakerName: "Mr. S. Senthilraj", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "17:50-18:30", title: "Session 3: Systems Thinking in Action: Rethinking Opportunity" },

  { speakerName: "Mr. Neelima", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "18:30-19:20", title: "Session 4: Future Pathways of Philanthropic Engagement in Eye Care" },
  { speakerName: "Ms. Dhivya Ramasamy", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "18:30-19:20", title: "Session 4: Future Pathways of Philanthropic Engagement in Eye Care" },
  { speakerName: "Dr. Rohit Khanna", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "18:30-19:20", title: "Session 4: Future Pathways of Philanthropic Engagement in Eye Care" },
  { speakerName: "Mr. Rohit Raj Bansal", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "18:30-19:20", title: "Session 4: Future Pathways of Philanthropic Engagement in Eye Care" },
  { speakerName: "Mr. Subesh Kugudgi", role: "Presenter", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "18:30-19:20", title: "Session 4: Future Pathways of Philanthropic Engagement in Eye Care" },

  { speakerName: "Dr. Rajesh Saini", role: "Speaker", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "19:20-19:30", title: "Session 4 Closing Remarks" },

  { speakerName: "Break", role: "Speaker", track: "Track 4: Excellence in Optometry and Allied Ophthalmic Personnel", sessionName: "PC05::Corporate Social Responsibility: Investment & Partnerships in Eye Care", hall: "Vedavathi Hall", time: "19:30-21:30", title: "Dinner hosted by Sankara" },
];

async function main() {
  console.log("Adding pre-conference sessions for 10-07-2026...");
  let newParticipantsCounter = 90000;

  for (const item of preconferenceAssignments) {
    const clean = getCleanName(item.speakerName);
    
    // Check if participant already exists
    let participantId: number;
    const [existing] = await db
      .select({ id: participantsTable.id })
      .from(participantsTable)
      .where(eq(participantsTable.cleanName, clean))
      .limit(1);

    if (existing) {
      participantId = existing.id;
      console.log(`Found existing participant for "${item.speakerName}": ID ${participantId}`);
    } else {
      // Create new participant
      const regNum = `V2020-PC${newParticipantsCounter++}`;
      const [inserted] = await db
        .insert(participantsTable)
        .values({
          registrationNumber: regNum,
          name: item.speakerName,
          cleanName: clean,
          institution: "Pre-Conference Presenter",
          isPaid: true,
          isActive: true,
          isSponsored: false,
          delegateType: "delegate",
        })
        .returning({ id: participantsTable.id });
      participantId = inserted.id;
      console.log(`Inserted new participant for "${item.speakerName}": ID ${participantId} (Reg: ${regNum})`);
    }

    // Insert assignment
    await db.insert(assignmentsTable).values({
      participantId,
      role: item.role,
      track: item.track,
      sessionName: item.sessionName,
      hall: item.hall,
      date: "10-07-2026", // Always 10 July 2026
      time: item.time,
      presentationTitle: item.title,
    });
    console.log(`Assigned "${item.speakerName}" as ${item.role} to "${item.title}" (${item.time})`);
  }

  console.log("All pre-conference sessions added successfully!");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
