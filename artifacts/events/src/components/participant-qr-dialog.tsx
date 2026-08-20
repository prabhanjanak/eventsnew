import { useGetParticipantQR, getGetParticipantQRQueryKey, useGetParticipant, getGetParticipantQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, CheckSquare, Gift, Utensils, CalendarDays, User, Printer } from "lucide-react";

interface ParticipantQRDialogProps {
  open: boolean;
  onClose: () => void;
  participantId: number;
  participantName: string;
  registrationNumber: string;
  isFaculty?: boolean;
}

export function ParticipantQRDialog({
  open, onClose, participantId, participantName, registrationNumber
}: ParticipantQRDialogProps) {
  const { data: qrcodes, isLoading: isQRLoading } = useGetParticipantQR(participantId, {
    query: {
      enabled: open && !!participantId,
      queryKey: getGetParticipantQRQueryKey(participantId),
    }
  });

  const { data: participant, isLoading: isParticipantLoading } = useGetParticipant(participantId, {
    query: {
      enabled: open && !!participantId,
      queryKey: getGetParticipantQueryKey(participantId),
    }
  });

  const isLoading = isQRLoading || isParticipantLoading;

  const assignments = participant?.assignments || [];
  const roles = [...new Set(assignments.map(a => a.role))];
  
  let primaryRole = "Delegate";
  if (participant) {
    if ((participant as any).delegateType === "crew") {
      primaryRole = "Team Sankara";
    } else if ((participant as any).delegateType === "exhibitor") {
      primaryRole = "Stall / Exhibitor";
    } else if ((participant as any).delegateType === "vendor") {
      primaryRole = "Vendor Partner";
    } else if ((participant as any).delegateType === "external") {
      primaryRole = "External Team";
    } else if ((participant as any).delegateType === "committee") {
      primaryRole = "Sankara Committee";
    } else {
      primaryRole = roles.length > 0 ? roles[0] : "Delegate";
    }
  }

  const isVendor = participant?.delegateType === "vendor";
  const isExhibitor = participant?.delegateType === "exhibitor";

  const handlePrint = () => {
    if (!qrcodes) return;
    const win = window.open("", "_blank");
    if (!win) return;

    let additionalDetailsHTML = "";
    if (isVendor) {
      additionalDetailsHTML = `
        <div style="font-size: 13px; font-weight: bold; color: #333; margin-top: 5px;">
          Vendor Partner
        </div>
        <div style="font-size: 12px; font-weight: 800; color: #555; margin-top: 2px;">
          Company: ${participant?.institution || ""}
        </div>
        <div style="display: inline-block; background-color: #ffebeb; color: #cc0000; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-top: 10px; border: 1px solid #ffcccc; letter-spacing: 0.5px;">FOOD COUPONS ONLY</div>
      `;
    } else if (isExhibitor) {
      additionalDetailsHTML = `
        <div style="font-size: 12px; font-weight: bold; color: #333; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; align-items: center;">
          <div style="font-size: 13px; font-weight: 800; color: #111;">Company: ${participant?.institution || ""}</div>
          <div style="background-color: #f58220; color: #fff; padding: 4px 14px; border-radius: 8px; font-size: 16px; font-weight: 900; margin-top: 2px; box-shadow: 0 2px 4px rgba(245,130,32,0.15);">Stall: ${(participant as any)?.address || "N/A"}</div>
          <div style="font-size: 11px; color: #555; font-weight: 600;">Contact Mobile: ${participant?.mobile || "N/A"}</div>
          <div style="display: inline-block; background-color: #ffebeb; color: #cc0000; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-top: 6px; border: 1px solid #ffcccc; letter-spacing: 0.5px;">FOOD COUPONS ONLY</div>
        </div>
      `;
    } else {
      additionalDetailsHTML = `
        <p class="participant-institution">${participant?.institution || ""}</p>
      `;
    }

    const eventTitle = (participant as any)?.event?.title || "EVENT ID BADGE";
    const eventSubtitle = (participant as any)?.event?.badgeSubtitle || (participant as any)?.event?.organizerName || "Sankara Eye Care Institutions";
    const eventFooter = (participant as any)?.event?.badgeFooterText || `${(participant as any)?.event?.venue || "Sankara Eye Hospital"}, ${(participant as any)?.event?.city || "Coimbatore"}`;
    const themeColor = (participant as any)?.event?.themeColor || "#f58220";

    win.document.write(`
      <html>
        <head>
          <title>Print ID Badge - ${participantName}</title>
          <style>
            @media print {
              body {
                padding: 0;
                margin: 0;
              }
            }
            body {
              margin: 0;
              padding: 40px 20px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 40px;
              background: #fff;
            }
            .badge-container {
              width: 3.25in;
              height: 4.5in;
              border: 1.5px solid ${themeColor};
              border-radius: 12px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              background: #fff;
              position: relative;
              page-break-inside: avoid;
            }
            .badge-front {
              border-color: ${themeColor};
            }
            .badge-header {
              background: ${themeColor};
              color: #fff;
              padding: 14px 10px;
              text-align: center;
              border-bottom: 3.5px solid rgba(0,0,0,0.1);
            }
            .badge-header h1 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1.2;
            }
            .badge-header p {
              margin: 3px 0 0 0;
              font-size: 9px;
              opacity: 0.95;
              font-weight: 600;
            }
            .badge-body {
              padding: 14px 12px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex: 1;
              gap: 5px;
            }
            .role-badge {
              background-color: ${themeColor};
              color: #fff;
              padding: 3px 12px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .participant-name {
              font-size: 18px;
              font-weight: 800;
              color: #111;
              margin: 0;
              line-height: 1.2;
            }
            .participant-institution {
              font-size: 11px;
              color: #555;
              margin: 0;
              font-weight: 600;
              line-height: 1.3;
              max-width: 95%;
            }
            .qr-wrapper {
              margin: 6px 0;
              padding: 4px;
              border: 1px solid #eee;
              border-radius: 8px;
              background: #fff;
            }
            .qr-image {
              width: 115px;
              height: 115px;
              display: block;
            }
            .reg-number {
              font-family: monospace;
              font-size: 12px;
              font-weight: 700;
              color: ${themeColor};
              letter-spacing: 1px;
            }
            .badge-footer {
              background-color: #fcfcfc;
              padding: 7px;
              border-top: 1px solid #eee;
              text-align: center;
              font-size: 8.5px;
              color: #777;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <!-- FRONT CARD -->
          <div class="badge-container badge-front">
            <div class="badge-header">
              <h1>${eventTitle}</h1>
              <p>${eventSubtitle}</p>
            </div>
            <div class="badge-body">
              <div class="role-badge">${primaryRole}</div>
              <h2 class="participant-name">${participantName}</h2>
              ${additionalDetailsHTML}
              <div class="qr-wrapper">
                <img class="qr-image" src="${qrcodes.qr1.dataUrl}" />
              </div>
              <div class="reg-number">${registrationNumber}</div>
            </div>
            <div class="badge-footer">
              ${eventFooter}
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintSticker4x1 = () => {
    if (!participant) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Print 4x1 Sticker - ${participantName}</title>
          <style>
            @page {
              size: 4in 1in;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 4in !important;
              height: 1in !important;
              overflow: hidden !important;
              box-sizing: border-box;
              background-color: #fff;
            }
            .sticker-card {
              width: 4in;
              height: 1in;
              padding: 0.12in 0.25in;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
              page-break-inside: avoid;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            .name {
              font-size: 13pt;
              font-weight: 850;
              color: #000;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
              margin: 0;
            }
            .details {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 2pt;
            }
            .institution {
              font-size: 8.5pt;
              color: #333;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 2.2in;
            }
            .role {
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
              background-color: #000;
              color: #fff;
              padding: 1pt 5pt;
              border-radius: 3px;
              line-height: 1.2;
            }
          </style>
        </head>
        <body>
          <div class="sticker-card">
            <div class="name">${participantName.toUpperCase()}</div>
            <div class="details">
              <div class="institution">${participant.institution || "Sankara Eye Hospital"}</div>
              <div class="role">${primaryRole}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePrintSticker4x2 = () => {
    if (!participant || !qrcodes) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Print 4x2 Sticker - ${participantName}</title>
          <style>
            @page {
              size: 4in 2in;
              margin: 0;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 4in !important;
              height: 2in !important;
              overflow: hidden !important;
              box-sizing: border-box;
              background-color: #fff;
            }
            .sticker-card {
              width: 4in;
              height: 2in;
              padding: 0.15in 0.2in;
              box-sizing: border-box;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              overflow: hidden;
              page-break-inside: avoid;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            }
            .left-pane {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              min-width: 0;
            }
            .name {
              font-size: 14pt;
              font-weight: 900;
              color: #000;
              line-height: 1.1;
              word-wrap: break-word;
              margin-bottom: 2pt;
            }
            .institution {
              font-size: 8.5pt;
              color: #444;
              font-weight: 600;
              margin-bottom: 6pt;
              word-wrap: break-word;
            }
            .meta-row {
              display: flex;
              align-items: center;
              gap: 6pt;
            }
            .role {
              font-size: 7.5pt;
              font-weight: 800;
              text-transform: uppercase;
              background-color: #000;
              color: #fff;
              padding: 1.5pt 6pt;
              border-radius: 4px;
            }
            .reg-number {
              font-family: monospace;
              font-size: 9pt;
              font-weight: 700;
              color: #333;
            }
            .right-pane {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .qr-image {
              width: 1.1in;
              height: 1.1in;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="sticker-card">
            <div class="left-pane">
              <div class="name">${participantName.toUpperCase()}</div>
              <div class="institution">${participant.institution || "Sankara Eye Hospital"}</div>
              <div class="meta-row">
                <span class="role">${primaryRole}</span>
                <span class="reg-number">${registrationNumber}</span>
              </div>
            </div>
            <div class="right-pane">
              <img class="qr-image" src="${qrcodes.qr1.dataUrl}" />
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-[#6F42C1] to-[#5a35a0] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-white text-base truncate">{participantName}</DialogTitle>
              <div className="text-white/70 text-xs font-mono mt-0.5">{registrationNumber}</div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 flex flex-col items-center gap-3">
            <Skeleton className="w-48 h-48 rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : qrcodes ? (
          <Tabs defaultValue="qr1" className="w-full">
            <div className="px-4 pt-4">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="qr1" className="text-xs">Registration QR</TabsTrigger>
                <TabsTrigger value="qr2" className="text-xs">Agenda Hub QR</TabsTrigger>
                <TabsTrigger value="badge" className="text-xs">Print Badge</TabsTrigger>
              </TabsList>
            </div>

            {/* QR 1 — Registration (Attendance + Goodies + Food) */}
            <TabsContent value="qr1" className="px-5 pb-5 pt-3 flex flex-col items-center">
              <div className="bg-white p-3 rounded-xl border-2 border-[#F58220]/30 shadow-sm mb-3">
                <img src={qrcodes.qr1.dataUrl} alt="Registration QR" className="w-48 h-48" />
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-2 text-center">Registration Badge (QR 1)</p>

              {/* Usage labels */}
              <div className="flex flex-col gap-1.5 w-full mb-4">
                {isVendor || isExhibitor ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium text-orange-700 bg-orange-50 border-orange-200">
                    <Utensils className="w-3.5 h-3.5 shrink-0" />
                    Food Coupon / Meals Scanning Only
                  </div>
                ) : (
                  [
                    { icon: CheckSquare, label: "Attendance Check-in", color: "text-green-700 bg-green-50 border-green-200" },
                    { icon: Gift, label: "Goodies Collection", color: "text-purple-700 bg-purple-50 border-purple-200" },
                    { icon: Utensils, label: "Food Coupon / Meals", color: "text-orange-700 bg-orange-50 border-orange-200" },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${color}`}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {label}
                    </div>
                  ))
                )}
              </div>

              <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                <a href={qrcodes.qr1.dataUrl} download={qrcodes.qr1.downloadName}>
                  <Download className="w-3.5 h-3.5" /> Download Registration QR
                </a>
              </Button>
            </TabsContent>

            {/* QR 2 — Agenda Hub */}
            <TabsContent value="qr2" className="px-5 pb-5 pt-3 flex flex-col items-center">
              <div className="bg-white p-3 rounded-xl border-2 border-gray-150 shadow-sm mb-3">
                <img src={qrcodes.qr2.dataUrl} alt="Agenda Portal QR" className="w-48 h-48" />
              </div>

              <p className="text-xs font-semibold text-gray-700 mb-2 text-center">Agenda Portal &amp; Dashboard (QR 2)</p>

              <div className="flex flex-col gap-1.5 w-full mb-4">
                {[
                  { icon: CalendarDays, label: "General Conference Brochure", color: "text-blue-700 bg-blue-50 border-blue-200" },
                  { icon: User, label: "Personal Commitments & Coupon Status", color: "text-purple-700 bg-purple-50 border-purple-200" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${color}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
                <a href={qrcodes.qr2.dataUrl} download={qrcodes.qr2.downloadName}>
                  <Download className="w-3.5 h-3.5" /> Download Agenda QR
                </a>
              </Button>
            </TabsContent>

            {/* Print Badge Preview */}
            <TabsContent value="badge" className="px-5 pb-5 pt-3 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-full max-h-[300px] overflow-y-auto p-3 border rounded-xl bg-gray-50/50">
                
                {/* FRONT PREVIEW */}
                <div style={{
                  width: "150px",
                  height: "220px",
                  border: `1.5px solid ${(participant as any)?.event?.themeColor || "#f58220"}`,
                  borderRadius: "8px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                  boxSizing: "border-box",
                  fontFamily: "system-ui, sans-serif"
                }}>
                  <div style={{
                    background: (participant as any)?.event?.themeColor || "#f58220",
                    color: "#fff",
                    padding: "6px 5px",
                    textAlign: "center"
                  }}>
                    <h1 style={{ margin: 0, fontSize: "7.5px", fontWeight: "800", textTransform: "uppercase", lineHeight: "1.1" }}>
                      {(participant as any)?.event?.title || "EVENT ID BADGE"}
                    </h1>
                  </div>
                  
                  <div style={{
                    padding: "6px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: 1,
                    gap: "2px"
                  }}>
                    <div style={{
                      backgroundColor: (participant as any)?.event?.themeColor || "#f58220",
                      color: "#fff",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "6px",
                      fontWeight: "750",
                      textTransform: "uppercase",
                      marginBottom: "1px"
                    }}>
                      {primaryRole}
                    </div>
                    
                    <h2 style={{
                      fontSize: "10px",
                      fontWeight: "800",
                      color: "#222",
                      margin: 0,
                      lineHeight: "1.2"
                    }}>
                      {participantName}
                    </h2>
                    
                    {isVendor && (
                      <div style={{ fontSize: "5px", fontWeight: "700", color: "#333", display: "flex", flexDirection: "column", gap: "0.5px" }}>
                        <div>Co: {participant?.institution || ""}</div>
                        <div style={{ fontSize: "4.5px", color: "#cc0000", fontWeight: "800" }}>FOOD ONLY</div>
                      </div>
                    )}

                    {isExhibitor && (
                      <div style={{ fontSize: "5px", fontWeight: "700", color: "#333", display: "flex", flexDirection: "column", gap: "0.5px" }}>
                        <div>Co: {participant?.institution || ""}</div>
                        <div style={{ color: "#f58220", fontSize: "7.5px", fontWeight: "900" }}>Stall: {(participant as any)?.address || "N/A"}</div>
                        <div style={{ fontSize: "4.5px", color: "#cc0000", fontWeight: "800" }}>FOOD ONLY</div>
                      </div>
                    )}

                    {!isVendor && !isExhibitor && (
                      <p style={{
                        fontSize: "6px",
                        color: "#666",
                        margin: 0,
                        fontWeight: "500",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "130px"
                      }}>
                        {participant?.institution || ""}
                      </p>
                    )}
                    
                    <div style={{
                      margin: "2px 0",
                      padding: "2px",
                      border: "1px solid #eee",
                      borderRadius: "4px",
                      backgroundColor: "#fff"
                    }}>
                      <img src={qrcodes.qr1.dataUrl} alt="Registration QR" style={{ width: "50px", height: "50px", display: "block" }} />
                    </div>
                    
                    <div style={{
                      fontFamily: "monospace",
                      fontSize: "7px",
                      fontWeight: "700",
                      color: (participant as any)?.event?.themeColor || "#f58220"
                    }}>
                      {registrationNumber}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2 mt-2">
                <Button onClick={handlePrint} className="w-full bg-[#f58220] hover:bg-[#e07010] text-white font-bold gap-2 cursor-pointer">
                  <Printer className="w-4 h-4" /> Print Badge (3.25" x 4.5")
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    type="button"
                    onClick={handlePrintSticker4x1} 
                    variant="outline" 
                    className="border-[#6F42C1] text-[#6F42C1] hover:bg-[#6F42C1]/10 font-bold text-xs gap-1.5 cursor-pointer h-10 rounded-xl"
                  >
                    <Printer className="w-3.5 h-3.5" /> 4"x1" Sticker
                  </Button>
                  <Button 
                    type="button"
                    onClick={handlePrintSticker4x2} 
                    variant="outline" 
                    className="border-[#6F42C1] text-[#6F42C1] hover:bg-[#6F42C1]/10 font-bold text-xs gap-1.5 cursor-pointer h-10 rounded-xl"
                  >
                    <Printer className="w-3.5 h-3.5" /> 4"x2" Sticker
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">Could not load QR codes.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
