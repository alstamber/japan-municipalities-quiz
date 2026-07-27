import { memo } from "react";
import type { Municipality } from "../data/municipalities.generated";
import type { EntryStatus } from "../types";

interface Props {
  municipality: Municipality;
  status: EntryStatus;
}

/** Memoized so that filling in one municipality doesn't force React to
 * re-render/diff all ~1747 table cells — only the handful whose `status`
 * actually changed re-render, since `municipality` is a stable reference
 * from the constant MUNICIPALITIES array and `status` is a primitive. */
function MunicipalityCellImpl({ municipality, status }: Props) {
  return (
    <div className={`cell cell-${status}`}>
      {status !== "blank" && (
        <>
          {municipality.cityName}
          {municipality.districtName && <span className="cell-district">（{municipality.districtName}）</span>}
        </>
      )}
    </div>
  );
}

export const MunicipalityCell = memo(MunicipalityCellImpl);
