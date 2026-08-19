import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { LANGUAGES } from '../i18n';
import { countPeople, generationCount } from '../lib/tree';
import { exportDocument, readImportFile } from '../lib/io';

interface Props {
  onFit: () => void;
  onZoom: (factor: number) => void;
}

export function Toolbar({ onFit, onZoom }: Props) {
  const { t, i18n } = useTranslation();
  const doc = useStore((s) => s.doc);
  const setTreeName = useStore((s) => s.setTreeName);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const resetTree = useStore((s) => s.resetTree);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocumentDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocumentDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocumentDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const imported = await readImportFile(file);
    if (!imported) {
      window.alert(t('io.importFailed'));
      return;
    }
    const hasContent = countPeople(doc) > 0;
    if (!hasContent || window.confirm(t('io.importConfirm'))) replaceDocument(imported);
  };

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__title">{t('app.title')}</span>
        <span className="toolbar__stats">
          {t('toolbar.stats', {
            people: countPeople(doc),
            generations: generationCount(doc),
          })}
        </span>
      </div>

      <input
        className="toolbar__name"
        value={doc.name}
        onChange={(e) => setTreeName(e.target.value)}
        placeholder={t('app.treeNamePlaceholder')}
        aria-label={t('app.treeNamePlaceholder')}
      />

      <div className="toolbar__spacer" />

      <div className="toolbar__group">
        <button type="button" className="btn btn--icon" onClick={() => onZoom(1 / 1.2)} aria-label={t('toolbar.zoomOut')}>−</button>
        <button type="button" className="btn btn--icon" onClick={() => onZoom(1.2)} aria-label={t('toolbar.zoomIn')}>+</button>
        <button type="button" className="btn btn--icon" onClick={onFit} aria-label={t('toolbar.fit')} title={t('toolbar.fit')}>⤢</button>
      </div>

      <div className="toolbar__group">
        <button type="button" className="btn btn--icon" onClick={undo} disabled={!canUndo} aria-label={t('toolbar.undo')} title={t('toolbar.undo')}>↶</button>
        <button type="button" className="btn btn--icon" onClick={redo} disabled={!canRedo} aria-label={t('toolbar.redo')} title={t('toolbar.redo')}>↷</button>
      </div>

      {/* Export, import and reset are rare, so they live behind a menu rather
          than spending permanent width — which on a phone costs a whole row. */}
      <div className="menu" ref={menuRef}>
        <button
          type="button"
          className="btn btn--icon"
          aria-label={t('toolbar.menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="menu__list" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                exportDocument(doc, t('app.untitledTree'));
                setMenuOpen(false);
              }}
            >
              {t('toolbar.export')}
            </button>
            <button type="button" role="menuitem" onClick={() => fileInput.current?.click()}>
              {t('toolbar.import')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu__danger"
              onClick={() => {
                setMenuOpen(false);
                if (window.confirm(t('io.resetConfirm'))) resetTree();
              }}
            >
              {t('toolbar.reset')}
            </button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
            setMenuOpen(false);
          }}
        />
      </div>

      <div className="lang" role="group" aria-label={t('toolbar.language')}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            aria-pressed={i18n.resolvedLanguage === lang.code}
            onClick={() => void i18n.changeLanguage(lang.code)}
          >
            {lang.code}
          </button>
        ))}
      </div>
    </header>
  );
}
