import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from './store';
import { useViewport } from './hooks/useViewport';
import { TreeCanvas } from './components/TreeCanvas';
import { DetailPanel } from './components/DetailPanel';
import { UnionPanel } from './components/UnionPanel';
import { Toolbar } from './components/Toolbar';
import { EmptyState } from './components/EmptyState';
import { NODE_H, NODE_W, type Layout } from './lib/layout';

/** Vertical room the add-partner / add-child chips need under a selected card. */
const CHIP_ROOM = 36;

const HINT_KEY = 'heritage-tree-hint-dismissed';

/** The install tip is pointless once the app is already running installed. */
function shouldShowHint(): boolean {
  if (localStorage.getItem(HINT_KEY)) return false;
  return !window.matchMedia('(display-mode: standalone)').matches;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const init = useStore((s) => s.init);
  const loaded = useStore((s) => s.loaded);
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const selectedPerson = selection?.kind === 'person' ? doc.people[selection.id] : undefined;
  const selectedUnion = selection?.kind === 'union' ? doc.unions[selection.id] : undefined;
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const clearSelection = useStore((s) => s.clearSelection);

  const { stageRef, viewport, panning, fit, zoomBy, ensureVisible, handlers } = useViewport();
  const [layout, setLayout] = useState<Layout | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  layoutRef.current = layout;
  const hasFitted = useRef(false);
  const [showHint, setShowHint] = useState(shouldShowHint);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'en';
  }, [i18n.resolvedLanguage]);

  // Frame the tree once, the first time there is something to frame.
  useEffect(() => {
    if (hasFitted.current || !layout || layout.width === 0) return;
    hasFitted.current = true;
    fit(layout.width, layout.height);
  }, [layout, fit]);

  // Keep the focused person clear of the detail panel, which on wide screens
  // covers the right edge of the stage and on phones the bottom of it.
  useEffect(() => {
    if (selection?.kind !== 'person') return;
    const placed = layout?.personById.get(selection.id);
    if (!placed) return;
    const narrow = window.innerWidth <= 640;
    ensureVisible(
      { x: placed.x, y: placed.y, width: NODE_W, height: NODE_H + CHIP_ROOM },
      // Wide screens split the stage instead of covering it, so only the phone
      // bottom sheet needs an inset reserved.
      narrow ? { bottom: window.innerHeight * 0.72 } : {},
    );
  }, [selection, layout, ensureVisible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select');
      if (e.key === 'Escape' && !typing) clearSelection();
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, clearSelection]);

  const onFit = useCallback(() => {
    const current = layoutRef.current;
    if (current) fit(current.width, current.height);
  }, [fit]);

  if (!loaded) return <div className="app" />;

  const isEmpty = !doc.rootPersonId;

  return (
    <div className="app">
      <Toolbar onFit={onFit} onZoom={zoomBy} />
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="workspace">
          <TreeCanvas
            stageRef={stageRef}
            viewport={viewport}
            panning={panning}
            handlers={handlers}
            onLayout={setLayout}
          />
          {selectedPerson && <DetailPanel key={selectedPerson.id} person={selectedPerson} />}
          {selectedUnion && <UnionPanel key={selectedUnion.id} union={selectedUnion} />}
        </div>
      )}
      {showHint && (
        <div className="hint">
          <span>{t('install.hint')}</span>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(HINT_KEY, '1');
              setShowHint(false);
            }}
            aria-label={t('person.close')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
