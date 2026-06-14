import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { PanelActionButton } from './PanelActionButton';

/**
 * Suite-standard "Export" control for parcel/info side panels.
 *
 * The icon-only Download trigger (built on {@link PanelActionButton}, tone
 * `neutral`) plus the dropdown menu of export formats — lifted from valoo's
 * reference panel so every app renders the same control instead of forking its
 * own. Presentational + logic-agnostic: the host supplies the `actions` (each
 * with its own label, optional hint/icon, and `onSelect` that does the actual
 * download), and the button handles open/close, outside-click, and Escape.
 */

export interface ExportMenuAction {
  /** Stable key. */
  id: string;
  /** Primary row label (e.g. "PDF report"). */
  label: string;
  /** Optional secondary hint line. */
  hint?: string;
  /** Optional leading icon node, e.g. `<FileText className="w-4 h-4" />`. */
  icon?: ReactNode;
  /** Fired when the row is chosen — host performs the export. */
  onSelect: () => void;
}

export interface ExportMenuButtonLabels {
  /** Trigger `title` / `aria-label` (e.g. "Export"). */
  menuLabel: string;
  /** Optional small section heading above the format list. */
  sectionLabel?: string;
}

export interface ExportMenuButtonProps {
  actions: ExportMenuAction[];
  labels: ExportMenuButtonLabels;
  dark?: boolean;
  className?: string;
}

export function ExportMenuButton({
  actions,
  labels,
  dark = false,
  className,
}: ExportMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={ref} className={`relative${className ? ` ${className}` : ''}`}>
      <PanelActionButton
        icon={<Download className="w-3.5 h-3.5" />}
        label={labels.menuLabel}
        tone="neutral"
        dark={dark}
        ariaPressed={open}
        onClick={() => setOpen((o) => !o)}
      />

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-full mt-1.5 w-44 rounded-lg shadow-xl z-30 overflow-hidden ${
            dark
              ? 'bg-[#11161f] ring-1 ring-white/[0.08]'
              : 'bg-white ring-1 ring-gray-200'
          }`}
        >
          {labels.sectionLabel && (
            <div
              className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                dark ? 'text-slate-400' : 'text-gray-500'
              }`}
            >
              {labels.sectionLabel}
            </div>
          )}
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                dark
                  ? 'text-slate-200 hover:bg-white/[0.04]'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {action.icon}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{action.label}</div>
                {action.hint && (
                  <div
                    className={`text-[11px] ${
                      dark ? 'text-slate-500' : 'text-gray-400'
                    }`}
                  >
                    {action.hint}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportMenuButton;
