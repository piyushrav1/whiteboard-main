import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stream-Sync Whiteboard",
  description: "Real-time collaborative whiteboard with MongoDB persistence"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
