import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ArrowRight, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useTheme } from 'next-themes';
import { NexusuLogo } from '@/components/NexusuLogo';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDark = resolvedTheme === 'dark';

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'How it works', href: '#how' },
    { name: 'Docs', href: '/docs' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      role="banner"
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        isScrolled
          ? 'bg-white/95 dark:bg-[#030F1F]/95 backdrop-blur-sm border-b border-stone-200/80 dark:border-[#1A2A3A]'
          : 'bg-white/80 dark:bg-[#030F1F]/80 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="container mx-auto px-5 sm:px-6 max-w-5xl h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Nexusu home">
          <NexusuLogo size="md" />
          <span className="font-display font-bold text-lg text-[#030F1F] dark:text-white">Nexusu</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm text-stone-600 dark:text-white/65 hover:text-[#030F1F] dark:hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}

          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-md flex items-center justify-center border border-stone-200 dark:border-[#1A2A3A] text-stone-500 dark:text-white/50 hover:text-[#6393C4] transition-colors"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}

          <a
            href="/app"
            className="bg-[#6393C4] hover:bg-[#5289B8] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5"
          >
            Launch App
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </nav>

        <div className="md:hidden flex items-center gap-2">
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-md flex items-center justify-center border border-stone-200 dark:border-[#1A2A3A] text-stone-500"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center text-[#030F1F] dark:text-white"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 bg-white dark:bg-[#030F1F] border-b border-stone-200 dark:border-[#1A2A3A] px-5 py-4 flex flex-col gap-1 md:hidden shadow-sm"
            >
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-sm font-medium text-[#030F1F] dark:text-white"
                >
                  {link.name}
                </a>
              ))}
              <a
                href="/app"
                className="mt-2 bg-[#6393C4] text-white py-3 rounded-lg text-center text-sm font-semibold"
              >
                Launch App
              </a>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}