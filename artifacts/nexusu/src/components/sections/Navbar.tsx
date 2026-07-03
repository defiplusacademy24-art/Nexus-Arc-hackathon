import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Sun, Moon, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useTheme } from 'next-themes';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isDark = resolvedTheme === 'dark';

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Architecture', href: '#architecture' },
    { name: 'Use Cases', href: '#use-cases' },
    { name: 'Technology', href: '#technology' },
    { name: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      role="banner"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 dark:bg-[#1B1917]/95 backdrop-blur-md border-b border-orange-100 dark:border-white/8 py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-6 max-w-7xl flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 z-50 group" aria-label="Nexusu home">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0 flex items-center justify-center shadow-sm" aria-hidden="true">
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-[#1B1917] dark:text-white">
            Nexusu
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-stone-500 dark:text-white/60 hover:text-[#1B1917] dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] rounded"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/docs"
              className="flex items-center gap-1.5 text-sm font-medium text-stone-500 dark:text-white/60 hover:text-[#1B1917] dark:hover:text-white transition-colors px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] rounded"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              Docs
            </a>

            {mounted && (
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-orange-200 dark:border-white/15 text-stone-400 dark:text-white/50 hover:text-[#E8461E] dark:hover:text-white hover:border-orange-300 dark:hover:border-white/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E]"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" aria-hidden="true" /> : <Moon className="w-3.5 h-3.5" aria-hidden="true" />}
              </button>
            )}

            <a
              href="/app"
              className="bg-[#E8461E] hover:bg-[#D03D18] text-white px-5 py-2 rounded-full text-sm font-semibold transition-colors shadow-[0_2px_12px_rgba(232,70,30,0.30)] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] focus-visible:ring-offset-2"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        </nav>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2 z-50">
          {mounted && (
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-orange-200 dark:border-white/15 text-stone-400 dark:text-white/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E]"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" aria-hidden="true" /> : <Moon className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          )}
          <button
            className="w-8 h-8 flex items-center justify-center text-[#1B1917] dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] rounded"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              id="mobile-menu"
              aria-label="Mobile navigation"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="absolute top-0 left-0 w-full min-h-screen bg-white dark:bg-[#1B1917] pt-20 px-6 pb-10 flex flex-col"
            >
              <div className="flex flex-col gap-1 mb-8">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-3 text-xl font-display font-semibold text-[#1B1917] dark:text-white border-b border-orange-100 dark:border-white/8 focus-visible:outline-none focus-visible:text-[#E8461E]"
                  >
                    {link.name}
                  </a>
                ))}
                <a
                  href="/docs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 text-xl font-display font-semibold text-[#1B1917] dark:text-white border-b border-orange-100 dark:border-white/8 flex items-center gap-2 focus-visible:outline-none focus-visible:text-[#E8461E]"
                >
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                  Docs
                </a>
              </div>
              <a
                href="/app"
                className="w-full bg-[#E8461E] hover:bg-[#D03D18] text-white py-4 rounded-2xl text-base font-semibold transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8461E] focus-visible:ring-offset-2"
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
