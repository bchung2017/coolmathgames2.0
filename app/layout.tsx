import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "coolmathgames 2.0",
  description:
    "Teaching games that fill a pedagogically load-bearing template — one game generated for one student's confusion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* default skin; the role toggle swaps body.className client-side */}
      <body className="role-student">
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
