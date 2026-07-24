/**
 * Official Nexusu mark — white tile in light mode, dark tile in dark mode.
 */

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

interface NexusuLogoProps {
  /** Outer box size in px (Tailwind classes preferred via sizeClass). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Decorative when parent provides accessible name. */
  decorative?: boolean;
}

const sizeClass = {
  sm: 'w-7 h-7 rounded-md',
  md: 'w-8 h-8 rounded-lg',
  lg: 'w-12 h-12 rounded-2xl',
} as const;

export function NexusuLogo({
  size = 'md',
  className,
  decorative = true,
}: NexusuLogoProps) {
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center overflow-hidden border shadow-sm',
        // Light: white plate · Dark: project navy surface
        'bg-white border-stone-200',
        'dark:bg-[#030F1F] dark:border-[#1A2A3A]',
        sizeClass[size],
        className,
      )}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="/logo.png"
        alt={decorative ? '' : 'Nexusu'}
        className="h-full w-full object-contain p-0.5"
      />
    </div>
  );
}
