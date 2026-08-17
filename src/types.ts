export type ID = string;

export type Gender = 'male' | 'female' | 'other';

export interface Person {
  id: ID;
  firstName: string;
  surname: string;
  gender: Gender;
  /** Free text so partial genealogical dates ("1890", "about 1912") stay expressible. */
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  lifeNotes: string;
  deathNotes: string;
  /** The union this person was born into. Null for the root couple and for married-in partners. */
  parentUnionId: ID | null;
}

/**
 * A couple. Children belong to a union rather than to a person, which is what
 * makes remarriage, single parents and "add parents above the root" all work
 * with the same code path.
 */
export interface Union {
  id: ID;
  /** One or two partners. A single-element union is a lone parent. */
  partnerIds: ID[];
  childIds: ID[];
  marriageDate: string;
  notes: string;
}

export interface TreeDocument {
  /** Bumped whenever the on-disk shape changes, so imports can be migrated. */
  version: number;
  name: string;
  people: Record<ID, Person>;
  unions: Record<ID, Union>;
  /** Topmost person; the tree is drawn by walking down from here. */
  rootPersonId: ID | null;
  /** Manual hue overrides keyed by normalised surname. */
  surnameColors: Record<string, number>;
  updatedAt: string;
}

export const DOCUMENT_VERSION = 1;

export function emptyPerson(id: ID, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: '',
    surname: '',
    gender: 'other',
    birthDate: '',
    deathDate: '',
    birthPlace: '',
    lifeNotes: '',
    deathNotes: '',
    parentUnionId: null,
    ...overrides,
  };
}

export function emptyUnion(id: ID, overrides: Partial<Union> = {}): Union {
  return { id, partnerIds: [], childIds: [], marriageDate: '', notes: '', ...overrides };
}
