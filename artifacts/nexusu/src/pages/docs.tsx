import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ArrowRight, BookOpen, Menu, X } from 'lucide-react';
import { NexusuLogo } from '@/components/NexusuLogo';
import productDocs from '@/content/product-docs.md?raw';

type TocItem = { id: string; title: string; level: 2 | 3 };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.+)$/.exec(line);
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h2) items.push({ id: slugify(h2[1]), title: h2[1], level: 2 });
    else if (h3) items.push({ id: slugify(h3[1]), title: h3[1], level: 3 });
  }
  return items;
}

export default function DocsPage() {
  const toc = useMemo(() => extractToc(productDocs), []);
  const [activeId, setActiveId] = useState(toc[0]?.id ?? '');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const headings = toc
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    for (const el of headings) observer.observe(el);
    return () => observer.disconnect();
  }, [toc]);

  const scrollTo = (id: string) => {
    setMobileNav(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background text-stone-800 dark:text-white/90">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 dark:border-[#1A2A3A] bg-white/95 dark:bg-[#030F1F]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="Nexusu home">
              <NexusuLogo size="sm" />
              <span className="font-display font-bold text-[#030F1F] dark:text-white hidden sm:inline">
                Nexusu
              </span>
            </Link>
            <span className="text-stone-300 dark:text-white/20 hidden sm:inline">/</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 dark:text-white/70 truncate">
              <BookOpen className="w-3.5 h-3.5 text-[#6393C4] shrink-0" />
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="lg:hidden w-9 h-9 rounded-lg border border-stone-200 dark:border-white/10 flex items-center justify-center"
              onClick={() => setMobileNav((v) => !v)}
              aria-label={mobileNav ? 'Close table of contents' : 'Open table of contents'}
            >
              {mobileNav ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-white/50 hover:text-[#6393C4] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
            <a
              href="/app"
              className="inline-flex items-center gap-1.5 bg-[#6393C4] hover:bg-[#5289B8] text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-10 flex gap-10">
        {/* Desktop TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav
            className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-0.5"
            aria-label="Table of contents"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/35 mb-3 px-2">
              On this page
            </p>
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`block w-full text-left text-[13px] rounded-md px-2 py-1.5 transition-colors ${
                  item.level === 3 ? 'pl-4' : ''
                } ${
                  activeId === item.id
                    ? 'bg-[#6393C4]/10 text-[#5289B8] dark:text-[#77A6DB] font-semibold'
                    : 'text-stone-500 dark:text-white/45 hover:text-stone-800 dark:hover:text-white/80'
                }`}
              >
                {item.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile TOC drawer */}
        {mobileNav && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close"
              onClick={() => setMobileNav(false)}
            />
            <nav className="absolute left-0 top-0 bottom-0 w-[min(20rem,85vw)] bg-white dark:bg-[#081827] border-r border-stone-200 dark:border-[#1A2A3A] p-4 overflow-y-auto shadow-xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
                On this page
              </p>
              {toc.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={`block w-full text-left text-sm rounded-md px-2 py-2 ${
                    item.level === 3 ? 'pl-4' : ''
                  } ${
                    activeId === item.id
                      ? 'bg-[#6393C4]/10 text-[#6393C4] font-semibold'
                      : 'text-stone-600 dark:text-white/60'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Content */}
        <article className="min-w-0 flex-1 max-w-3xl">
          <div className="mb-8 rounded-2xl border border-stone-100 dark:border-[#1A2A3A] bg-gradient-to-br from-[#6393C4]/10 to-transparent dark:from-[#6393C4]/15 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6393C4] mb-2">
              Product docs · v1.0
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#030F1F] dark:text-white mb-2">
              The Operating System for Community Finance
            </h1>
            <p className="text-sm text-stone-500 dark:text-white/50 leading-relaxed">
              Arc Testnet · USDC · Circle Agent Stack · Arc Hackathon MVP
            </p>
          </div>

          <div className="docs-prose prose prose-stone dark:prose-invert max-w-none
            prose-headings:font-display prose-headings:scroll-mt-24
            prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4
            prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-3 prose-h2:border-b prose-h2:border-stone-100 dark:prose-h2:border-white/10 prose-h2:pb-2
            prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-sm prose-p:leading-relaxed prose-p:text-stone-600 dark:prose-p:text-white/65
            prose-li:text-sm prose-li:text-stone-600 dark:prose-li:text-white/65
            prose-strong:text-stone-800 dark:prose-strong:text-white/90
            prose-code:text-[13px] prose-code:bg-stone-100 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-[#081827] prose-pre:border prose-pre:border-white/10 prose-pre:text-sm
            prose-table:text-sm
            prose-th:text-left prose-th:font-semibold
            prose-a:text-[#6393C4] hover:prose-a:underline
          ">
            <ReactMarkdown
              components={{
                h1: ({ children }) => {
                  const text = String(children);
                  // Skip duplicate top title — covered by hero
                  if (text === 'Nexusu') return null;
                  return (
                    <h1 id={slugify(text)}>{children}</h1>
                  );
                },
                h2: ({ children }) => {
                  const text = String(children);
                  // Skip subtitle already in hero
                  if (text === 'The Operating System for Community Finance') return null;
                  return (
                    <h2 id={slugify(text)}>{children}</h2>
                  );
                },
                h3: ({ children }) => {
                  const text = String(children);
                  return <h3 id={slugify(text)}>{children}</h3>;
                },
              }}
            >
              {productDocs}
            </ReactMarkdown>
          </div>

          <div className="mt-12 pt-6 border-t border-stone-100 dark:border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#6393C4]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-1.5 bg-[#6393C4] hover:bg-[#5289B8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
