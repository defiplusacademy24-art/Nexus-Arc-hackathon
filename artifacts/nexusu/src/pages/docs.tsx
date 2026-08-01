import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Menu,
  X,
} from 'lucide-react';
import { NexusuLogo } from '@/components/NexusuLogo';
import productDocs from '@/content/product-docs.md?raw';

type TocItem = { id: string; title: string; level: 2 | 3 };

const META = [
  { label: 'Version', value: '1.0' },
  { label: 'Status', value: 'Arc Hackathon MVP' },
  { label: 'Network', value: 'Arc Testnet' },
  { label: 'Stablecoin', value: 'USDC' },
  { label: 'AI', value: 'Circle Agent Stack' },
] as const;

const ARCH_STEPS = [
  'Users',
  'Frontend',
  'Backend API',
  'Circle User-Controlled Wallets',
  'Arc Smart Contracts',
  'Circle Agent Stack',
  'Autonomous AI Agents',
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function textFromChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join('');
  }
  if (children && typeof children === 'object' && 'props' in children) {
    return textFromChildren(
      (children as { props?: { children?: ReactNode } }).props?.children,
    );
  }
  return '';
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

function ArchitectureDiagram() {
  return (
    <div
      className="not-prose my-6 rounded-2xl border border-stone-200 dark:border-[#1A2A3A] bg-stone-50 dark:bg-[#0c1826] p-4 sm:p-6"
      role="img"
      aria-label="System architecture flow from users to AI agents"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-white/40 mb-4">
        Request flow
      </p>
      <ol className="flex flex-col items-stretch gap-0 max-w-md mx-auto">
        {ARCH_STEPS.map((step, i) => (
          <li key={step} className="flex flex-col items-center">
            <div className="w-full rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#132334] px-4 py-3 text-center shadow-sm">
              <span className="text-[10px] font-semibold text-[#6393C4] uppercase tracking-wide">
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-stone-800 dark:text-white mt-0.5">
                {step}
              </p>
            </div>
            {i < ARCH_STEPS.length - 1 && (
              <ArrowDown
                className="w-4 h-4 my-1.5 text-stone-400 dark:text-white/35"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
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
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#030F1F] text-stone-800 dark:text-white/90">
      <header className="sticky top-0 z-40 border-b border-stone-200 dark:border-[#1A2A3A] bg-white/95 dark:bg-[#030F1F]/95 backdrop-blur-sm">
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
              className="lg:hidden w-9 h-9 rounded-lg border border-stone-200 dark:border-white/10 flex items-center justify-center text-stone-600 dark:text-white/70"
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
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 bg-[#6393C4] hover:bg-[#5289B8] text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 lg:py-10 flex gap-10">
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
                    ? 'bg-[#6393C4]/10 text-[#3d6fa3] dark:text-[#77A6DB] font-semibold'
                    : 'text-stone-500 dark:text-white/45 hover:text-stone-800 dark:hover:text-white/80'
                }`}
              >
                {item.title}
              </button>
            ))}
          </nav>
        </aside>

        {mobileNav && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close"
              onClick={() => setMobileNav(false)}
            />
            <nav className="absolute left-0 top-0 bottom-0 w-[min(20rem,85vw)] bg-white dark:bg-[#081827] border-r border-stone-200 dark:border-[#1A2A3A] p-4 overflow-y-auto shadow-xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-white/40 mb-3">
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

        <article className="min-w-0 flex-1 max-w-3xl">
          {/* Hero + meta grid (replaces broken empty-header markdown table) */}
          <div className="mb-8 rounded-2xl border border-stone-200 dark:border-[#1A2A3A] bg-stone-50 dark:bg-[#0c1826] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6393C4] mb-2">
              Product documentation
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#030F1F] dark:text-white mb-1">
              Nexusu
            </h1>
            <p className="text-base font-medium text-stone-600 dark:text-white/70 mb-5">
              The Operating System for Community Finance
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {META.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#132334] px-3.5 py-2.5 flex items-baseline justify-between gap-3"
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-white/40 shrink-0">
                    {row.label}
                  </dt>
                  <dd className="text-sm font-semibold text-stone-800 dark:text-white text-right">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            className="
              docs-prose prose prose-stone dark:prose-invert max-w-none
              prose-headings:font-display prose-headings:scroll-mt-24
              prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-3
              prose-h2:border-b prose-h2:border-stone-200 dark:prose-h2:border-white/10 prose-h2:pb-2
              prose-h2:text-stone-900 dark:prose-h2:text-white
              prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2
              prose-h3:text-stone-800 dark:prose-h3:text-white/90
              prose-p:text-sm prose-p:leading-relaxed prose-p:text-stone-600 dark:prose-p:text-white/65
              prose-li:text-sm prose-li:text-stone-600 dark:prose-li:text-white/65
              prose-strong:text-stone-800 dark:prose-strong:text-white/90
              prose-code:text-[13px] prose-code:font-normal
              prose-code:bg-stone-100 dark:prose-code:bg-white/10
              prose-code:text-stone-800 dark:prose-code:text-white/85
              prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-a:text-[#6393C4] hover:prose-a:underline
            "
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const text = textFromChildren(children);
                  return <h2 id={slugify(text)}>{children}</h2>;
                },
                h3: ({ children }) => {
                  const text = textFromChildren(children);
                  return <h3 id={slugify(text)}>{children}</h3>;
                },
                table: ({ children }) => (
                  <div className="not-prose my-5 overflow-x-auto rounded-xl border border-stone-200 dark:border-white/10 shadow-sm">
                    <table className="w-full text-sm text-left border-collapse min-w-[16rem]">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-stone-100 dark:bg-white/5">{children}</thead>
                ),
                tbody: ({ children }) => (
                  <tbody className="divide-y divide-stone-100 dark:divide-white/5 bg-white dark:bg-transparent">
                    {children}
                  </tbody>
                ),
                tr: ({ children }) => <tr>{children}</tr>,
                th: ({ children }) => (
                  <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-white/45 whitespace-nowrap">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3.5 py-2.5 text-stone-700 dark:text-white/75 align-top">
                    {children}
                  </td>
                ),
                pre: ({ children }) => {
                  // Detect ```architecture fence → visual diagram
                  const child = Array.isArray(children) ? children[0] : children;
                  const className =
                    child &&
                    typeof child === 'object' &&
                    'props' in child
                      ? String(
                          (child as { props?: { className?: string } }).props
                            ?.className ?? '',
                        )
                      : '';
                  if (className.includes('language-architecture')) {
                    return <ArchitectureDiagram />;
                  }
                  return (
                    <pre className="not-prose my-4 overflow-x-auto rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-[#0c1826] p-4 text-[13px] leading-relaxed text-stone-700 dark:text-white/80 font-mono">
                      {children}
                    </pre>
                  );
                },
                code: ({ className, children, ...props }) => {
                  const isBlock = Boolean(className);
                  if (isBlock) {
                    return (
                      <code className={`${className ?? ''} font-mono text-[13px] text-inherit`} {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="font-mono text-[13px] bg-stone-100 dark:bg-white/10 text-stone-800 dark:text-white/85 px-1.5 py-0.5 rounded"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => (
                  <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[#6393C4]">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-[#6393C4] marker:font-semibold">
                    {children}
                  </ol>
                ),
              }}
            >
              {productDocs}
            </ReactMarkdown>
          </div>

          <div className="mt-12 pt-6 border-t border-stone-200 dark:border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 dark:text-white/50 hover:text-[#6393C4]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-1.5 bg-[#6393C4] hover:bg-[#5289B8] text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
