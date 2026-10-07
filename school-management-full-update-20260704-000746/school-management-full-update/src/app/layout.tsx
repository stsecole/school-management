import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "نظام إدارة المؤسسة التعليمية",
  description: "نظام متكامل لإدارة الطلاب والأساتذة والأقسام والشؤون المالية",
  keywords: ["إدارة مدرسة", "طلاب", "أساتذة", "مؤسسة تعليمية"],
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "نظام الإدارة" },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        <link rel="icon" type="image/svg+xml" href="/icon-192.svg" />
      </head>
      <body
        className={`${tajawal.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
      >
        {children}
        <Toaster />
        <PWARegister />
      </body>
    </html>
  );
}

function PWARegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                console.log('[PWA] SW registered:', registration.scope);
              }).catch(function(err) {
                console.warn('[PWA] SW registration failed:', err);
              });
            });
          }
        `,
      }}
    />
  );
}
