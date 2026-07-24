import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Crown, Copy, Check, Camera, Loader2, Trash2 } from 'lucide-react';
import type { ProfilePrefs } from '@/services/profile';
import { fileToAvatarDataUrl } from '@/services/profile';
import type { IdentityDetails } from '@/hooks/useIdentity';
import { useCooperative } from '@/providers/CooperativeProvider';
import { UserAvatar } from '@/components/profile/UserAvatar';

interface ProfileHeaderProps {
  identity: IdentityDetails;
  prefs: ProfilePrefs;
  onAvatarChange: (dataUrl: string) => void;
  onAvatarClear: () => void;
}

function CopyableAddress({
  address,
  shortAddress,
}: {
  address: string;
  shortAddress: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = address;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={copied ? 'Copied!' : `Copy ${address}`}
      className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-[#2E3B4B]/35 border border-stone-200 dark:border-[#1A2A3A] hover:border-[#6393C4]/40 dark:hover:border-[#6393C4]/30 hover:bg-[#6393C4]/5 dark:hover:bg-[#6393C4]/8 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-[9px] font-semibold text-stone-400 dark:text-white/25 uppercase tracking-widest mb-0.5">
          Wallet
        </p>
        <p className="text-xs font-mono text-stone-600 dark:text-white/60 group-hover:text-stone-800 dark:group-hover:text-white/80 transition-colors">
          {shortAddress}
        </p>
      </div>
      <span
        className={`flex-shrink-0 p-1 rounded-md transition-colors ${
          copied
            ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
            : 'text-stone-400 dark:text-white/30 group-hover:text-[#6393C4] group-hover:bg-[#6393C4]/10'
        }`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
}

export function ProfileHeader({
  identity,
  prefs,
  onAvatarChange,
  onAvatarClear,
}: ProfileHeaderProps) {
  const { activeCooperative } = useCooperative();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    prefs.displayNameOverride.trim() || identity.displayName;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      onAvatarChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-white dark:bg-stone-900/60 border border-stone-100 dark:border-[#1A2A3A] p-6 mb-6"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#6393C4]/4 via-transparent to-[#77A6DB]/3 pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Avatar + upload */}
        <div className="relative group">
          <UserAvatar
            prefs={prefs}
            displayName={displayName}
            size="xl"
            rounded="2xl"
            className="shadow-lg"
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
            aria-label="Upload profile photo"
          >
            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-white text-[10px] font-semibold">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Change
                </>
              )}
            </span>
          </button>
          {prefs.avatarUrl && (
            <button
              type="button"
              onClick={onAvatarClear}
              title="Remove photo"
              className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 shadow-sm flex items-center justify-center text-stone-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Identity info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold text-stone-900 dark:text-white leading-tight mb-0.5">
            {displayName}
          </h1>

          {identity.nametag && (
            <p className="text-sm text-stone-400 dark:text-white/40 font-mono mb-2">
              @{identity.nametag}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[#6393C4]" />
              <span className="text-sm text-stone-600 dark:text-white/65 font-medium">
                Founder
              </span>
            </div>
            <span className="text-stone-200 dark:text-white/15">·</span>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-400 dark:text-white/30" />
              <span className="text-sm text-stone-500 dark:text-white/50">
                {activeCooperative?.name ?? 'No cooperative yet'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 dark:text-white/30 mt-2">
            Hover the photo to upload a profile image (PNG, JPG, or WebP).
          </p>
          {error && (
            <p className="text-[11px] text-red-500 mt-1">{error}</p>
          )}

          <div className="mt-3 md:hidden">
            <CopyableAddress
              address={identity.walletAddress}
              shortAddress={identity.shortAddress}
            />
          </div>
        </div>

        <div className="flex-shrink-0 hidden md:block">
          <CopyableAddress
            address={identity.walletAddress}
            shortAddress={identity.shortAddress}
          />
        </div>
      </div>
    </motion.div>
  );
}
