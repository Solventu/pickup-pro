"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Clock, Users } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/feed", label: "Feed" },
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Sign up" },
];

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3 sm:text-left">
          {/* Column 1 — Brand */}
          <div>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <span className="live-dot" aria-hidden />
              <span className="text-lg font-bold tracking-tight">
                PICKUP<span className="text-accent">PRO</span>
              </span>
            </div>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted sm:mx-0">
              The platform for pickup games and official competitions — live,
              worldwide, without the hassle.
            </p>
            <p className="mono mt-4 flex items-center justify-center gap-2 text-xs text-muted sm:justify-start">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              LIVE · Worldwide
            </p>
          </div>

          {/* Column 2 — Navigation */}
          <div>
            <h4 className="text-sm font-medium text-fg">Navigation</h4>
            <ul className="mono mt-4 flex flex-col gap-2.5 text-sm">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={`transition-colors duration-150 ${
                        isActive
                          ? "text-[#e8e8f2]"
                          : "text-[#9b9bb3] hover:text-[#e8e8f2]"
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Column 3 — About */}
          <div>
            <h4 className="text-sm font-medium text-fg">About</h4>
            <ul className="mono mt-4 flex flex-col gap-2.5 text-sm text-muted">
              <li className="flex items-center justify-center gap-2 sm:justify-start">
                <MapPin size={13} aria-hidden /> Worldwide
              </li>
              <li className="flex items-center justify-center gap-2 sm:justify-start">
                <Clock size={13} aria-hidden /> Updated in real time
              </li>
              <li className="flex items-center justify-center gap-2 sm:justify-start">
                <Users size={13} aria-hidden /> Open community
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mono mt-10 flex flex-col gap-2 border-t border-line pt-6 text-center text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span>© 2026 PickupPro</span>
          <span>Built by Erik · v1.0</span>
        </div>
      </div>
    </footer>
  );
}
