import { useEffect, useMemo, useRef } from 'react';
import type { Layout } from '../lib/layout';
import { NODE_H, computeLayout } from '../lib/layout';
import { useStore } from '../store';
import { PersonCard } from './PersonCard';
import type { Viewport } from '../hooks/useViewport';

interface Props {
  stageRef: React.RefObject<HTMLDivElement>;
  viewport: Viewport;
  panning: boolean;
  handlers: React.ComponentProps<'div'>;
  onLayout: (layout: Layout) => void;
}

/** Orthogonal connectors: a drop from the couple, a sibling bar, a drop per child. */
function buildLinkPath(layout: Layout): string {
  const parts: string[] = [];
  for (const union of layout.unions) {
    if (union.partnerLink) {
      const { x1, x2, y } = union.partnerLink;
      parts.push(`M ${x1} ${y} H ${x2}`);
    }
    if (union.childAnchors.length === 0) continue;
    const xs = union.childAnchors.map((a) => a.x);
    const left = Math.min(...xs, union.junctionX);
    const right = Math.max(...xs, union.junctionX);
    parts.push(`M ${union.junctionX} ${union.junctionY} V ${union.busY}`);
    parts.push(`M ${left} ${union.busY} H ${right}`);
    for (const anchor of union.childAnchors) {
      parts.push(`M ${anchor.x} ${union.busY} V ${anchor.y}`);
    }
  }
  return parts.join(' ');
}

export function TreeCanvas({ stageRef, viewport, panning, handlers, onLayout }: Props) {
  const doc = useStore((s) => s.doc);
  const selectedPersonId = useStore((s) => s.selectedPersonId);
  const select = useStore((s) => s.select);
  const addPartner = useStore((s) => s.addPartner);
  const addChildToPerson = useStore((s) => s.addChildToPerson);

  const layout = useMemo(() => computeLayout(doc), [doc]);
  const linkPath = useMemo(() => buildLinkPath(layout), [layout]);

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
        if (!(e.target as HTMLElement).closest('.card, .chip')) select(null);
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
          <path
            d={linkPath}
            fill="none"
            stroke="var(--link)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>

        {layout.persons.map((placed) => {
          const person = doc.people[placed.personId];
          if (!person) return null;
          return (
            <PersonCard
              key={placed.personId}
              person={person}
              x={placed.x}
              y={placed.y}
              selected={selectedPersonId === placed.personId}
              surnameColors={doc.surnameColors}
              onSelect={select}
              onAddPartner={addPartner}
              onAddChild={addChildToPerson}
            />
          );
        })}
      </div>
    </div>
  );
}
