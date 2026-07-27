import { useMemo } from "react";
import type { Municipality } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";
import { PrefectureSection } from "./PrefectureSection";

interface Props {
  municipalities: Municipality[];
  status: Record<string, EntryStatus>;
}

interface Group {
  prefName: string;
  items: Municipality[];
}

export function MunicipalityTable({ municipalities, status }: Props) {
  // municipalities.generated.ts is already sorted by (prefOrder, kana), so a
  // single pass groupBy preserves the correct display order.
  const groups = useMemo(() => {
    const byPrefOrder = new Map<number, Group>();
    for (const m of municipalities) {
      let group = byPrefOrder.get(m.prefOrder);
      if (!group) {
        group = { prefName: m.prefName, items: [] };
        byPrefOrder.set(m.prefOrder, group);
      }
      group.items.push(m);
    }
    return [...byPrefOrder.entries()].sort((a, b) => a[0] - b[0]).map(([, group]) => group);
  }, [municipalities]);

  return (
    <div className="municipality-table">
      {groups.map((group) => (
        <PrefectureSection key={group.prefName} prefName={group.prefName} items={group.items} status={status} />
      ))}
    </div>
  );
}
