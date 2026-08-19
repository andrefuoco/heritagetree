import { DOCUMENT_VERSION, type ID, type Person, type TreeDocument } from '../types';
import { unionsOf } from './layout';

export function newId(): ID {
  return crypto.randomUUID();
}

export function createDocument(name = ''): TreeDocument {
  return {
    version: DOCUMENT_VERSION,
    name,
    people: {},
    unions: {},
    rootPersonId: null,
    surnameColors: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Surname a new child of this union should start with: the father's, falling
 * back to whichever partner has one. This is a default applied once at
 * creation, not a live link — renaming an ancestor later never rewrites the
 * descendants who were already named.
 */
export function inheritedSurname(doc: TreeDocument, unionId: ID): string {
  const union = doc.unions[unionId];
  if (!union) return '';
  const partners = union.partnerIds
    .map((id) => doc.people[id])
    .filter((p): p is Person => !!p);
  const father = partners.find((p) => p.gender === 'male' && p.surname.trim());
  if (father) return father.surname;
  return partners.find((p) => p.surname.trim())?.surname ?? '';
}

export function displayName(person: Person | undefined, unnamed: string): string {
  if (!person) return unnamed;
  const full = `${person.firstName} ${person.surname}`.trim();
  return full || unnamed;
}

/** A person plus everyone descending from them, used when deleting a branch. */
export function descendantsOf(doc: TreeDocument, personId: ID): Set<ID> {
  const out = new Set<ID>();
  const walk = (id: ID) => {
    if (out.has(id)) return;
    out.add(id);
    for (const union of unionsOf(doc, id)) {
      for (const childId of union.childIds) walk(childId);
    }
  };
  walk(personId);
  return out;
}

export function countPeople(doc: TreeDocument): number {
  return Object.keys(doc.people).length;
}

/**
 * How many generations the tree spans. Walks partners and parents as well as
 * children, because a spouse's ancestors sit above the root's own generation
 * and would otherwise go uncounted.
 */
export function generationCount(doc: TreeDocument): number {
  if (!doc.rootPersonId || !doc.people[doc.rootPersonId]) return 0;
  const depths = new Map<ID, number>([[doc.rootPersonId, 0]]);
  const queue: ID[] = [doc.rootPersonId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = depths.get(id)!;
    const visit = (other: ID, otherDepth: number) => {
      if (depths.has(other) || !doc.people[other]) return;
      depths.set(other, otherDepth);
      queue.push(other);
    };
    for (const union of unionsOf(doc, id)) {
      for (const partnerId of union.partnerIds) visit(partnerId, depth);
      for (const childId of union.childIds) visit(childId, depth + 1);
    }
    const parentUnionId = doc.people[id]?.parentUnionId;
    const parentUnion = parentUnionId ? doc.unions[parentUnionId] : undefined;
    for (const parentId of parentUnion?.partnerIds ?? []) visit(parentId, depth - 1);
  }
  const values = [...depths.values()];
  return Math.max(...values) - Math.min(...values) + 1;
}
