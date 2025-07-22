
import { Bell, HelpCircle, Plus, Search } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export default function HomeDashboard() {
  const { user } = useUser();
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r p-4 flex flex-col justify-between">
        <div>
          <div className="text-lg font-semibold mb-6">Airtable</div>
          <nav className="flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-800">Home</div>
            <div className="text-sm text-gray-500">Starred</div>
            <div className="text-sm text-gray-500">Shared</div>
            <div className="text-sm text-gray-500">Workspaces</div>
          </nav>
        </div>
        <div className="mb-4">
          <button className="w-full flex items-center justify-center border border-gray-300 rounded px-3 py-2 hover:bg-gray-100">
            <Plus className="w-4 h-4 mr-2" />
            Create
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="search"
            placeholder="Search..."
            className="w-1/3 px-4 py-2 border rounded"
          />
          <div className="flex gap-4 items-center">
            <HelpCircle className="text-gray-500" />
            <Bell className="text-gray-500" />
            {user?.imageUrl && (
              <Image
                src={user.imageUrl}
                alt="Profile Image"
                className="w-8 h-8 rounded-full cursor-pointer"
                width={40}
                height={40}
              />
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xl font-medium text-gray-800 mb-1">Home</div>
          <p className="text-sm text-gray-500">Opened anytime</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Start with Omni",
              desc: "Use AI to build a custom app tailored to your workflow",
            },
            {
              title: "Start with templates",
              desc: "Select a template to get started and customize",
            },
            {
              title: "Quickly upload",
              desc: "Easily migrate existing projects",
            },
            {
              title: "Build an app on your own",
              desc: "Start with a blank app",
            },
          ].map((card, index) => (
            <div
              key={index}
              className="border rounded p-4 text-sm text-center shadow-sm"
            >
              <p className="font-semibold">{card.title}</p>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>

        <hr className="my-6 border-gray-200" />

        <div className="text-sm text-center text-gray-500">
          You haven't opened anything recently
          <div>
            <button className="mt-2 px-3 py-1 border rounded text-sm hover:bg-gray-100">
              Go to all workspaces
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
