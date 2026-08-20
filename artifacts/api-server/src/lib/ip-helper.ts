import os from "os";

export function getNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { name: string; address: string }[] = [];
  
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (list) {
      for (const item of list) {
        if ((item.family === "IPv4" || (item.family as any) === 4) && !item.internal) {
          candidates.push({ name, address: item.address });
        }
      }
    }
  }
  
  if (candidates.length === 0) {
    return "localhost";
  }
  
  // Sort candidates to prioritize physical interfaces like Wi-Fi/Ethernet over virtual/VPN/WSL interfaces
  candidates.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    
    // Check if name is virtual/vpn/wsl/vgate (demote them)
    const isVirtualA = nameA.includes("vbox") || nameA.includes("virtual") || nameA.includes("docker") || nameA.includes("wsl") || nameA.includes("veth") || nameA.includes("vgate");
    const isVirtualB = nameB.includes("vbox") || nameB.includes("virtual") || nameB.includes("docker") || nameB.includes("wsl") || nameB.includes("veth") || nameB.includes("vgate");
    
    if (isVirtualA && !isVirtualB) return 1;
    if (!isVirtualA && isVirtualB) return -1;
    
    // Prefer Wi-Fi or Ethernet
    const isPreferredA = nameA.includes("wi-fi") || nameA.includes("wifi") || nameA.includes("wlan") || nameA.includes("ethernet") || nameA.includes("eth") || nameA.includes("en");
    const isPreferredB = nameB.includes("wi-fi") || nameB.includes("wifi") || nameB.includes("wlan") || nameB.includes("ethernet") || nameB.includes("eth") || nameB.includes("en");
    
    if (isPreferredA && !isPreferredB) return -1;
    if (!isPreferredA && isPreferredB) return 1;
    
    return 0;
  });
  
  return candidates[0].address;
}

export function getClientBaseUrl(req: any): string {
  const host = req.headers.host || req.get?.("host") || "localhost:3000";
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  
  // Extract hostname and port
  const [hostname, port] = host.split(":");
  
  // Check if it is a local address (localhost, 127.0.0.1, or private IP)
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isPrivateIp = 
    hostname.startsWith("192.168.") || 
    hostname.startsWith("10.") || 
    (hostname.startsWith("172.") && (() => {
      const parts = hostname.split(".");
      if (parts.length < 2) return false;
      const secondOctet = parseInt(parts[1], 10);
      return !isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
    })());
    
  if (isLocalhost) {
    const ip = getNetworkIp();
    // Use local network IP and map backend port 5000 to frontend port 3000
    const targetPort = port === "5000" ? "3000" : (port || "3000");
    return `${protocol}://${ip}:${targetPort}`;
  }
  
  if (isPrivateIp) {
    const targetPort = port === "5000" ? "3000" : (port || "3000");
    return `${protocol}://${hostname}:${targetPort}`;
  }
  
  // For domains or public IPs:
  // If it's a domain (contains alphabetical characters), strip the port entirely because production domains run on standard ports (80/443)
  const isDomain = /[a-zA-Z]/.test(hostname);
  if (isDomain) {
    return `${protocol}://${hostname}`;
  }
  
  // If it is a public IP:
  // Keep the port if present, but replace 5000 with 3000
  if (port) {
    const targetPort = port === "5000" ? "3000" : port;
    return `${protocol}://${hostname}:${targetPort}`;
  }
  
  return `${protocol}://${hostname}`;
}
