import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import type { Union } from '../types';
import { displayName } from '../lib/tree';

/**
 * The detail panel for a couple. Children belong to the couple rather than to
 * either partner, so this is the natural place to add them — and the only
 * unambiguous one once somebody has married twice.
 */
export function UnionPanel({ union }: { union: Union }) {
  const { t } = useTranslation();
  const doc = useStore((s) => s.doc);
  const updateUnion = useStore((s) => s.updateUnion);
  const addChild = useStore((s) => s.addChild);
  const selectPerson = useStore((s) => s.selectPerson);
  const clearSelection = useStore((s) => s.clearSelection);

  const partners = union.partnerIds.map((id) => doc.people[id]).filter((p) => !!p);
  const title = partners.map((p) => displayName(p, t('person.unnamed'))).join(' & ');
  const children = union.childIds.map((id) => doc.people[id]).filter((c) => !!c);

  return (
    <aside className="panel panel--neutral" aria-label={t('union.title')}>
      <header className="panel__head">
        <div className="panel__swatch panel__swatch--union" />
        <div className="panel__heading">
          <div className="panel__name">{title || t('union.title')}</div>
          <div className="panel__status">{children.length === 0 ? t('union.noChildren') : t('union.childCount', { count: children.length })}</div>
        </div>
        <button
          type="button"
          className="btn btn--icon"
          onClick={clearSelection}
          aria-label={t('person.close')}
        >
          ✕
        </button>
      </header>

      <div className="panel__body">
        <p className="field__hint">{t('union.explainer')}</p>

        <button type="button" className="btn btn--primary" onClick={() => addChild(union.id)}>
          + {t('actions.addChild')}
        </button>

        <div className="field">
          <label htmlFor="marriageDate">{t('union.marriageDate')}</label>
          <input
            id="marriageDate"
            value={union.marriageDate}
            onChange={(e) => updateUnion(union.id, { marriageDate: e.target.value })}
            placeholder="1948"
            autoComplete="off"
          />
          <span className="field__hint">{t('person.dateHint')}</span>
        </div>

        <div className="field">
          <label htmlFor="unionNotes">{t('union.notes')}</label>
          <textarea
            id="unionNotes"
            value={union.notes}
            onChange={(e) => updateUnion(union.id, { notes: e.target.value })}
          />
        </div>

        {children.length > 0 && (
          <div className="panel__section">
            <div className="field">
              <label>{t('union.children')}</label>
              <ul className="linklist">
                {children.map((child) => (
                  <li key={child.id}>
                    <button type="button" onClick={() => selectPerson(child.id)}>
                      {displayName(child, t('person.unnamed'))}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
