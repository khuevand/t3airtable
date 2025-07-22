import {Bell, 
        HelpCircle,
        Plus,
        Search,
        AlignJustify,
        Info,
        CircleCheck,
        House,
        Star,
        ExternalLink,
        UsersRound,
        BookOpen,
        ShoppingBag,
        Share,
        ArrowUp,
        Grid2X2,
        Sparkles,
        TableProperties
      } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import clsx from "clsx";

export default function HomeDashboard() {
  const { user } = useUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sidebarExpanded = isSidebarOpen || isHovered;

  const dropdownOptions = [
    "Today",
    "Opened in past 7 days",
    "Opened in past 30 days",
    "Anytime",
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header Section */}
      <header className="flex items-center justify-center px-10 py-3 bg-[#f1f5ff] border-b border-slate-200">
        <div className="flex items-center gap-1">
          <Link
            href="#"
            className="flex items-center text-[13px] text-slate-800 underline cursor-pointer">
            <Info className="w-[18px] h-[18px] text-blue-700 mr-2" />
            <span>Invite your friends and coworkers</span>
          </Link>
          <p className="text-[13px] text-slate-800">
            to earn account credit.
          </p>
        </div>
      </header>

      <section className="flex items-center justify-between px-4 py-2 border-b border-slate-200 w-full">
        {/* Left - Sidebar toggle and logo */}
        <div className="flex items-center mr-2 gap-3 min-w-[200px]">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="hover:bg-gray-100 p-1 rounded"
            title="Expand sidebar"
          >
            <AlignJustify className="w-5 h-5 text-gray-400" />
          </button>

          <Link href="/home">
            <Image src="/Airtable-Logo.png" alt="Logo" width={110} height={40} />
          </Link>
        </div>

        {/* Center - Search bar */}
        <div className="flex items-center w-full max-w-90 px-3 py-2 mr-16 border border-gray-200 shadow-sm rounded-full hover:shadow-md transition mx-6 cursor-pointer">
          <Search className="w-4 h-4 text-gray-800 mr-2" />
          <input
            type="search"
            placeholder="Search..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
          <span className="text-xs text-gray-400 ml-2">ctrl K</span>
        </div>

        {/* Right - Help, Notifications, Avatar */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-3 py-1 text-[13px] text-gray-600 hover:bg-gray-100 rounded-full">
            <HelpCircle className="w-4 h-4 text-gray-600" />
            <span className="font-medium">Help</span>
          </button>

          <button
            className="p-1 rounded-full border border-gray-300 hover:bg-gray-100 mr-3"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-gray-700" />
          </button>

          {user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt="User avatar"
              className="rounded-full"
              width={26}
              height={26}
            />
          ) : (
            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-500 text-white text-sm font-semibold">
              {user?.firstName?.[0] ?? "U"}
            </div>
          )}
        </div>
      </section>

      {/* Below the header: Sidebar + Main */}
      <div className="flex flex-1 overflow-hidden bg-[#f9fafb]">
        {/* Sidebar */}
        <aside
          className={`transition-all duration-300 ${
            sidebarExpanded ? "w-60" : "w-12"
          } bg-white border-r border-gray-200 p-2 flex flex-col justify-between`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          
          <div className="justify-between items-center flex flex-col gap-3 text-gray-700">
            <nav className="flex flex-col gap-6 w-full items-center mt-3 ml-2">
              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <House className="w-5 h-5" />
                {sidebarExpanded && <span className="font-bold">Home</span>}
              </div>
              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <Star className="w-5 h-5" />
                {sidebarExpanded && <span className="font-bold">Starred</span>}
              </div>
              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <ExternalLink className="w-5 h-5" />
                {sidebarExpanded && <span className="font-bold">Shared</span>}
              </div>
              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <UsersRound className="w-5 h-5" />
                {sidebarExpanded && <span className="font-bold">Workspaces</span>}
              </div>
            </nav>
            <div className={clsx({
                  "": sidebarExpanded,
                  "w-[95%] border-b border-gray-200 mt-1": !sidebarExpanded,
                })}></div>
          </div>

          <div className="mb-4">
            <div className="w-[95%] border-b border-gray-200 mt-1"></div>
            <nav className="flex flex-col gap-6 w-full items-center mt-3 ml-2">
              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <BookOpen
                  className={clsx("w-4 h-4", {
                    "text-gray-800": sidebarExpanded,
                    "text-gray-400": !sidebarExpanded,
                  })}
                />
                {sidebarExpanded && <span className="text-gray-800">Templates and apps</span>}
              </div>

              <div className="flex items-center gap-4 text-sm cursor-pointer w-full">
                <ShoppingBag
                  className={clsx("w-4 h-4", {
                    "text-gray-800": sidebarExpanded,
                    "text-gray-400": !sidebarExpanded,
                  })}
                />
                {sidebarExpanded && <span className="text-gray-800">Marketplace</span>}
              </div>

              <div className="flex items-center gap-4 text-sm cursor-pointer w-full mb-4">
                <Share
                  className={clsx("w-4 h-4", {
                    "text-gray-800": sidebarExpanded,
                    "text-gray-400": !sidebarExpanded,
                  })}
                />
                {sidebarExpanded && <span className="text-gray-800">Import</span>}
              </div>
            </nav>
            <button
              className={clsx(
                "w-full flex items-center justify-center border border-gray-300 rounded px-1 py-1 text-sm",
                {
                  "bg-blue-500 text-white": sidebarExpanded,
                  "bg-white": !sidebarExpanded,
                }
              )}
            >
              <Plus
                className={clsx("w-4 h-4", {
                  "text-white": sidebarExpanded,
                  "text-gray-400": !sidebarExpanded,
                })}
              />
              {sidebarExpanded && <span>Create</span>}
            </button>
          </div>
        </aside>


        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <section className="flex items-center justify-center py-2 bg-[#e6fce8]">
            <div className="flex items-center gap-1">
              <Link
                href="#"
                className="flex items-center text-[13px] text-slate-800 font-medium">
                <CircleCheck className="w-[18px] h-[18px] text-green-700 mr-2" />
                <span>Welcome to the improved Home.</span>
              </Link>
        
              <p className="text-[13px] text-slate-800">
                Find, navigate to, and manage your apps more easily.
              </p>
            </div>

            <button className="flex items-center ml-3 px-3 py-2 text-[13px] text-gray-600 bg-white rounded-md cursor-pointer border border-gray-300 shadow-xs">
              <span className="font-medium">See what's new</span>
            </button>
          </section>
        
          <div className="p-6">
            <div className="mb-6 ml-5 mt-2">
              <div className="text-[27px] font-bold text-gray-800 mb-1">Home</div>
            </div>

            <div className="ml-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  title: "Start with Omni",
                  icon: <Sparkles className="w-4 h-4 text-[#dc64c1]" />,
                  desc: "Use AI to build a custom app tailored to your workflow",
                  descColor: "text-gray-600 text-[13px]",
                },
                {
                  title: "Start with templates",
                  icon: <Grid2X2 className="w-4 h-4 text-purple-900" />,
                  desc: "Select a template to get started and customize as you go.",
                  descColor: "text-gray-600 text-[13px]",
                },
                {
                  title: "Quickly upload",
                  icon: <ArrowUp className="w-4 h-4 text-green-700" />,
                  desc: "Easily migrate existing projects in just a few minutes.",
                  descColor: "text-gray-600 text-[13px]",
                },
                {
                  title: "Build an app on your own",
                  icon: <TableProperties className="w-4 h-4 text-blue-800" />,
                  desc: "Start with a blank app and build your ideal workflow.",
                  descColor: "text-gray-600 text-[13px]",
                },
              ].map((card, index) => (
                <div
                  key={index}
                  className="border border-gray-300 w-111 rounded-md px-5 py-4 text-sm text-left shadow-xs bg-white hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {card.icon}
                    <p className="font-semibold">{card.title}</p>
                  </div>
                  <p className={card.descColor || "text-gray-500"}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <section className="flex items-center justify-between px-6 pt-4 pb-2 mb-30">
            {/* Dropdown (Opened anytime) */}
            <div className="relative inline-block text-left">
              <button
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="ml-6 text-[15px] text-gray-500 hover:text-black flex items-center gap-1"
              >
                Opened anytime
                <svg
                  className="w-4 h-4 mt-[1px] text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 mt-2 w-56 rounded-md bg-white border border-gray-300 shadow-xl focus:outline-none">
                  <div className="py-1">
                    {dropdownOptions.map((option, index) => (
                      <button
                        key={index}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          console.log("Selected:", option);
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Icon group (Right side) */}
            <div className="flex items-center gap-1">
              <button className="p-1 rounded-full" title="View items in list">
                <AlignJustify className="w-5 h-5 text-gray-500 hover:text-gray-600 cursor-pointer" />
              </button>
              <button className="px-1 py-1 rounded-full bg-gray-200" title="View items in grid">
                <Grid2X2 className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </section>

          <section className="flex flex-col items-center justify-center h-[300px] text-sm text-gray-500">
            <p className="text-[21px] text-gray-900 mb-1">
              You haven't opened anything recently
            </p>
            <p className="mb-4 text-[13px]">Apps that you have recently opened will appear here.</p>
            <button className="px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm text-sm text-gray-900 bg-white hover:bg-gray-100 transition">
              Go to all workspaces
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
