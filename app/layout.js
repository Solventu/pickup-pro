import { Space_Grotesk, DM_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import { ToastProvider } from "@/lib/ToastProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EventChatbot from "@/components/EventChatbot";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata = {
  title: "PickupPro — Find your next game in Timișoara",
  description:
    "Discover pickup sports games, follow local athletes, and join the community in Timișoara.",
};

// maximumScale: 1 stops iOS Safari from auto-zooming when an input is focused
// (paired with the 16px font-size rule in globals.css). Next.js renders this as
// the <meta name="viewport"> tag — using the viewport export avoids the warning
// Next emits when a viewport is placed in the metadata export instead.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmMono.variable}`}>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <Footer />
            <EventChatbot />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
