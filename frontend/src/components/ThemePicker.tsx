import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Palette } from 'lucide-react';
import '../styles/themes.css';

export const THEMES = [
  { id: 'mint', name: 'Mint', description: 'Charcoal + electric mint', swatches: ['#0b0e11', '#b9f574', '#eef2ed'] },
  { id: 'glacier', name: 'Glacier', description: 'Deep navy + ice cyan', swatches: ['#071117', '#87dff0', '#e7f3f7'] },
  { id: 'cobalt', name: 'Cobalt', description: 'Cool graphite + blue', swatches: ['#0e1018', '#9ab4ff', '#edf2ff'] },
  { id: 'ember', name: 'Ember', description: 'Warm ivory + terracotta', swatches: ['#f6f2eb', '#b8492b', '#352b25'] },
  { id: 'orchid', name: 'Orchid', description: 'Deep plum + lavender', swatches: ['#120d18', '#d9a8fa', '#f6edfb'] },
] as const;

type ThemeId = typeof THEMES[number]['id'];
const STORAGE_KEY = 'bulkhead-theme';

function getInitialTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.find(theme => theme.id === saved)?.id ?? 'mint';
  } catch {
    return 'mint';
  }
}

export default function ThemePicker() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(getInitialTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentTheme = THEMES.find(theme => theme.id === selectedTheme)!;

  useEffect(() => {
    document.documentElement.dataset.theme = selectedTheme;
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedTheme);
    } catch {
      // The current page still supports themes when browser storage is unavailable.
    }
  }, [selectedTheme]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectTheme = (id: ThemeId) => {
    setSelectedTheme(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="theme-picker" ref={rootRef}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <button ref={triggerRef} type="button" className="theme-trigger"
        aria-label={`Theme: ${currentTheme.name}. Choose color theme`}
        aria-expanded={open} aria-controls="theme-options"
        onClick={() => setOpen(value => !value)}>
        <Palette size={16} aria-hidden="true" />
        <span>Theme</span>
        <span className="theme-current">{currentTheme.name}</span>
        <ChevronDown size={13} className={open ? 'theme-chevron theme-chevron-open' : 'theme-chevron'} aria-hidden="true" />
      </button>
      {open && (
        <div id="theme-options" className="theme-panel" role="group" aria-labelledby="theme-options-title">
          <div className="theme-panel-heading">
            <span id="theme-options-title">Make it your space</span>
            <span>Choose a color palette</span>
          </div>
          <div className="theme-choices">
            {THEMES.map(theme => (
              <button key={theme.id} type="button" className="theme-choice"
                aria-pressed={selectedTheme === theme.id}
                onClick={() => selectTheme(theme.id)}>
                <span className="theme-swatches" aria-hidden="true">
                  {theme.swatches.map(color => <span key={color} style={{ backgroundColor: color }} />)}
                </span>
                <span className="theme-copy"><strong>{theme.name}</strong><span>{theme.description}</span></span>
                {selectedTheme === theme.id && <Check size={15} className="theme-check" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
