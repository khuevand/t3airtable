import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import AiBuilderBox from "~/components/aiBuilders";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight
} from "lucide-react";

export default function Home() {
  return (
    <>
      <Head>
        <title>t3Airtable</title>
        <meta name="description" content="Airtable clone with T3 stack" />
        <link rel="icon" href="/favicon.ico" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <main className="min-h-screen bg-white text-black">
        {/* Header */}
        <header className="flex items-center justify-center px-10 py-2 bg-[#f6f9ff] border-b border-slate-100">
          <div className="flex items-center gap-2">
            <p className="text-base text-slate-800">
              Meet Omni, your AI collaborator for building custom apps
            </p>
            <Link
              href="#"
              className="flex items-center gap-1 text-base font-medium text-blue-700 hover:underline">
              <span>See what's possible</span>
              <ArrowRight className="w-4 h-4 text-blue-700" />
            </Link>
          </div>
        </header>
    
        <section className="flex items-center justify-between px-10 py-5 bg-[#f7f8f1] border-b border-slate-100 hover:bg-[#ffffff]">
          <div className="flex items-center gap-13">
            <Link href="/">
              <div className="text-2xl font-bold text-gray-800">Airtable</div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-5 text-lg font-semibold text-gray-900">
              <Link href="#" className="flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <span>Platform</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="#" className="flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <span>Solutions</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="#" className="flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <span>Resources</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Link>
              <Link href="#" className="flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <span>Enterprise</span>
              </Link>
              <Link href="#" className="flex items-center gap-1 hover:text-blue-800 cursor-pointer">
                <span>Pricing</span>
              </Link>
            </nav>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <button className="rounded-xl border border-black px-4 py-3 text-lg font-medium hover:bg-gray-100">
              Book Demo
            </button>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-xl bg-black px-4 py-3 text-lg font-medium text-white hover:bg-gray-900">
                  Sign up for free
                </button>
              </SignInButton>

              <SignInButton mode="modal">
                <button className="text-lg font-semibold text-black hover:text-gray-700">
                  Log in
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <SignOutButton>
                <button className="rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600">
                  Sign Out
                </button>
              </SignOutButton>
            </SignedIn>
          </div>
        </section>

        {/* Hero Section */}
        <section className="text-center py-20 bg-[#f9f9f5] font-sans">
          <h1 className="max-w-3xl mx-auto text-[48px] font-[490] leading-[1.1] text-gray-800">
            From idea to app in an instant
          </h1>
          <p className="mt-1 max-w-3xl mx-auto text-[48px] font-[490] leading-[1.1] text-gray-800">
            Build with AI that means business
          </p>
          <AiBuilderBox />
          <SignedIn>
            <Link href="/dashboard">
              <button className="mt-8 rounded bg-green-600 px-6 py-3 text-lg text-white hover:bg-green-700">
                Go to Dashboard
              </button>
            </Link>
          </SignedIn>
        </section>

        {/* Optional: Add feature highlights or footer here */}
      </main>
    </>
  );
}
