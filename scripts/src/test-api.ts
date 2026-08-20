// Test API directly

async function testApi() {
  const loginResp = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: "9999900000",
      password: "Admin@2026",
      userType: "admin"
    })
  });
  if (!loginResp.ok) {
    console.error("Login failed:", await loginResp.text());
    return;
  }
  const { token } = await loginResp.json() as any;
  
  const submissionsResp = await fetch("http://localhost:5000/api/submissions/all", {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!submissionsResp.ok) {
    console.error("Submissions fetch failed:", await submissionsResp.text());
    return;
  }
  
  const data = await submissionsResp.json() as any;
  console.log("Submissions Response stats:", {
    total: data.total,
    uploaded: data.uploaded,
    pending: data.pending,
  });
  console.log("Uploaded submissions:", data.submissions.filter((s: any) => s.uploadedFile));
}

testApi().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
