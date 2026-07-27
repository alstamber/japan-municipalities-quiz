import type { Municipality } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";

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
        {items.map((m) => {
          const st = status[m.cityCode];
          return (
            <div key={m.cityCode} className={`cell cell-${st}`}>
              {st !== "blank" && (
                <>
                  {m.cityName}
                  {m.districtName && <span className="cell-district">（{m.districtName}）</span>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
