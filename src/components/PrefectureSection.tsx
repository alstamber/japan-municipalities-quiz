import type { Municipality } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";
import { MunicipalityCell } from "./MunicipalityCell";

interface Props {
  prefName: string;
  items: Municipality[];
  status: Record<string, EntryStatus>;
}

export function PrefectureSection({ prefName, items, status }: Props) {
  const filledInPref = items.filter((m) => {
    const st = status[m.cityCode];
    return st === "solved" || st === "inactive";
  }).length;

  return (
    <section className="pref-section">
      <h2 className="pref-heading">
        <span>{prefName}</span>
        <span className="pref-count">
          {filledInPref} / {items.length}
        </span>
      </h2>
      <div className="cell-grid">
        {items.map((m) => (
          <MunicipalityCell key={m.cityCode} municipality={m} status={status[m.cityCode]} />
        ))}
      </div>
    </section>
  );
}
