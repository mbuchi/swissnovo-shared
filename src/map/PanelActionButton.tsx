import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Suite-standard icon-only action button for parcel/info side panels.
 *
 * The single canonical design behind every header action that sits at the top
 * of a map-first app's parcel panel — Track (save), Export, Open-in, and any
 * future one-off — so apps stop forking bespoke `px-3 py-1.5 text-xs` text
 * buttons that drift in size, colour, and dark-mode handling. Lifted from
 * valoo's reference panel (the "nice pop-up"): a 32×32 (`w-8 h-8`) rounded
 * square that shows an icon only, never a text label. Pairs pixel-for-pixel
 * with the shared {@link CompareToggleButton} and the panel's close button.
 *
 * Presentational only: it owns no state and resolves no translations. The host
 * passes the `icon`, an accessible `label` (used for both `title` and
 * `aria-label` — icon-only controls must always carry an accessible name), a
 * handler, and a visual `tone`. The label-injection pattern matches the rest of
 * the shared UI kit (CompareToggleButton / ComparablesPanel / MapUserMenu).
 *
 * Set `href` to render an `<a>` instead of a `<button>` (e.g. "open in proom").
 * Set `busy` to swap the icon for a spinner. Tones:
 *
 *  - `ghost`   transparent at rest, neutral hover — the Track/save idle look.
 *  - `neutral` filled grey + ring — the Export trigger / Compare-unpinned look.
 *  - `success` emerald — the saved/tracked state (suite-standard "done" accent).
 *  - `active`  red — a pressed/selected toggle (matches Compare-pinned).
 *  - `danger`  red text on hover-tint — a transient error state.
 */

export type PanelActionTone = 'ghost' | 'neutral' | 'success' | 'active' | 'danger';

export interface PanelActionButtonProps {
  /** Icon node, e.g. `<Bookmark className="w-4 h-4" />`. Centered in the square. */
  icon: ReactNode;
  /** Accessible name — set on both `title` and `aria-label`. Always required. */
  label: string;
  /** Click handler (button mode). Ignored when `href` is set. */
  onClick?: () => void;
  /** Render an `<a>` link instead of a `<button>` (e.g. open-in-proom). */
  href?: string;
  /** Link target (only with `href`). `_blank` auto-adds rel="noopener noreferrer". */
  target?: string;
  /** Disable the control (also visually applied while `busy`). */
  disabled?: boolean;
  /** Swap the icon for a spinning loader (e.g. while saving). */
  busy?: boolean;
  /** Dark-mode styling toggle. */
  dark?: boolean;
  /** Visual tone. Default `ghost`. */
  tone?: PanelActionTone;
  /** `aria-pressed` for toggle-style buttons. */
  ariaPressed?: boolean;
  /** Extra classes appended to the control. */
  className?: string;
}

const BASE =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-default shrink-0';

function toneClasses(tone: PanelActionTone, dark: boolean): string {
  switch (tone) {
    case 'neutral':
      return dark
        ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] ring-1 ring-white/[0.06]'
        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200';
    case 'success':
      return dark
        ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20'
        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    case 'active':
      return dark
        ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/30'
        : 'bg-red-50 text-red-700 ring-1 ring-red-200';
    case 'danger':
      return dark
        ? 'text-red-300 hover:bg-red-500/15'
        : 'text-red-600 hover:bg-red-50';
    case 'ghost':
    default:
      return dark
        ? 'text-gray-400 hover:bg-white/[0.08] hover:text-white'
        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700';
  }
}

export function PanelActionButton({
  icon,
  label,
  onClick,
  href,
  target = '_blank',
  disabled = false,
  busy = false,
  dark = false,
  tone = 'ghost',
  ariaPressed,
  className,
}: PanelActionButtonProps) {
  const cls = `${BASE} ${toneClasses(tone, dark)}${className ? ` ${className}` : ''}`;
  const content = busy ? (
    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
  ) : (
    icon
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        title={label}
        aria-label={label}
        className={cls}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      aria-pressed={ariaPressed}
      className={cls}
    >
      {content}
    </button>
  );
}

export default PanelActionButton;
