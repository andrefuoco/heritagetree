import test from 'node:test';
import assert from 'node:assert/strict';
import { docBuilder, loadLayout } from './helpers.mjs';

const { computeLayout, NODE_W, NODE_H } = await loadLayout();

/** Every descent line must end on the top-centre of the box it points at. */
function checkAnchors(layout) {
  for (const union of layout.unions) {
    for (const anchor of union.childAnchors) {
      const box = layout.personById.get(anchor.personId);
      assert.ok(box, `line points at ${anchor.personId}, which is not drawn`);
      assert.ok(
        Math.abs(anchor.x - (box.x + NODE_W / 2)) < 0.5,
        `line lands at ${anchor.x} but ${anchor.personId} is centred at ${box.x + NODE_W / 2}`,
      );
      assert.ok(
        Math.abs(anchor.y - box.y) < 0.5,
        `line ends at y=${anchor.y} but the box top is ${box.y}`,
      );
    }
  }
}

function checkNoOverlap(layout) {
  const boxes = layout.persons;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const hit =
        a.x < b.x + NODE_W - 1 && a.x + NODE_W > b.x + 1 &&
        a.y < b.y + NODE_H - 1 && a.y + NODE_H > b.y + 1;
      assert.ok(!hit, `${a.personId} overlaps ${b.personId}`);
    }
  }
}

function checkEveryoneDrawnOnce(layout, doc) {
  const seen = new Set();
  for (const p of layout.persons) {
    assert.ok(!seen.has(p.personId), `${p.personId} is drawn twice`);
    seen.add(p.personId);
  }
  for (const id of Object.keys(doc.people)) {
    assert.ok(seen.has(id), `${id} is in the document but never drawn`);
  }
}

function checkAll(doc) {
  const layout = computeLayout(doc);
  checkAnchors(layout);
  checkNoOverlap(layout);
  checkEveryoneDrawnOnce(layout, doc);
  return layout;
}

test('a lone child hangs directly under its parents', () => {
  const b = docBuilder();
  const { unionId, father } = b.couple();
  b.doc.rootPersonId = father;
  const child = b.child(unionId);
  const partner = b.person();
  const theirs = b.union(child, partner);
  b.child(theirs);
  b.child(theirs);

  const layout = checkAll(b.doc);
  const union = layout.unions.find((u) => u.unionId === unionId);
  const box = layout.personById.get(child);
  // The couple's node sits over the child, not over the child's whole branch.
  assert.ok(Math.abs(union.x - (box.x + NODE_W / 2)) < 0.5);
});

test('several branches stay clear of each other', () => {
  const b = docBuilder();
  const { unionId, father } = b.couple();
  b.doc.rootPersonId = father;
  for (let i = 0; i < 4; i++) {
    const child = b.child(unionId);
    const theirs = b.union(child, b.person());
    b.child(theirs);
    b.child(theirs);
  }
  checkAll(b.doc);
});

test('a married-in spouse can have parents and siblings of their own', () => {
  const b = docBuilder();
  const { unionId, father, mother } = b.couple();
  b.doc.rootPersonId = father;
  b.child(unionId);
  const { unionId: hers } = b.parentsOf(mother);
  b.child(hers);
  b.child(hers);

  const layout = checkAll(b.doc);
  const herParents = layout.unions.find((u) => u.unionId === hers);
  // Her parents sit one generation above her, and their line reaches her.
  assert.ok(herParents.childAnchors.some((a) => a.personId === mother));
  assert.equal(layout.personById.get(father).depth - 1, herParents.depth);
});

test('ancestors stack for several generations above a spouse', () => {
  const b = docBuilder();
  const { unionId, father, mother } = b.couple();
  b.doc.rootPersonId = father;
  b.child(unionId);
  let top = mother;
  for (let i = 0; i < 3; i++) top = b.parentsOf(top).father;

  const layout = checkAll(b.doc);
  const depths = layout.persons.map((p) => p.depth);
  assert.equal(Math.min(...depths), -3);
});

test('both marriages keep their own children', () => {
  const b = docBuilder();
  const husband = b.person({ gender: 'male' });
  b.doc.rootPersonId = husband;
  const first = b.union(husband, b.person({ gender: 'female' }));
  const second = b.union(husband, b.person({ gender: 'female' }));
  b.child(first);
  b.child(first);
  b.child(second);

  const layout = checkAll(b.doc);
  const a = layout.unions.find((u) => u.unionId === first);
  const c = layout.unions.find((u) => u.unionId === second);
  assert.equal(a.childAnchors.length, 2);
  assert.equal(c.childAnchors.length, 1);
  // Their bars overlap horizontally, so they must not share a line.
  const spanA = [Math.min(...a.childAnchors.map((x) => x.x), a.x), Math.max(...a.childAnchors.map((x) => x.x), a.x)];
  const spanC = [Math.min(...c.childAnchors.map((x) => x.x), c.x), Math.max(...c.childAnchors.map((x) => x.x), c.x)];
  if (spanA[0] < spanC[1] - 2 && spanA[1] > spanC[0] + 2) assert.notEqual(a.busY, c.busY);
});

test('a lone parent still gets a union node to hang children from', () => {
  const b = docBuilder();
  const parent = b.person({ gender: 'female' });
  b.doc.rootPersonId = parent;
  const only = b.union(parent);
  b.child(only);

  const layout = checkAll(b.doc);
  const union = layout.unions.find((u) => u.unionId === only);
  assert.equal(union.partnerLink, null);
  assert.ok(union.stem, 'a lone parent needs a stem down to their node');
});

test('a tree of a hundred people lays out without overlapping', () => {
  const b = docBuilder();
  const { unionId, father } = b.couple();
  b.doc.rootPersonId = father;
  const frontier = [unionId];
  while (Object.keys(b.doc.people).length < 100) {
    const current = frontier.shift();
    if (current === undefined) break;
    for (let i = 0; i < 3; i++) {
      const child = b.child(current);
      if (Object.keys(b.doc.people).length > 80) continue;
      frontier.push(b.union(child, b.person()));
    }
  }
  checkAll(b.doc);
});
