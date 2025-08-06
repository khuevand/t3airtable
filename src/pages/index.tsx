import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
  useUser
} from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AiBuilderBox from "~/components/aiBuilders";
import Head from "next/head";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  ChevronRight
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
  if (isSignedIn && router.pathname === "/") {
    void router.push("/home");
  }
  }, [isSignedIn, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false); 
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

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
              className="flex items-center gap-1 text-base font-medium text-blue-700 hover:underline cursor-pointer">
              <span>See what&apos;s possible</span>
              <ArrowRight className="w-4 h-4 text-blue-700" />
            </Link>
          </div>
        </header>
    
        <section className="flex items-center justify-between px-10 py-4 bg-[#f7f8f1] border-b border-slate-100 hover:bg-[#ffffff]">
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
          {isLoading ? (
            <div className="absolute inset-0 bg-white flex justify-center items-center z-10">
              <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-gray-800"></div>
            </div>
            ) : (
            <>
              <h1 className="max-w-3xl mx-auto text-[48px] font-[490] leading-[1.1] text-gray-800">
                From idea to app in an instant
              </h1>
              <p className="mt-1 max-w-3xl mx-auto text-[48px] font-[490] leading-[1.1] text-gray-800">
                Build with AI that means business
              </p>
              <AiBuilderBox/>
              <SignedIn>
              </SignedIn>
             </>
          )}
        </section>

        <section className="relative px-10 ml-30">
          <h1 className="mt-25 max-w-3xl text-left text-[48px] font-[500] leading-[1.1] text-gray-800">
            See what others are building
          </h1>
          <div className="mt-10 flex items-start gap-110">
            <p className="max-w-5xl text-left text-[25px] font-[490] leading-[1.1] text-gray-800">
              Skip the code. Transform your data into custom interfaces, automations, and agents with Airtable&apos;s AI-native app platform.
            </p>
            <div className="flex justify-center gap-2">
              <button className="flex items-center gap-2 rounded-full border px-3 py-3 bg-black text-base text-white font-semibold hover:bg-slate-700">
                  <ArrowLeft className="w-4 h-4 cursor-pointer" />
              </button>
              <button className="flex items-center gap-2 rounded-full border px-3 py-3 bg-black text-base text-white font-semibold hover:bg-slate-700">
                  <ArrowRight className="w-4 h-4 cursor-pointer" />
              </button>
            </div>
          </div>
        </section>
        {/* Optional: Add feature highlights or footer here */}
      </main>
    </>
  );
}
