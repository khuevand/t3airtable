// components/AiBuilderBox.tsx
import { Sparkles, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function AiBuilderBox() {
  const suggestions = [
    "Design a task manager app for our operations team to assign and monitor projects across the org",
    "Create an event planner to help me manage logistics, vendors, and RSVPs",
  ];

  const [index, setIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setIndex((prev) => (prev + 1) % suggestions.length);
    }, 4000);

    return () => clearTimeout(timeoutRef.current!);
  }, [index]);

  return (
    <div className="relative flex items-center justify-center bg-[#f6f9f5] py-15 overflow-hidden">
      {/* Background dots */}
      <div className="absolute inset-0 z-0 animated-dots-bg" />
        {/* White Card */}
        <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white p-7 shadow-xl flex flex-col justify-between min-h-[190px]">
          {/* Suggestion Text */}
          <p className="text-[20px] font-base text-slate-800 min-h-[60px] transition-all text-left">
            {suggestions[index]}
          </p>

          {/* Button Group at the bottom */}
          <div className="mt-11 flex justify-between items-center">
            <button className="flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-base font-semibold hover:bg-slate-50">
              <Shuffle className="w-4 h-4" /> New Suggestion
            </button>

            <button className="flex items-center gap-2 rounded-full bg-black px-6 py-3 text-base font-semibold text-white hover:bg-gray-700">
              <Sparkles className="w-4 h-4" /> Build it now
            </button>
          </div>
        </div>
    </div>
  );
}
