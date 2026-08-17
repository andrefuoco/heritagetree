import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Person } from '../types';
import { NODE_H, NODE_W } from '../lib/layout';
import { toneForSurname, toneVars } from '../lib/colors';

interface Props {
  person: Person;
  x: number;
  y: number;
  selected: boolean;
  surnameColors: Record<string, number>;
  onSelect: (id: string) => void;
  onAddPartner: (id: string) => void;
  onAddChild: (id: string) => void;
}

function formatLifespan(person: Person): string {
  const birth = person.birthDate.trim();
  const death = person.deathDate.trim();
  if (!birth && !death) return '';
  if (birth && death) return `${birth} – ${death}`;
  return birth ? `★ ${birth}` : `† ${death}`;
}

function PersonCardInner({
  person,
  x,
  y,
  selected,
  surnameColors,
  onSelect,
  onAddPartner,
  onAddChild,
}: Props) {
  const { t } = useTranslation();
  const deceased = !!person.deathDate.trim();
  const tone = toneForSurname(person.surname, deceased, surnameColors);
  const lifespan = formatLifespan(person);
  const hasName = !!(person.firstName.trim() || person.surname.trim());

  return (
    <>
      <button
        type="button"
        className={[
          'card',
          selected ? 'card--selected' : '',
          deceased ? 'card--deceased' : '',
          tone.neutral ? 'card--neutral' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ ...toneVars(tone), left: x, top: y, width: NODE_W, height: NODE_H }}
        onClick={() => onSelect(person.id)}
        aria-pressed={selected}
      >
        {hasName ? (
          <>
            {/* With no first name yet the surname is promoted, so a
                half-filled ancestor still reads as a name rather than a dash. */}
            <span className="card__name">{person.firstName || person.surname}</span>
            {person.firstName && person.surname && (
              <span className="card__surname">{person.surname}</span>
            )}
          </>
        ) : (
          <span className="card__name card__unnamed">{t('person.unnamed')}</span>
        )}
        {lifespan && <span className="card__dates">{lifespan}</span>}
      </button>

      <div
        className={`card__actions ${selected ? 'card__actions--visible' : ''}`}
        style={{ left: x, top: y + NODE_H + 5, width: NODE_W }}
      >
        <button type="button" className="chip" onClick={() => onAddPartner(person.id)}>
          ♥ {t('actions.addPartner')}
        </button>
        <button type="button" className="chip" onClick={() => onAddChild(person.id)}>
          + {t('actions.addChild')}
        </button>
      </div>
    </>
  );
}

export const PersonCard = memo(PersonCardInner);
