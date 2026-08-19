import type { ID, TreeDocument, Union } from '../types';

export const NODE_W = 168;
export const NODE_H = 74;
/** Horizontal space between two partners, wide enough for the marriage link. */
export const SPOUSE_GAP = 34;
export const SIBLING_GAP = 30;
export const LEVEL_H = 156;
/** Drop from the bottom of a couple to the horizontal bar their children hang off. */
export const BUS_DROP = 40;
export const MARGIN = 48;

export interface LaidOutPerson {
  personId: ID;
  x: number;
  y: number;
  depth: number;
}

export interface LaidOutUnion {
  unionId: ID;
  junctionX: number;
  junctionY: number;
  busY: number;
  /** x is the child box centre, y its top edge. */
  childAnchors: { personId: ID; x: number; y: number }[];
  /** The horizontal line drawn between two partner boxes. Null for lone parents. */
  partnerLink: { x1: number; x2: number; y: number } | null;
}

export interface Layout {
  persons: LaidOutPerson[];
  unions: LaidOutUnion[];
  personById: Map<ID, LaidOutPerson>;
  width: number;
  height: number;
}

/** Every union a person appears in, in document order. */
export function unionsOf(doc: TreeDocument, personId: ID): Union[] {
  return Object.values(doc.unions).filter((u) => u.partnerIds.includes(personId));
}

export function otherPartner(union: Union, personId: ID): ID | null {
  return union.partnerIds.find((id) => id !== personId) ?? null;
}

interface Subtree {
  width: number;
  /** Centre of the anchor person's own box, relative to this subtree's left edge. */
  anchorX: number;
  persons: LaidOutPerson[];
  unions: LaidOutUnion[];
}

function shift(sub: Subtree, dx: number): void {
  for (const p of sub.persons) p.x += dx;
  for (const u of sub.unions) {
    u.junctionX += dx;
    if (u.partnerLink) {
      u.partnerLink.x1 += dx;
      u.partnerLink.x2 += dx;
    }
    for (const a of u.childAnchors) a.x += dx;
  }
}

/**
 * Lays out one person together with their partners and, recursively, every
 * descendant. Returns coordinates relative to the subtree's own left edge; the
 * caller shifts them into place.
 */
function layoutPerson(
  doc: TreeDocument,
  personId: ID,
  depth: number,
  visited: Set<ID>,
): Subtree {
  const person = doc.people[personId];
  if (!person || visited.has(personId)) {
    return { width: 0, anchorX: 0, persons: [], unions: [] };
  }
  visited.add(personId);

  const unions = unionsOf(doc, personId);
  const partners = unions.map((u) => otherPartner(u, personId));

  // Box order. With a single partner the man goes on the left by convention;
  // with two or more the anchor person sits in the middle so each marriage link
  // connects two adjacent boxes instead of jumping over one.
  let order: ID[];
  if (partners.length === 0) {
    order = [personId];
  } else if (partners.length === 1) {
    const partner = partners[0];
    if (!partner || visited.has(partner)) {
      order = [personId];
    } else {
      const partnerIsMale = doc.people[partner]?.gender === 'male';
      order = partnerIsMale && person.gender !== 'male' ? [partner, personId] : [personId, partner];
    }
  } else {
    const usable = partners.filter((id): id is ID => !!id && !visited.has(id));
    const [first, ...rest] = usable;
    order = first ? [first, personId, ...rest] : [personId, ...rest];
  }
  for (const id of order) visited.add(id);

  const groupWidth = order.length * NODE_W + (order.length - 1) * SPOUSE_GAP;
  const groupY = depth * LEVEL_H;
  const boxLeft = (i: number) => i * (NODE_W + SPOUSE_GAP);
  const anchorIndex = Math.max(order.indexOf(personId), 0);

  // Where each union's descent line leaves the group, measured from the group's
  // own left edge: the gap between the partners, or the middle of the single box.
  const geometry = unions.map((union) => {
    const partner = otherPartner(union, personId);
    const partnerIndex = partner ? order.indexOf(partner) : -1;
    const hasBoth = partnerIndex >= 0;
    const leftIndex = hasBoth ? Math.min(anchorIndex, partnerIndex) : anchorIndex;
    return {
      hasBoth,
      leftIndex,
      junctionOffset: hasBoth
        ? boxLeft(leftIndex) + NODE_W + SPOUSE_GAP / 2
        : boxLeft(anchorIndex) + NODE_W / 2,
    };
  });

  // Descendants, one contiguous block per union, ordered so a union's children
  // sit under the side of the group where that union's link lives. Laid out
  // from a provisional origin of 0; the group is positioned over them after.
  const childBlocks: { sub: Subtree; unionId: ID }[] = [];
  for (const union of unions) {
    for (const childId of union.childIds) {
      const sub = layoutPerson(doc, childId, depth + 1, visited);
      if (sub.width > 0) childBlocks.push({ sub, unionId: union.id });
    }
  }

  const anchorsByUnion = new Map<ID, { personId: ID; x: number; y: number }[]>();
  const collectedPersons: LaidOutPerson[] = [];
  const collectedUnions: LaidOutUnion[] = [];
  const allAnchors: number[] = [];
  let cursor = 0;
  for (const block of childBlocks) {
    shift(block.sub, cursor);
    const list = anchorsByUnion.get(block.unionId) ?? [];
    const anchor = {
      personId: block.sub.persons[0]?.personId ?? '',
      x: block.sub.anchorX,
      y: (depth + 1) * LEVEL_H,
    };
    list.push(anchor);
    allAnchors.push(anchor.x);
    anchorsByUnion.set(block.unionId, list);
    collectedPersons.push(...block.sub.persons);
    collectedUnions.push(...block.sub.unions);
    cursor += block.sub.width + SIBLING_GAP;
  }
  const childrenWidth = Math.max(0, cursor - SIBLING_GAP);

  /*
   * Rather than centring the couple over the children's bounding box, centre it
   * over the children's *anchor points* — the boxes the lines actually land on.
   * A lone child then sits directly beneath its parents instead of being pushed
   * aside by its own spouse and descendants.
   */
  let groupOriginX = 0;
  let childrenOffset = 0;
  if (allAnchors.length > 0) {
    const anchorsMid = (Math.min(...allAnchors) + Math.max(...allAnchors)) / 2;
    const withChildren = geometry.filter((_, i) => (unions[i]?.childIds.length ?? 0) > 0);
    const pivot =
      withChildren.length > 0
        ? withChildren.reduce((acc, g) => acc + g.junctionOffset, 0) / withChildren.length
        : groupWidth / 2;
    groupOriginX = anchorsMid - pivot;
    // Neither block may start left of the subtree's own edge, so whichever ends
    // up negative pushes the other across instead.
    childrenOffset = Math.max(0, -groupOriginX);
    groupOriginX = Math.max(0, groupOriginX);
  }

  if (childrenOffset > 0) {
    for (const block of childBlocks) shift(block.sub, childrenOffset);
    for (const list of anchorsByUnion.values()) {
      for (const anchor of list) anchor.x += childrenOffset;
    }
  }

  const width = Math.max(groupOriginX + groupWidth, childrenOffset + childrenWidth);

  const persons: LaidOutPerson[] = order.map((id, i) => ({
    personId: id,
    x: groupOriginX + boxLeft(i),
    y: groupY,
    depth,
  }));

  const anchorX = groupOriginX + boxLeft(anchorIndex) + NODE_W / 2;

  const laidOutUnions: LaidOutUnion[] = unions.map((union, index) => {
    const geo = geometry[index]!;
    return {
      unionId: union.id,
      junctionX: groupOriginX + geo.junctionOffset,
      junctionY: groupY + NODE_H / 2,
      // Stagger the bars so a person's second marriage doesn't draw its
      // children's bar on top of the first marriage's.
      busY: groupY + NODE_H + BUS_DROP + index * 10,
      childAnchors: anchorsByUnion.get(union.id) ?? [],
      partnerLink: geo.hasBoth
        ? {
            x1: groupOriginX + boxLeft(geo.leftIndex) + NODE_W,
            x2: groupOriginX + boxLeft(geo.leftIndex + 1),
            y: groupY + NODE_H / 2,
          }
        : null,
    };
  });

  return {
    width,
    anchorX,
    persons: [...persons, ...collectedPersons],
    unions: [...laidOutUnions, ...collectedUnions],
  };
}

export function computeLayout(doc: TreeDocument): Layout {
  if (!doc.rootPersonId || !doc.people[doc.rootPersonId]) {
    return { persons: [], unions: [], personById: new Map(), width: 0, height: 0 };
  }
  const sub = layoutPerson(doc, doc.rootPersonId, 0, new Set());
  shift(sub, MARGIN);
  for (const p of sub.persons) p.y += MARGIN;
  for (const u of sub.unions) {
    u.junctionY += MARGIN;
    u.busY += MARGIN;
    if (u.partnerLink) u.partnerLink.y += MARGIN;
    for (const a of u.childAnchors) a.y += MARGIN;
  }

  const maxDepth = sub.persons.reduce((m, p) => Math.max(m, p.depth), 0);
  const personById = new Map(sub.persons.map((p) => [p.personId, p]));
  return {
    persons: sub.persons,
    unions: sub.unions,
    personById,
    width: sub.width + MARGIN * 2,
    height: maxDepth * LEVEL_H + NODE_H + MARGIN * 2,
  };
}
