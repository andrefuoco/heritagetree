import { create } from 'zustand';
import { emptyPerson, emptyUnion, type Gender, type ID, type Person, type TreeDocument, type Union } from './types';
import { loadDocument, migrate, saveDocument } from './lib/db';
import { createDocument, descendantsOf, inheritedSurname, newId } from './lib/tree';
import { normaliseSurname } from './lib/colors';
import { unionsOf } from './lib/layout';

const HISTORY_LIMIT = 50;

/** What the detail panel is showing: a person, a couple, or nothing. */
export type Selection = { kind: 'person'; id: ID } | { kind: 'union'; id: ID } | null;

interface State {
  doc: TreeDocument;
  loaded: boolean;
  selection: Selection;
  past: TreeDocument[];
  future: TreeDocument[];

  init: () => Promise<void>;
  selectPerson: (id: ID) => void;
  selectUnion: (id: ID) => void;
  clearSelection: () => void;

  startTree: (father: Partial<Person>, mother: Partial<Person>) => void;
  addPartner: (personId: ID) => ID;
  addChild: (unionId: ID) => ID;
  addChildToPerson: (personId: ID) => ID;
  addParentsTo: (personId: ID) => void;
  updatePerson: (id: ID, patch: Partial<Person>) => void;
  updateUnion: (id: ID, patch: Partial<Union>) => void;
  removePerson: (id: ID) => void;
  setSurnameHue: (surname: string, hue: number | null) => void;
  setTreeName: (name: string) => void;
  replaceDocument: (doc: TreeDocument) => void;
  resetTree: () => void;
  undo: () => void;
  redo: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(doc: TreeDocument) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveDocument(doc), 250);
}

export const useStore = create<State>((set, get) => {
  /**
   * Applies a mutation to a draft copy of the document, pushes the previous
   * version onto the undo stack, and persists. Every tree edit goes through
   * here so undo and autosave can never be forgotten at a call site.
   */
  function mutate(fn: (draft: TreeDocument) => void) {
    const { doc, past } = get();
    const draft: TreeDocument = structuredClone(doc);
    fn(draft);
    draft.updatedAt = new Date().toISOString();
    scheduleSave(draft);
    set({
      doc: draft,
      past: [...past, doc].slice(-HISTORY_LIMIT),
      future: [],
    });
  }

  return {
    doc: createDocument(),
    loaded: false,
    selection: null,
    past: [],
    future: [],

    init: async () => {
      const stored = await loadDocument();
      set({ doc: stored ?? createDocument(), loaded: true });
    },

    selectPerson: (id) => set({ selection: { kind: 'person', id } }),
    selectUnion: (id) => set({ selection: { kind: 'union', id } }),
    clearSelection: () => set({ selection: null }),

    startTree: (father, mother) =>
      mutate((d) => {
        const fatherId = newId();
        const motherId = newId();
        const unionId = newId();
        d.people[fatherId] = emptyPerson(fatherId, { gender: 'male', ...father });
        d.people[motherId] = emptyPerson(motherId, { gender: 'female', ...mother });
        d.unions[unionId] = emptyUnion(unionId, { partnerIds: [fatherId, motherId] });
        d.rootPersonId = fatherId;
      }),

    addPartner: (personId) => {
      const id = newId();
      mutate((d) => {
        const person = d.people[personId];
        if (!person) return;
        const gender: Gender =
          person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'other';
        d.people[id] = emptyPerson(id, { gender });
        const unionId = newId();
        d.unions[unionId] = emptyUnion(unionId, { partnerIds: [personId, id] });
      });
      set({ selection: { kind: 'person', id } });
      return id;
    },

    addChild: (unionId) => {
      const id = newId();
      mutate((d) => {
        const union = d.unions[unionId];
        if (!union) return;
        d.people[id] = emptyPerson(id, {
          surname: inheritedSurname(d, unionId),
          parentUnionId: unionId,
        });
        union.childIds.push(id);
      });
      set({ selection: { kind: 'person', id } });
      return id;
    },

    /**
     * Adds a child to a person who has no partner yet, by creating a
     * single-parent union for them. Keeps "add child" available on every node
     * without forcing a placeholder spouse to be invented first.
     */
    addChildToPerson: (personId) => {
      const existing = unionsOf(get().doc, personId)[0];
      if (existing) return get().addChild(existing.id);
      const childId = newId();
      mutate((d) => {
        if (!d.people[personId]) return;
        const unionId = newId();
        d.unions[unionId] = emptyUnion(unionId, { partnerIds: [personId] });
        d.people[childId] = emptyPerson(childId, {
          surname: inheritedSurname(d, unionId),
          parentUnionId: unionId,
        });
        d.unions[unionId].childIds.push(childId);
      });
      set({ selection: { kind: 'person', id: childId } });
      return childId;
    },

    /**
     * Grows the tree upwards from anybody who has no parents yet — not only
     * the person the tree happens to be rooted at, so a married-in spouse can
     * have their own line drawn above them.
     */
    addParentsTo: (personId) => {
      let fatherId = '';
      mutate((d) => {
        const person = d.people[personId];
        if (!person || person.parentUnionId) return;
        fatherId = newId();
        const motherId = newId();
        const unionId = newId();
        // A father and his child usually share a surname, and in the Italian
        // convention so does a married woman's father, so seed both from the
        // person we are growing upwards from.
        d.people[fatherId] = emptyPerson(fatherId, { gender: 'male', surname: person.surname });
        d.people[motherId] = emptyPerson(motherId, { gender: 'female' });
        d.unions[unionId] = emptyUnion(unionId, {
          partnerIds: [fatherId, motherId],
          childIds: [personId],
        });
        person.parentUnionId = unionId;
        // Keep the main lineage rooted at the top so it stays the tree's spine.
        if (d.rootPersonId === personId) d.rootPersonId = fatherId;
      });
      if (fatherId) set({ selection: { kind: 'person', id: fatherId } });
    },

    updatePerson: (id, patch) =>
      mutate((d) => {
        const person = d.people[id];
        if (person) Object.assign(person, patch);
      }),

    updateUnion: (id, patch) =>
      mutate((d) => {
        const union = d.unions[id];
        if (union) Object.assign(union, patch);
      }),

    /** Removes a person together with everyone descending from them. */
    removePerson: (id) => {
      mutate((d) => {
        const doomed = descendantsOf(d, id);
        for (const personId of doomed) delete d.people[personId];
        for (const union of Object.values(d.unions)) {
          union.partnerIds = union.partnerIds.filter((p) => !doomed.has(p));
          union.childIds = union.childIds.filter((c) => !doomed.has(c));
        }
        // Drop unions that no longer join anyone.
        for (const union of Object.values(d.unions)) {
          if (union.partnerIds.length === 0) delete d.unions[union.id];
        }
        if (d.rootPersonId && doomed.has(d.rootPersonId)) {
          d.rootPersonId = Object.keys(d.people)[0] ?? null;
        }
      });
      const selection = get().selection;
      if (selection?.kind === 'person' && selection.id === id) set({ selection: null });
    },

    setSurnameHue: (surname, hue) =>
      mutate((d) => {
        const key = normaliseSurname(surname);
        if (!key) return;
        if (hue === null) delete d.surnameColors[key];
        else d.surnameColors[key] = hue;
      }),

    setTreeName: (name) => mutate((d) => { d.name = name; }),

    replaceDocument: (doc) => {
      const migrated = migrate(doc);
      if (!migrated) return;
      mutate((d) => {
        d.people = migrated.people;
        d.unions = migrated.unions;
        d.rootPersonId = migrated.rootPersonId;
        d.surnameColors = migrated.surnameColors;
        d.name = migrated.name;
      });
      set({ selection: null });
    },

    resetTree: () => {
      mutate((d) => {
        d.people = {};
        d.unions = {};
        d.rootPersonId = null;
        d.surnameColors = {};
        d.name = '';
      });
      set({ selection: null });
    },

    undo: () => {
      const { past, doc, future } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      scheduleSave(previous);
      set({ doc: previous, past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT) });
    },

    redo: () => {
      const { past, doc, future } = get();
      const next = future[0];
      if (!next) return;
      scheduleSave(next);
      set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: future.slice(1) });
    },
  };
});
