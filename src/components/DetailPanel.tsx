import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import type { Gender, Person } from '../types';
import { HUE_CHOICES, hueForSurname, normaliseSurname, swatchColor, toneForSurname, toneVars } from '../lib/colors';
import { lifespanYears } from '../lib/dates';
import { descendantsOf, displayName } from '../lib/tree';

const GENDERS: Gender[] = ['male', 'female', 'other'];

export function DetailPanel({ person }: { person: Person }) {
  const { t } = useTranslation();
  const doc = useStore((s) => s.doc);
  const updatePerson = useStore((s) => s.updatePerson);
  const removePerson = useStore((s) => s.removePerson);
  const setSurnameHue = useStore((s) => s.setSurnameHue);
  const select = useStore((s) => s.select);

  const deceased = !!person.deathDate.trim();
  const tone = toneForSurname(person.surname, deceased, doc.surnameColors);
  const years = lifespanYears(person.birthDate, person.deathDate);
  const surnameKey = normaliseSurname(person.surname);
  const activeHue = surnameKey ? doc.surnameColors[surnameKey] : undefined;

  const set = (patch: Partial<Person>) => updatePerson(person.id, patch);

  const onDelete = () => {
    const descendants = descendantsOf(doc, person.id).size - 1;
    const name = displayName(person, t('person.unnamed'));
    const message =
      descendants > 0
        ? t('person.deleteConfirm', { name, count: descendants })
        : t('person.deleteConfirmSingle', { name });
    if (window.confirm(message)) removePerson(person.id);
  };

  return (
    <aside
      className={`panel ${tone.neutral ? 'panel--neutral' : ''}`}
      style={toneVars(tone)}
      aria-label={t('person.details')}
    >
      <header className="panel__head">
        <div className="panel__swatch" />
        <div className="panel__heading">
          <div className="panel__name">{displayName(person, t('person.unnamed'))}</div>
          <div className="panel__status">
            {deceased ? t('person.deceased') : t('person.living')}
            {years !== null && ` · ${t('person.lived', { years })}`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => select(null)}
          aria-label={t('person.close')}
        >
          ✕
        </button>
      </header>

      <div className="panel__body">
        <div className="field__row">
          <div className="field">
            <label htmlFor="firstName">{t('person.firstName')}</label>
            <input
              id="firstName"
              value={person.firstName}
              onChange={(e) => set({ firstName: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="surname">{t('person.surname')}</label>
            <input
              id="surname"
              value={person.surname}
              onChange={(e) => set({ surname: e.target.value })}
              autoComplete="off"
            />
          </div>
        </div>

        {/*
          Gender is a segmented control rather than a dropdown because it is
          what identifies the father in a couple, and so decides which surname
          the couple's children inherit by default.
        */}
        <div className="field">
          <label>{t('person.gender')}</label>
          <div className="segmented" role="group">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={person.gender === g}
                onClick={() => set({ gender: g })}
              >
                {t(`person.${g}`)}
              </button>
            ))}
          </div>
          <span className="field__hint">{t('person.genderHint')}</span>
        </div>

        <div className="field__row">
          <div className="field">
            <label htmlFor="birthDate">{t('person.birthDate')}</label>
            <input
              id="birthDate"
              value={person.birthDate}
              onChange={(e) => set({ birthDate: e.target.value })}
              placeholder="1923"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="deathDate">{t('person.deathDate')}</label>
            <input
              id="deathDate"
              value={person.deathDate}
              onChange={(e) => set({ deathDate: e.target.value })}
              placeholder="—"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="field__hint">{t('person.dateHint')}</div>

        <div className="field">
          <label htmlFor="birthPlace">{t('person.birthPlace')}</label>
          <input
            id="birthPlace"
            value={person.birthPlace}
            onChange={(e) => set({ birthPlace: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="lifeNotes">{t('person.lifeNotes')}</label>
          <textarea
            id="lifeNotes"
            value={person.lifeNotes}
            onChange={(e) => set({ lifeNotes: e.target.value })}
          />
          <span className="field__hint">{t('person.lifeNotesHint')}</span>
        </div>

        {/* Death notes appear only once a date of death is known. */}
        {deceased && (
          <div className="field">
            <label htmlFor="deathNotes">{t('person.deathNotes')}</label>
            <textarea
              id="deathNotes"
              value={person.deathNotes}
              onChange={(e) => set({ deathNotes: e.target.value })}
            />
            <span className="field__hint">{t('person.deathNotesHint')}</span>
          </div>
        )}

        {surnameKey && (
          <div className="panel__section">
            <div className="field">
              <label>{t('person.surnameColor', { surname: person.surname.trim() })}</label>
              <div className="swatches">
                <button
                  type="button"
                  className="swatch swatch--auto"
                  aria-pressed={activeHue === undefined}
                  onClick={() => setSurnameHue(person.surname, null)}
                >
                  {t('person.autoColor')}
                </button>
                {HUE_CHOICES.map((hue) => (
                  <button
                    key={hue}
                    type="button"
                    className="swatch"
                    aria-pressed={hueForSurname(person.surname, doc.surnameColors) === hue}
                    style={{ background: swatchColor(hue) }}
                    onClick={() => setSurnameHue(person.surname, hue)}
                    aria-label={`${hue}°`}
                  />
                ))}
              </div>
              <span className="field__hint">{t('person.surnameColorHint')}</span>
            </div>
          </div>
        )}

        <div className="panel__section">
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            {t('person.delete')}
          </button>
        </div>
      </div>
    </aside>
  );
}
