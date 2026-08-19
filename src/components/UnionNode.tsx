import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LaidOutUnion } from '../lib/layout';
import { UNION_SIZE } from '../lib/layout';

interface Props {
  union: LaidOutUnion;
  childCount: number;
  selected: boolean;
  onSelect: (unionId: string) => void;
  onAddChild: (unionId: string) => void;
}

/**
 * The visible knot where two people are joined. Making the couple itself a
 * thing on the canvas is what stops a spouse from reading as a sibling: every
 * descent line starts here, and nothing else does.
 */
function UnionNodeInner({ union, childCount, selected, onSelect, onAddChild }: Props) {
  const { t } = useTranslation();
  const size = UNION_SIZE;
  return (
    <>
      <button
        type="button"
        className={`union ${selected ? 'union--selected' : ''}`}
        style={{ left: union.x - size / 2, top: union.y - size / 2, width: size, height: size }}
        onClick={() => onSelect(union.unionId)}
        aria-pressed={selected}
        title={t('union.title')}
        aria-label={childCount === 0 ? t('union.noChildren') : t('union.childCount', { count: childCount })}
      />
      {selected && (
        <div className="union__actions" style={{ left: union.x, top: union.y + size / 2 + 6 }}>
          <button type="button" className="chip" onClick={() => onAddChild(union.unionId)}>
            + {t('actions.addChild')}
          </button>
        </div>
      )}
    </>
  );
}

export const UnionNode = memo(UnionNodeInner);
