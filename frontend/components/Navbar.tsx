"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useRef, useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ===============================
  // Detect scroll to enhance visibility
  // ===============================
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ===============================
  // Close dropdown on outside click
  // ===============================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItem = (href: string, label: string) => {
    const active = pathname === href;

    return (
      <Link
        href={href}
        className={`px-4 py-2 rounded-md text-sm transition-all ${
          active
            ? "bg-white/10 text-white"
            : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className={`
        fixed top-0 left-0 w-full z-50
        transition-all duration-300
        ${
          scrolled
            ? "bg-black/80 backdrop-blur-md border-b border-[var(--border-subtle)] opacity-100"
            : "bg-black/40 backdrop-blur-sm opacity-80"
        }
        hover:opacity-100 hover:bg-black/80
      `}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center px-10 py-4">

        {/* Left Section */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight"
          >
            Supplier Risk Intelligence
          </Link>

          {user && (
            <div className="flex items-center gap-2">
              {navItem("/suppliers", "Suppliers")}
              {navItem("/comparison", "Comparison")}

              {user.role === "ADMIN" &&
                navItem("/admin/config", "Admin Config")}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4 relative">
          {user ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-md transition flex items-center gap-2"
              >
                {user.username}
                <span className="text-xs opacity-70">▼</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-[#0f172a] border border-[var(--border-subtle)] rounded-md shadow-lg overflow-hidden">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      router.push("/profile");
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition"
                  >
                    View Profile
                  </button>

                  <button
                    onClick={async () => {
                      setDropdownOpen(false);
                      await logout();
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="px-5 py-2 text-sm bg-gradient-to-r from-indigo-600/80 to-blue-600/70 hover:from-indigo-500 hover:to-blue-500 border border-indigo-400/25 rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] hover:-translate-y-0.5"
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="px-5 py-2 text-sm border border-zinc-700/70 hover:border-zinc-500 text-gray-300 hover:text-white rounded-lg transition-all duration-300 hover:bg-white/[0.03] hover:-translate-y-0.5"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
