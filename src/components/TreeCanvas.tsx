import { useEffect, useMemo, useRef } from 'react';
import type { Layout } from '../lib/layout';
import { NODE_H, UNION_SIZE, computeLayout } from '../lib/layout';
import { useStore } from '../store';
import { PersonCard } from './PersonCard';
import { UnionNode } from './UnionNode';
import type { Viewport } from '../hooks/useViewport';

interface Props {
  stageRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport;
  panning: boolean;
  handlers: React.ComponentProps<'div'>;
  onLayout: (layout: Layout) => void;
}

/**
 * Marriage and descent are drawn in two visually distinct languages, because
 * a plain line between two boxes reads the same whether it joins spouses or
 * siblings. Marriage is a short heavy bar between adjacent boxes, always
 * passing through the couple's node; descent always starts *at* that node,
 * drops, and fans out along a lighter sibling bar.
 */
function buildPaths(layout: Layout): { marriage: string; descent: string } {
  const marriage: string[] = [];
  const descent: string[] = [];

  for (const union of layout.unions) {
    if (union.partnerLink) {
      const { x1, x2, y } = union.partnerLink;
      marriage.push(`M ${x1} ${y} H ${x2}`);
    }
    if (union.stem) {
      marriage.push(`M ${union.stem.x} ${union.stem.y1} V ${union.stem.y2}`);
    }
    if (union.childAnchors.length === 0) continue;

    const xs = union.childAnchors.map((a) => a.x);
    const left = Math.min(...xs, union.x);
    const right = Math.max(...xs, union.x);
    descent.push(`M ${union.x} ${union.y + UNION_SIZE / 2} V ${union.busY}`);
    descent.push(`M ${left} ${union.busY} H ${right}`);
    for (const anchor of union.childAnchors) {
      descent.push(`M ${anchor.x} ${union.busY} V ${anchor.y}`);
    }
  }
  return { marriage: marriage.join(' '), descent: descent.join(' ') };
}

export function TreeCanvas({ stageRef, viewport, panning, handlers, onLayout }: Props) {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const selectPerson = useStore((s) => s.selectPerson);
  const selectUnion = useStore((s) => s.selectUnion);
  const clearSelection = useStore((s) => s.clearSelection);
  const addPartner = useStore((s) => s.addPartner);
  const addChildToPerson = useStore((s) => s.addChildToPerson);
  const addChild = useStore((s) => s.addChild);

  const layout = useMemo(() => computeLayout(doc), [doc]);
  const paths = useMemo(() => buildPaths(layout), [layout]);

  // Report the layout up so the toolbar's "fit" button knows the content size.
  const reportedRef = useRef(onLayout);
  reportedRef.current = onLayout;
  useEffect(() => {
    reportedRef.current(layout);
  }, [layout]);

  return (
    <div
      ref={stageRef}
      className={`stage ${panning ? 'stage--panning' : ''}`}
      {...handlers}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('.card, .chip, .union')) clearSelection();
      }}
    >
      <div
        className="canvas"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        <svg
          className="canvas__links"
          width={layout.width}
          height={layout.height + NODE_H}
          aria-hidden="true"
        >
          <path d={paths.descent} fill="none" stroke="var(--link)" strokeWidth={2} />
          <path
            d={paths.marriage}
            fill="none"
            stroke="var(--link-strong)"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </svg>

        {layout.unions.map((union) => (
          <UnionNode
            key={union.unionId}
            union={union}
            childCount={doc.unions[union.unionId]?.childIds.length ?? 0}
            selected={selection?.kind === 'union' && selection.id === union.unionId}
            onSelect={selectUnion}
            onAddChild={addChild}
          />
        ))}

        {layout.persons.map((placed) => {
          const person = doc.people[placed.personId];
          if (!person) return null;
          return (
            <PersonCard
              key={placed.personId}
              person={person}
              x={placed.x}
              y={placed.y}
              selected={selection?.kind === 'person' && selection.id === placed.personId}
              surnameColors={doc.surnameColors}
              onSelect={selectPerson}
              onAddPartner={addPartner}
              onAddChild={addChildToPerson}
            />
          );
        })}
      </div>
    </div>
  );
}
