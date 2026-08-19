import type { ID, TreeDocument, Union } from '../types';

export const NODE_W = 168;
export const NODE_H = 74;
/** Horizontal space between two partners — wide enough to hold the union node. */
export const SPOUSE_GAP = 54;
export const SIBLING_GAP = 32;
export const LEVEL_H = 160;
/** Drop from a union node to the horizontal bar its children hang off. */
export const BUS_DROP = 52;
export const MARGIN = 56;
export const UNION_SIZE = 22;
/** Stem length from a lone parent's box down to their union node. */
const STEM = 18;

export interface LaidOutPerson {
  personId: ID;
  x: number;
  y: number;
  depth: number;
}

export interface LaidOutUnion {
  unionId: ID;
  /** Generation the couple sits on; used to lane their children's bars. */
  depth: number;
  /** Centre of the union node. */
  x: number;
  y: number;
  /** The bar the couple's children hang from. */
  busY: number;
  /** x is the child box centre, y its top edge. */
  childAnchors: { personId: ID; x: number; y: number }[];
  /** The marriage line running between two partner boxes. Null for a lone parent. */
  partnerLink: { x1: number; x2: number; y: number } | null;
  /** For a lone parent, the short drop from their box to the union node. */
  stem: { x: number; y1: number; y2: number } | null;
}

export interface Layout {
  persons: LaidOutPerson[];
  unions: LaidOutUnion[];
  personById: Map<ID, LaidOutPerson>;
  unionById: Map<ID, LaidOutUnion>;
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

/* ------------------------------------------------------------------ *
 * Blocks
 *
 * A block is a laid-out fragment of the tree in its own coordinates,
 * together with the horizontal extent it occupies at each generation.
 * Keeping a per-depth extent — rather than one overall width — is what
 * lets a spouse's ancestors be slotted in beside an existing branch
 * instead of being pushed clear of the whole tree.
 * ------------------------------------------------------------------ */

type Extent = Map<number, [number, number]>;

interface Block {
  persons: LaidOutPerson[];
  unions: LaidOutUnion[];
  extent: Extent;
  /** Centre of the block's anchor person's box, in block coordinates. */
  anchorX: number;
}

function newBlock(): Block {
  return { persons: [], unions: [], extent: new Map(), anchorX: 0 };
}

function widen(extent: Extent, depth: number, lo: number, hi: number): void {
  const current = extent.get(depth);
  if (current) extent.set(depth, [Math.min(current[0], lo), Math.max(current[1], hi)]);
  else extent.set(depth, [lo, hi]);
}

function translate(block: Block, dx: number, dy = 0): void {
  if (dx === 0 && dy === 0) return;
  for (const p of block.persons) {
    p.x += dx;
    p.y += dy;
  }
  for (const u of block.unions) {
    u.x += dx;
    u.y += dy;
    u.busY += dy;
    if (u.partnerLink) {
      u.partnerLink.x1 += dx;
      u.partnerLink.x2 += dx;
      u.partnerLink.y += dy;
    }
    if (u.stem) {
      u.stem.x += dx;
      u.stem.y1 += dy;
      u.stem.y2 += dy;
    }
    for (const a of u.childAnchors) {
      a.x += dx;
      a.y += dy;
    }
  }
  if (dx !== 0) {
    const moved: Extent = new Map();
    for (const [d, [lo, hi]] of block.extent) moved.set(d, [lo + dx, hi + dx]);
    block.extent = moved;
    block.anchorX += dx;
  }
}

function absorb(target: Block, source: Block): void {
  target.persons.push(...source.persons);
  target.unions.push(...source.unions);
  for (const [d, [lo, hi]] of source.extent) widen(target.extent, d, lo, hi);
}

/** Smallest positive shift that clears `incoming` past `base` on the right. */
function separateRight(base: Extent, incoming: Extent, gap: number): number {
  let dx = 0;
  for (const [d, [lo]] of incoming) {
    const there = base.get(d);
    if (there) dx = Math.max(dx, there[1] + gap - lo);
  }
  return dx;
}

/** Largest negative shift that clears `incoming` past `base` on the left. */
function separateLeft(base: Extent, incoming: Extent, gap: number): number {
  let dx = 0;
  for (const [d, [, hi]] of incoming) {
    const there = base.get(d);
    if (there) dx = Math.min(dx, there[0] - gap - hi);
  }
  return dx;
}

interface Ctx {
  doc: TreeDocument;
  visited: Set<ID>;
  visitedUnions: Set<ID>;
  unionsByPartner: Map<ID, Union[]>;
}

function indexUnions(doc: TreeDocument): Map<ID, Union[]> {
  const index = new Map<ID, Union[]>();
  for (const union of Object.values(doc.unions)) {
    for (const partnerId of union.partnerIds) {
      const list = index.get(partnerId);
      if (list) list.push(union);
      else index.set(partnerId, [union]);
    }
  }
  return index;
}

/** Places the couple's node between the two boxes, or under a lone parent's. */
function nodeFor(
  unionId: ID,
  rowX: number,
  depth: number,
  leftIndex: number,
  hasBoth: boolean,
  boxLeft: (i: number) => number,
): LaidOutUnion {
  const y = depth * LEVEL_H;
  const offset = hasBoth
    ? boxLeft(leftIndex) + NODE_W + SPOUSE_GAP / 2
    : boxLeft(leftIndex) + NODE_W / 2;
  return {
    unionId,
    depth,
    x: rowX + offset,
    y: hasBoth ? y + NODE_H / 2 : y + NODE_H + STEM,
    busY: y + NODE_H + BUS_DROP,
    childAnchors: [],
    partnerLink: hasBoth
      ? {
          x1: rowX + boxLeft(leftIndex) + NODE_W,
          x2: rowX + boxLeft(leftIndex + 1),
          y: y + NODE_H / 2,
        }
      : null,
    stem: hasBoth ? null : { x: rowX + offset, y1: y + NODE_H, y2: y + NODE_H + STEM },
  };
}

/**
 * Lays out a person with their partners, and recursively everyone descending
 * from them. The returned block starts at x = 0.
 */
function layoutDescent(ctx: Ctx, personId: ID, depth: number): Block {
  const block = newBlock();
  const person = ctx.doc.people[personId];
  if (!person || ctx.visited.has(personId)) return block;
  ctx.visited.add(personId);

  const unions = (ctx.unionsByPartner.get(personId) ?? []).filter(
    (u) => !ctx.visitedUnions.has(u.id),
  );
  const partners = unions.map((u) => {
    const other = otherPartner(u, personId);
    return other && ctx.doc.people[other] && !ctx.visited.has(other) ? other : null;
  });

  // Box order. With one partner the man goes on the left by convention; with
  // two or more the anchor person sits in the middle so every marriage line
  // joins two adjacent boxes instead of jumping over one.
  let order: ID[];
  if (partners.length === 1 && partners[0]) {
    const partner = partners[0];
    const partnerIsMale = ctx.doc.people[partner]?.gender === 'male';
    order = partnerIsMale && person.gender !== 'male' ? [partner, personId] : [personId, partner];
  } else {
    const usable = partners.filter((id): id is ID => !!id);
    const [first, ...rest] = usable;
    order = first ? [first, personId, ...rest] : [personId, ...rest];
  }
  for (const id of order) ctx.visited.add(id);
  for (const u of unions) ctx.visitedUnions.add(u.id);

  const boxLeft = (i: number) => i * (NODE_W + SPOUSE_GAP);
  const rowWidth = order.length * NODE_W + (order.length - 1) * SPOUSE_GAP;
  const selfIndex = Math.max(order.indexOf(personId), 0);

  const geometry = unions.map((u) => {
    const partner = otherPartner(u, personId);
    const partnerIndex = partner ? order.indexOf(partner) : -1;
    const hasBoth = partnerIndex >= 0;
    return { hasBoth, leftIndex: hasBoth ? Math.min(selfIndex, partnerIndex) : selfIndex };
  });

  // Descendants, one contiguous run per union, laid out from a provisional
  // origin of 0; the couple is positioned over them afterwards.
  const children = newBlock();
  const anchors = new Map<ID, { personId: ID; x: number; y: number }[]>();
  for (const union of unions) {
    for (const childId of union.childIds) {
      const sub = layoutDescent(ctx, childId, depth + 1);
      if (sub.persons.length === 0) continue;
      translate(sub, separateRight(children.extent, sub.extent, SIBLING_GAP));
      const list = anchors.get(union.id) ?? [];
      list.push({ personId: childId, x: sub.anchorX, y: (depth + 1) * LEVEL_H });
      anchors.set(union.id, list);
      absorb(children, sub);
    }
  }

  /*
   * Centre the couple over the children's *anchor points* — the boxes the
   * lines actually land on — rather than over their bounding box, so a lone
   * child sits directly beneath its parents instead of being pushed aside by
   * its own spouse and descendants.
   */
  let rowX = 0;
  let childrenX = 0;
  const anchorXs = [...anchors.values()].flat().map((a) => a.x);
  if (anchorXs.length > 0) {
    const mid = (Math.min(...anchorXs) + Math.max(...anchorXs)) / 2;
    const bearing = unions
      .map((u, i) => ({ union: u, geo: geometry[i]! }))
      .filter(({ union }) => (anchors.get(union.id)?.length ?? 0) > 0)
      .map(({ geo }) =>
        geo.hasBoth
          ? boxLeft(geo.leftIndex) + NODE_W + SPOUSE_GAP / 2
          : boxLeft(geo.leftIndex) + NODE_W / 2,
      );
    const pivot = bearing.reduce((acc, v) => acc + v, 0) / bearing.length;
    childrenX = pivot - mid;
    // Neither run may start left of the block's own edge, so whichever would
    // go negative pushes the other across instead.
    const nudge = Math.max(0, -childrenX);
    childrenX += nudge;
    rowX += nudge;
  }

  for (const [i, id] of order.entries()) {
    block.persons.push({ personId: id, x: rowX + boxLeft(i), y: depth * LEVEL_H, depth });
  }
  widen(block.extent, depth, rowX, rowX + rowWidth);
  block.anchorX = rowX + boxLeft(selfIndex) + NODE_W / 2;

  translate(children, childrenX);
  // The anchor records live outside the children block, so they have to be
  // carried across by hand — otherwise every descent line lands short of the
  // box it points at.
  for (const list of anchors.values()) {
    for (const anchor of list) anchor.x += childrenX;
  }
  for (const [i, union] of unions.entries()) {
    const geo = geometry[i]!;
    const node = nodeFor(union.id, rowX, depth, geo.leftIndex, geo.hasBoth, boxLeft);
    node.childAnchors = anchors.get(union.id) ?? [];
    block.unions.push(node);
  }
  absorb(block, children);

  const minX = Math.min(...[...block.extent.values()].map(([lo]) => lo));
  translate(block, -minX);
  return block;
}

/**
 * Builds the block that sits above an already-placed person: their parents,
 * plus any siblings (with the siblings' own descendants) laid out to one side
 * of them. The anchor person themself is NOT part of the block — they are
 * already drawn — so the block's anchor is the empty spot where they sit, at
 * x = 0.
 */
function layoutAncestry(ctx: Ctx, personId: ID, depth: number, side: 1 | -1): Block | null {
  const person = ctx.doc.people[personId];
  const union = person?.parentUnionId ? ctx.doc.unions[person.parentUnionId] : undefined;
  if (!union || ctx.visitedUnions.has(union.id)) return null;
  ctx.visitedUnions.add(union.id);

  const block = newBlock();
  const anchorList = [{ personId, x: 0, y: depth * LEVEL_H }];
  // The anchor person's own box is already on the canvas; reserve its space so
  // siblings pack beside it rather than on top of it.
  const reserved: Extent = new Map([[depth, [-NODE_W / 2, NODE_W / 2]]]);

  for (const siblingId of union.childIds) {
    if (siblingId === personId) continue;
    const sub = layoutDescent(ctx, siblingId, depth);
    if (sub.persons.length === 0) continue;
    translate(
      sub,
      side > 0
        ? separateRight(reserved, sub.extent, SIBLING_GAP)
        : separateLeft(reserved, sub.extent, SIBLING_GAP),
    );
    anchorList.push({ personId: siblingId, x: sub.anchorX, y: depth * LEVEL_H });
    for (const [d, [lo, hi]] of sub.extent) widen(reserved, d, lo, hi);
    absorb(block, sub);
  }

  const parents = union.partnerIds.filter((id) => ctx.doc.people[id] && !ctx.visited.has(id));
  if (parents.length === 0) return block.persons.length > 0 ? block : null;
  // Men on the left, matching the convention used for couples further down.
  parents.sort((a, b) => Number(ctx.doc.people[b]?.gender === 'male') - Number(ctx.doc.people[a]?.gender === 'male'));

  const boxLeft = (i: number) => i * (NODE_W + SPOUSE_GAP);
  const hasBoth = parents.length >= 2;
  const offset = hasBoth ? NODE_W + SPOUSE_GAP / 2 : NODE_W / 2;
  const xs = anchorList.map((a) => a.x);
  const rowX = (Math.min(...xs) + Math.max(...xs)) / 2 - offset;
  const parentDepth = depth - 1;

  for (const [i, id] of parents.entries()) {
    ctx.visited.add(id);
    block.persons.push({
      personId: id,
      x: rowX + boxLeft(i),
      y: parentDepth * LEVEL_H,
      depth: parentDepth,
    });
  }
  widen(
    block.extent,
    parentDepth,
    rowX,
    rowX + parents.length * NODE_W + (parents.length - 1) * SPOUSE_GAP,
  );

  const node = nodeFor(union.id, rowX, parentDepth, 0, hasBoth, boxLeft);
  node.childAnchors = anchorList;
  block.unions.push(node);
  return block;
}

/* ------------------------------------------------------------------ *
 * Occupancy — where every generation is already spoken for, so an
 * ancestry block can be slotted into a real gap.
 * ------------------------------------------------------------------ */

type Occupancy = Map<number, [number, number][]>;

function occupy(occupancy: Occupancy, extent: Extent): void {
  for (const [d, span] of extent) {
    const list = occupancy.get(d);
    if (list) list.push(span);
    else occupancy.set(d, [span]);
  }
}

/**
 * Finds the shift closest to `preferred` at which `extent` overlaps nothing.
 * Tries sliding both ways and keeps whichever moves least.
 */
function findGap(occupancy: Occupancy, extent: Extent, preferred: number, gap: number): number {
  const slide = (direction: 1 | -1): number | null => {
    let dx = preferred;
    for (let step = 0; step < 200; step++) {
      let worst: number | null = null;
      for (const [d, [lo, hi]] of extent) {
        for (const [a, b] of occupancy.get(d) ?? []) {
          if (lo + dx < b + gap && hi + dx > a - gap) {
            const shift = direction > 0 ? b + gap - (lo + dx) : a - gap - (hi + dx);
            if (worst === null || Math.abs(shift) > Math.abs(worst)) worst = shift;
          }
        }
      }
      if (worst === null) return dx;
      dx += worst;
    }
    return null;
  };
  const right = slide(1);
  const left = slide(-1);
  if (right === null) return left ?? preferred;
  if (left === null) return right;
  return Math.abs(right - preferred) <= Math.abs(left - preferred) ? right : left;
}

/** Which way a person's siblings should be stacked: away from their partners. */
function freeSide(placed: LaidOutPerson, persons: LaidOutPerson[]): 1 | -1 {
  const rightEdge = placed.x + NODE_W;
  const crowdedRight = persons.some(
    (p) =>
      p.depth === placed.depth &&
      p.personId !== placed.personId &&
      p.x >= rightEdge &&
      p.x < rightEdge + SPOUSE_GAP + SIBLING_GAP,
  );
  return crowdedRight ? -1 : 1;
}


/** Horizontal room between two children's bars stacked on the same generation. */
const LANE_H = 14;

/**
 * Children's bars are drawn at one height per generation, so two couples whose
 * bars span overlapping ground would run almost on top of each other and read
 * as one line. Give each overlapping bar its own lane — shortest first, so the
 * common case of a couple sitting directly over its children keeps the tightest
 * drop.
 */
function assignBusLanes(unions: LaidOutUnion[]): void {
  const byDepth = new Map<number, LaidOutUnion[]>();
  for (const union of unions) {
    if (union.childAnchors.length === 0) continue;
    const list = byDepth.get(union.depth);
    if (list) list.push(union);
    else byDepth.set(union.depth, [union]);
  }

  for (const row of byDepth.values()) {
    const spans = row
      .map((union) => {
        const xs = union.childAnchors.map((a) => a.x);
        return { union, lo: Math.min(...xs, union.x), hi: Math.max(...xs, union.x) };
      })
      .sort((a, b) => a.hi - a.lo - (b.hi - b.lo));

    const taken: { lo: number; hi: number; lane: number }[] = [];
    for (const span of spans) {
      let lane = 0;
      while (
        taken.some(
          (other) => other.lane === lane && span.lo < other.hi - 2 && span.hi > other.lo + 2,
        )
      ) {
        lane += 1;
      }
      taken.push({ lo: span.lo, hi: span.hi, lane });
      span.union.busY += lane * LANE_H;
    }
  }
}

const EMPTY_LAYOUT: Layout = {
  persons: [],
  unions: [],
  personById: new Map(),
  unionById: new Map(),
  width: 0,
  height: 0,
};

export function computeLayout(doc: TreeDocument): Layout {
  const rootId = doc.rootPersonId && doc.people[doc.rootPersonId] ? doc.rootPersonId : null;
  if (!rootId) return EMPTY_LAYOUT;

  const ctx: Ctx = {
    doc,
    visited: new Set(),
    visitedUnions: new Set(),
    unionsByPartner: indexUnions(doc),
  };

  const result = layoutDescent(ctx, rootId, 0);
  const occupancy: Occupancy = new Map();
  occupy(occupancy, result.extent);

  /*
   * Anyone on the canvas may have parents of their own — not just the person
   * the main descent happened to start from. Their ancestors are laid out as
   * their own block and slotted into the nearest gap above them, generation by
   * generation, until nobody is left with undrawn parents.
   */
  let frontier = [...result.persons];
  while (frontier.length > 0) {
    const next: LaidOutPerson[] = [];
    for (const placed of frontier) {
      const tower = layoutAncestry(
        ctx,
        placed.personId,
        placed.depth,
        freeSide(placed, result.persons),
      );
      if (!tower || tower.persons.length === 0) continue;
      const centre = placed.x + NODE_W / 2;
      translate(tower, findGap(occupancy, tower.extent, centre, SIBLING_GAP));
      // The anchor person did not move with the block, so point their line
      // back at where they actually are.
      for (const union of tower.unions) {
        for (const anchor of union.childAnchors) {
          if (anchor.personId === placed.personId) anchor.x = centre;
        }
      }
      occupy(occupancy, tower.extent);
      absorb(result, tower);
      next.push(...tower.persons);
    }
    frontier = next;
  }

  assignBusLanes(result.unions);

  const spans = [...result.extent.values()];
  const minX = Math.min(...spans.map(([lo]) => lo));
  const maxX = Math.max(...spans.map(([, hi]) => hi));
  const depths = result.persons.map((p) => p.depth);
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);
  translate(result, MARGIN - minX, MARGIN - minDepth * LEVEL_H);

  return {
    persons: result.persons,
    unions: result.unions,
    personById: new Map(result.persons.map((p) => [p.personId, p])),
    unionById: new Map(result.unions.map((u) => [u.unionId, u])),
    width: maxX - minX + MARGIN * 2,
    height: (maxDepth - minDepth) * LEVEL_H + NODE_H + MARGIN * 2,
  };
}
