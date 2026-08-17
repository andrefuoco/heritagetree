import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { readImportFile } from '../lib/io';

export function EmptyState() {
  const { t } = useTranslation();
  const startTree = useStore((s) => s.startTree);
  const replaceDocument = useStore((s) => s.replaceDocument);
  const fileInput = useRef<HTMLInputElement>(null);
  const [father, setFather] = useState({ firstName: '', surname: '' });
  const [mother, setMother] = useState({ firstName: '', surname: '' });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTree(father, mother);
  };

  return (
    <div className="empty">
      <form className="empty__card" onSubmit={onSubmit}>
        <h1 className="empty__title">{t('empty.title')}</h1>
        <p className="empty__body">{t('empty.body')}</p>

        <div className="empty__pair">
          <span className="empty__pairTitle">{t('empty.father')}</span>
          <div className="field__row">
            <div className="field">
              <label htmlFor="f-first">{t('empty.firstName')}</label>
              <input
                id="f-first"
                value={father.firstName}
                onChange={(e) => setFather({ ...father, firstName: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="f-last">{t('empty.surname')}</label>
              <input
                id="f-last"
                value={father.surname}
                onChange={(e) => setFather({ ...father, surname: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="empty__pair">
          <span className="empty__pairTitle">{t('empty.mother')}</span>
          <div className="field__row">
            <div className="field">
              <label htmlFor="m-first">{t('empty.firstName')}</label>
              <input
                id="m-first"
                value={mother.firstName}
                onChange={(e) => setMother({ ...mother, firstName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="m-last">{t('empty.surname')}</label>
              <input
                id="m-last"
                value={mother.surname}
                onChange={(e) => setMother({ ...mother, surname: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="empty__actions">
          <button type="submit" className="btn btn--primary">
            {t('empty.create')}
          </button>
          <span className="empty__or">{t('empty.or')}</span>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            {t('empty.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const imported = await readImportFile(file);
              if (imported) replaceDocument(imported);
              else window.alert(t('io.importFailed'));
            }}
          />
        </div>
      </form>
    </div>
  );
}
