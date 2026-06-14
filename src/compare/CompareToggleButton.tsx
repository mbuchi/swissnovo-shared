import { Scale, Check } from 'lucide-react';

/**
 * Suite-standard "pin to comparison" toggle button.
 *
 * The single canonical compare-toggle design across every aireon app — a small
 * square icon button that pins/unpins the current parcel or location into a
 * comparison set. Lifted verbatim from valoo's reference button so scoore (and
 * any future app) renders the exact same control instead of forking its own.
 *
 * Presentational only: it owns no state and resolves no translations. The host
 * passes the current `pinned` flag, an `onToggle` handler, and the two strings
 * via `labels` — the suite-standard label-injection pattern (see MapUserMenu /
 * ParcelAerialThumbnail / ComparablesPanel). Engine- and i18n-agnostic.
 */

/** The two translatable strings the button needs, injected by the host app. */
export interface CompareToggleButtonLabels {
  /** title / aria-label when NOT pinned (e.g. "Add to comparison"). */
  pin: string;
  /** title / aria-label when pinned (e.g. "Remove from comparison"). */
  unpin: string;
}

export interface CompareToggleButtonProps {
  /** Whether this parcel/location is currently in the comparison set. */
  pinned: boolean;
  /** Fired on click — host adds or removes from its comparison state. */
  onToggle: () => void;
  /** Dark-mode styling toggle. */
  dark?: boolean;
  /** i18n strings — injected, never resolved inside the shared component. */
  labels: CompareToggleButtonLabels;
  /** Optional extra classes appended to the button. */
  className?: string;
}

export function CompareToggleButton({
  pinned,
  onToggle,
  dark = false,
  labels,
  className,
}: CompareToggleButtonProps) {
  const label = pinned ? labels.unpin : labels.pin;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={pinned}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 ${
        pinned
          ? dark
            ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/30'
            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          : dark
            ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] ring-1 ring-white/[0.06]'
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200'
      }${className ? ` ${className}` : ''}`}
    >
      {pinned ? (
        <Check className="w-3.5 h-3.5" aria-hidden />
      ) : (
        <Scale className="w-3.5 h-3.5" aria-hidden />
      )}
    </button>
  );
}

export default CompareToggleButton;
