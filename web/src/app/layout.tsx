import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-dvh bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800">
          <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-semibold">Besu Web2</Link>
            <Link href="/docs" className="text-sm text-zinc-300">Docs</Link>
            <Link href="/networks" className="text-sm text-zinc-300">Networks</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
