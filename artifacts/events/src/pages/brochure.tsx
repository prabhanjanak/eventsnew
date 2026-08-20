import { useEffect } from "react";

export default function BrochurePage() {
  useEffect(() => {
    window.location.replace("/brochure.pdf");
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#F58220] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold tracking-wide">Opening Brochure PDF...</p>
      </div>
    </div>
  );
}
