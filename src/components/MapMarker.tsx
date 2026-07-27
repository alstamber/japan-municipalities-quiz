import { memo } from "react";
import type { EntryStatus } from "../types";

interface Props {
  cx: number;
  cy: number;
  status: EntryStatus;
  title: string;
}

/** Memoized for the same reason as MapShape — see that file. */
function MapMarkerImpl({ cx, cy, status, title }: Props) {
  return (
    <circle cx={cx} cy={cy} r={2.5} className={`map-marker map-marker-${status}`}>
      {(status === "solved" || status === "inactive") && <title>{title}</title>}
    </circle>
  );
}

export const MapMarker = memo(MapMarkerImpl);
