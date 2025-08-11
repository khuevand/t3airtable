import {
  Bell, 
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
  TableProperties,
  Ellipsis,
  Database,
  Trash2,
  User,
  Users,
  Languages,
  Palette,
  Mail,
  Link as LucideLink,
  Wrench,
  LogOut
} from "lucide-react";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import { api } from "~/utils/api";
import { v4 as uuidv4 } from "uuid";

// ===== UTILITY FUNCTIONS =====
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// ===== TYPE DEFINITIONS =====
type Base = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

// ===== MAIN COMPONENT =====
export default function HomeDashboard() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const router = useRouter();
  const utils = api.useUtils();

  // ===== STATE MANAGEMENT =====
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeMenuBaseId, setActiveMenuBaseId] = useState<string | null>(null);
  const [confirmDeleteBaseId, setConfirmDeleteBaseId] = useState<string | null>(null);
  const sidebarExpanded = isSidebarOpen || isHovered;

  // ===== CONSTANTS =====
  const dropdownOptions = [
    "Today",
    "Opened in past 7 days",
    "Opened in past 30 days",
    "Anytime",
  ];

  // ===== API CALLS =====
  const {
    data: bases = [],
    isLoading: isBasesLoading,
  } = api.base.getAll.useQuery(undefined, {
    enabled: isUserLoaded && !!user?.id,
  });
  const deleteBaseMutation = api.base.deleteBase.useMutation({
    onMutate: async ({ baseId }) => {
      await utils.base.getAll.cancel();

      const previous = utils.base.getAll.getData();

      utils.base.getAll.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter((b) => b.id !== baseId);
      });

      setConfirmDeleteBaseId(null);

      return { previous };
    },
    onError: (_err, { baseId }, ctx) => {
      if (ctx?.previous) {
        utils.base.getAll.setData(undefined, ctx.previous);
      }
      toast.error("Something went wrong while deleting.");
    },
    onSuccess: (_, { baseId }) => {
      toast.success("Base moved to trash.");
    },
    onSettled: async () => {
      await utils.base.getAll.invalidate();
    },
  });

  const createBaseMutation = api.base.createBase.useMutation({
    onMutate: async () => {
      await utils.base.getAll.cancel();
      const previousBases = utils.base.getAll.getData();
      const optimisticBase = {
        id: uuidv4(),
        name: "Untitled Base",
        userId: user?.id ?? "",
        createdAt: new Date(),
        updatedAt: new Date(),
        isOptimistic: true,
      };

      utils.base.getAll.setData(undefined, (old) => {
        if (!old) return [optimisticBase];
        return [optimisticBase, ...old];
      });

      void router.push(`/base/${optimisticBase.id}`);
      setIsCreating(false);
      return { previousBases, optimisticBase };
    },

    onError: (err, newBase, context) => {
      if (context?.previousBases) {
        utils.base.getAll.setData(undefined, context.previousBases);
      }
      void router.push("/");
      alert("Failed to create base. Please try again.");
      setIsCreating(false);
    },

    onSuccess: (data, variables, context) => {
      utils.base.getAll.setData(undefined, (old) => {
        if (!old) return [];
        
        return old.map((base) => {
          if (context?.optimisticBase && base.id === context.optimisticBase.id) {
            return {
              id: data.baseId,
              name: "Untitled Base",
              userId: user?.id ?? "",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          return base;
        });
      });
      if (context?.optimisticBase.id !== data.baseId) {
        void router.replace(`/base/${data.baseId}`);
      }
    },

    onSettled: () => {
      void utils.base.getAll.invalidate();
    },
  });

  // ===== EVENT HANDLERS =====
  const toggleMenu = () => setIsOpen(!isOpen);

  const handleBuildYourOwnClick = () => {
    setIsCreating(true);
    createBaseMutation.mutate();
  };
  
  const handleDelete = (base: Base) => {
    deleteBaseMutation.mutate({ baseId: base.id });
  };

  // ===== RENDER =====
  return (
    <div className="h-screen flex flex-col">
      {/* ===== HEADER SECTION ===== */}
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

      {/* ===== NAVIGATION BAR ===== */}
      <section className="flex items-center justify-between px-4 py-2 border-b border-slate-200 w-full">
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

        <div className="flex items-center w-full max-w-90 px-3 py-2 mr-16 border border-gray-200 shadow-sm rounded-full hover:shadow-md transition mx-6 cursor-pointer">
          <Search className="w-4 h-4 text-gray-800 mr-2" />
          <input
            type="search"
            placeholder="Search..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
          />
          <span className="text-xs text-gray-400 ml-2">ctrl K</span>
        </div>

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
    
          <div className="relative inline-block text-left">
            <button onClick={toggleMenu} className="flex items-center space-x-2">
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
            </button>

            {isOpen && (
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-md bg-white shadow-lg border border-gray-200 ring-opacity-5 font-sans text-sm text-gray-800">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="font-semibold">{user?.fullName}</p>
                  <p className="text-xs text-gray-500">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>

                <ul className="py-2 space-y-1">
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <User className="w-3.5 h-3.5" />
                    Account
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      Manage groups
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] rounded-full">Business</span>
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <Bell className="w-3.5 h-3.5" />
                    Notification preferences
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <Languages className="w-3.5 h-3.5" />
                    Language preferences
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] justify-between border-b border-gray-200 mb-2">
                    <div className="flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" />
                      Appearance
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[11px] rounded-full">Beta</span>
                  </li>

                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    Contact sales
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <Star className="w-3.5 h-3.5" />
                    Upgrade
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2 border-b border-gray-200 mb-2">
                    <Mail className="w-3.5 h-3.5" />
                    Tell a friend
                  </li>

                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <LucideLink className="w-3.5 h-3.5" />
                    Integrations
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2">
                    <Wrench className="w-3.5 h-3.5" />
                    Builder hub
                  </li>
                  <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-[13px] gap-2 border-t border-gray-200">
                    <Trash2 className="w-3.5 h-3.5" />
                    Trash
                  </li>
                </ul>

                <div className="px-4">
                  <SignOutButton>
                    <button className="w-full flex items-center gap-2 text-left text-[13px]
                    
                    
                    hover:bg-gray-100 py-1 rounded-md mb-1">
                      <LogOut className="w-3.5 h-3.5" />
                      Log out
                    </button>
                  </SignOutButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== MAIN LAYOUT: SIDEBAR + CONTENT ===== */}
      <div className="flex flex-1 overflow-hidden bg-[#f9fafb]">
        {/* ===== SIDEBAR ===== */}
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

        {/* ===== MAIN CONTENT ===== */}
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
              <span className="font-medium">See what&apos;s new</span>
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
                  onClick: handleBuildYourOwnClick,
                },
              ].map((card, index) => {
                return (     
                  <div
                  key={index}
                  onClick={!isCreating ? card.onClick : undefined}
                  className={card.onClick ? "cursor-pointer" : ""}
                >
                  <div className="border border-gray-300 w-111 rounded-md px-5 py-4 text-sm text-left shadow-xs bg-white hover:shadow-md transition-all">
                    {isCreating ? (
                      <div className="flex justify-center items-center h-16">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500 border-opacity-75" />
                        <p className="ml-2 text-sm text-gray-600">Creating...</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          {card.icon}
                          <p className="font-semibold">{card.title}</p>
                        </div>
                        <p className={card.descColor ?? "text-gray-500"}>{card.desc}</p>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
          
          <section className="flex items-center justify-between px-6 pb-2">
            <div className="relative inline-block text-left">
              <button
                onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
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

              {isFilterDropdownOpen && (
                <div className="absolute z-10 mt-2 w-56 rounded-md bg-white border border-gray-300 shadow-xl focus:outline-none">
                  <div className="py-1">
                    {dropdownOptions.map((option, index) => (
                      <button
                        key={index}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => {
                          setIsFilterDropdownOpen(false);
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

            <div className="flex items-center gap-1">
              <button className="p-1 rounded-full" title="View items in list">
                <AlignJustify className="w-5 h-5 text-gray-500 hover:text-gray-600 cursor-pointer" />
              </button>
              <button className="px-1 py-1 rounded-full bg-gray-200" title="View items in grid">
                <Grid2X2 className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </section>

          {/* Bases Section */}
          <section className="flex flex-col items-center justify-center min-h-[300px] text-sm text-gray-500">
            {!isUserLoaded || isBasesLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gray-800 border-opacity-75 mr-2" />
                <span className="text-sm text-gray-600">Loading your bases...</span>
              </div>
            ) : bases.length === 0 ? (
              <>
                <p className="text-[21px] text-gray-900 mb-1">
                  You haven&apos;t opened anything recently
                </p>
                <p className="mb-4 text-[13px]">Apps that you have recently opened will appear here.</p>
                <button className="px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm text-sm text-gray-900 bg-white hover:bg-gray-100 transition">
                  Go to all workspaces
                </button>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full px-10 mb-40">
                {bases.map((base) => {
                  return (
                    <div key={base.id} className="relative group w-full max-w-sm">
                      <div
                        className="flex items-center justify-between border border-gray-300 rounded-lg bg-white shadow-sm p-5 hover:shadow-md cursor-pointer"
                        onClick={() => router.push(`/base/${base.id}`)}
                      >
                        <div
                          className="w-14 h-14 rounded-lg flex items-center justify-center text-white text-lg font-bold mr-3"
                          style={{ backgroundColor: stringToColor(base.id) }}
                        >
                          {base.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{base.name}</p>
                          <div className="relative h-5">
                            <p className="absolute inset-0 flex items-center gap-1 text-sm text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Database className="w-4 h-4" /> Open data
                            </p>
                            <p className="absolute inset-0 text-xs text-gray-400 group-hover:opacity-0 transition-opacity">
                              Opened {formatDistanceToNow(new Date(base.updatedAt))} ago
                            </p>
                          </div>
                        </div>

                        <div className="relative z-20">
                          <button
                            className="p-1 rounded hover:bg-gray-100"
                            onClick={(e) => {
                              e.stopPropagation(); // prevent redirect
                              setActiveMenuBaseId(base.id);
                            }}
                          >
                            <Ellipsis className="w-4 h-4" />
                          </button>

                          {activeMenuBaseId === base.id && (
                            <div className="absolute right-0 mt-2 w-28 bg-white border border-gray-200 rounded-md shadow-lg z-30">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteBaseId(base.id);
                                  setActiveMenuBaseId(null);
                                }}
                                className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {confirmDeleteBaseId === base.id && (
                        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                          <div className="bg-white p-6 rounded shadow-lg z-50 w-[300px]">
                            <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
                            <p className="mb-4">Are you sure you want to move this base to trash?</p>
                            <div className="flex justify-end gap-2">
                              <button
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                                onClick={() => setConfirmDeleteBaseId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm"
                                onClick={() => handleDelete(base)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {isCreating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gray-800 border-opacity-75" />
                <span className="text-gray-700 text-sm">Creating base...</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}