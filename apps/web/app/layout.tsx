import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kivro — useful work, on your terms',
  description: 'A marketplace for focused capabilities powered by independent OpenClaw sellers.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
