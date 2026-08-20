import { useState, useRef, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

interface PasscodeInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete?: (val: string) => void;
  disabled?: boolean;
  theme?: "light" | "dark";
}

export function PasscodeInput({ value, onChange, onComplete, disabled, theme = "dark" }: PasscodeInputProps) {
  const [digits, setDigits] = useState<string[]>(value.padEnd(6, "").split("").slice(0, 6));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, val: string) => {
    // Only allow numbers
    const cleanVal = val.replace(/[^0-9]/g, "");
    if (!cleanVal && val !== "") return; // Allow empty

    const newDigits = [...digits];
    
    // Handle paste of multiple characters
    if (cleanVal.length > 1) {
      const pasted = cleanVal.split("").slice(0, 6);
      pasted.forEach((char, i) => {
        if (index + i < 6) newDigits[index + i] = char;
      });
      setDigits(newDigits);
      const newStr = newDigits.join("");
      onChange(newStr);
      
      const nextEmpty = newDigits.findIndex(d => !d);
      if (nextEmpty !== -1) {
        inputsRef.current[nextEmpty]?.focus();
      } else {
        inputsRef.current[5]?.focus();
        onComplete?.(newStr);
      }
      return;
    }

    newDigits[index] = cleanVal;
    setDigits(newDigits);
    const newStr = newDigits.join("");
    onChange(newStr);

    if (cleanVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    if (newStr.length === 6 && cleanVal) {
      onComplete?.(newStr);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      onChange(newDigits.join(""));
    }
  };

  const themeClasses = theme === "light"
    ? "bg-white border-slate-300 text-slate-800 focus:border-[#F58220] focus:ring-[#F58220]/25 focus:bg-white"
    : "bg-white/10 border-white/15 text-white focus:border-[#F58220] focus:ring-[#F58220]/25 focus:bg-white/15";

  return (
    <div className="flex gap-2 justify-between w-full">
      {Array.from({ length: 6 }).map((_, index) => (
        <Input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={digits[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold transition-all duration-200 rounded-xl ${themeClasses}`}
        />
      ))}
    </div>
  );
}
