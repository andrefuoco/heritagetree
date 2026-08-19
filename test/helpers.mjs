import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * The layout module is pure TypeScript with no browser APIs, so it can be
 * bundled once with the esbuild that already ships with vite and exercised
 * directly from node — no test framework or DOM needed.
 */
export async function loadLayout() {
  const out = join(mkdtempSync(join(tmpdir(), 'heritage-')), 'layout.mjs');
  execFileSync(
    'npx',
    ['esbuild', 'src/lib/layout.ts', '--bundle', '--format=esm', `--outfile=${out}`, '--log-level=error'],
    { stdio: 'inherit' },
  );
  return import(out);
}

/** Builds a document with the same shape the app stores. */
export function docBuilder() {
  let n = 0;
  const nextId = () => `p${++n}`;
  const doc = {
    version: 1,
    name: '',
    people: {},
    unions: {},
    rootPersonId: null,
    surnameColors: {},
    updatedAt: '',
  };

  const person = (over = {}) => {
    const id = nextId();
    doc.people[id] = {
      id,
      firstName: id,
      surname: '',
      gender: 'other',
      birthDate: '',
      deathDate: '',
      birthPlace: '',
      lifeNotes: '',
      deathNotes: '',
      parentUnionId: null,
      ...over,
    };
    return id;
  };

  const union = (a, b) => {
    const id = nextId();
    doc.unions[id] = {
      id,
      partnerIds: b ? [a, b] : [a],
      childIds: [],
      marriageDate: '',
      notes: '',
    };
    return id;
  };

  const child = (unionId, over = {}) => {
    const id = person({ parentUnionId: unionId, ...over });
    doc.unions[unionId].childIds.push(id);
    return id;
  };

  /** Attaches an existing person to a new parent couple. */
  const parentsOf = (personId) => {
    const father = person({ gender: 'male' });
    const mother = person({ gender: 'female' });
    const id = union(father, mother);
    doc.unions[id].childIds.push(personId);
    doc.people[personId].parentUnionId = id;
    return { unionId: id, father, mother };
  };

  const couple = () => {
    const father = person({ gender: 'male' });
    const mother = person({ gender: 'female' });
    return { unionId: union(father, mother), father, mother };
  };

  return { doc, person, union, child, parentsOf, couple };
}
