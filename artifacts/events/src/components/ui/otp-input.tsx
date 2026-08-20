import React, { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const chars = value.split("").slice(0, 6);
    const newOtp = Array(6).fill("");
    chars.forEach((c, i) => (newOtp[i] = c));
    setOtp(newOtp);
  }, [value]);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (!val) {
      // Handle backspace or empty
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      onChange(newOtp.join(""));
      return;
    }

    // Single digit entry
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1); // Take the last digit in case of multiple
    setOtp(newOtp);
    onChange(newOtp.join(""));

    // Move to next input automatically
    if (index < 5 && val) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasted) return;
    
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      if (i < 6) newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    onChange(newOtp.join(""));
    
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {otp.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-12 h-14 text-center font-extrabold text-2xl border-gray-300 focus:border-[#F58220] focus:ring-[#F58220]/20 rounded-xl bg-white/50"
        />
      ))}
    </div>
  );
}
