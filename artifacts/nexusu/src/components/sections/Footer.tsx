import { Link } from 'wouter';
import { NexusuLogo } from '@/components/NexusuLogo';

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-[#030F1F] py-8 border-t border-white/8">
      <div className="container mx-auto px-6 max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Nexusu home">
          <NexusuLogo size="sm" />
          <span className="font-display font-semibold text-white text-sm">Nexusu</span>
        </Link>
        <p className="text-white/30 text-xs">© {year} Nexusu</p>
        <nav className="flex gap-5 text-xs" aria-label="Footer links">
          <Link href="/docs" className="text-white/40 hover:text-white transition-colors">
            Docs
          </Link>
          <a href="#faq" className="text-white/40 hover:text-white transition-colors">
            FAQ
          </a>
          <Link href="/app" className="text-white/40 hover:text-white transition-colors">
            App
          </Link>
        </nav>
      </div>
    </footer>
  );
}