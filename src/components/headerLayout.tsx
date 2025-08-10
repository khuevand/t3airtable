import { ChevronDown, History } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";

interface HeaderLayoutProps {
  baseId: string;
  baseName: string | undefined;
  isLoading: boolean;
  stringToColor: (str: string, lightness: number) => string;
  isDarkColor: (hsl?: string) => boolean;
}

const HeaderLayout: React.FC<HeaderLayoutProps> = ({
  baseId,
  baseName,
  isLoading,
  stringToColor,
  isDarkColor,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-2 min-w-[220px]">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: stringToColor(baseId ?? '', 50) }}
        >
          <Image
            src="/airtable.png"
            alt="Logo"
            width={28}
            height={28}
            className={`object-contain ${isDarkColor(stringToColor(baseId ?? '', 50)) ? "invert" : ""}`}
          />
        </div>

        <div className="flex items-center gap-1">
          <div className="text-[18px] font-semibold text-gray-800 whitespace-nowrap">
            {isLoading ? "Loading..." : baseName ?? "Untitled Base"}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-800" />
        </div>
      </div>

      <nav className="flex items-center gap-3 text-sm text-gray-600">
        <a
          href="#"
          className="relative font-medium text-black px-2"
        >
          <span className="relative z-10">Data</span>
          <span
            className="absolute top-9 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-sm"
            style={{ backgroundColor: stringToColor(baseId ?? "", 50) }}
          />
        </a>
        <a href="#" className="hover:text-black">Automations</a>
        <a href="#" className="hover:text-black">Interfaces</a>
        <a href="#" className="hover:text-black">Forms</a>
      </nav>

      <div className="flex items-center gap-3 text-xs whitespace-nowrap">
        <History className="w-4 h-4 text-gray-700"/>
        <span className="bg-[#f2f2f2] text-[13px] text-gray-800 px-3 py-2 rounded-full">
          Trial: 7 days left
        </span>
        <button className="text-white text-xs px-3 py-1.5 shadow-sm rounded-md font-medium cursor-pointer"
        style={{ backgroundColor: stringToColor(baseId ?? '', 50) }}>
          Share
        </button>
      </div>
    </header>
  );
};

export default HeaderLayout;