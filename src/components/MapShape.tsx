import { memo } from "react";
import type { EntryStatus } from "../types";

interface Props {
  d: string;
  status: EntryStatus;
  title: string;
}

/** Memoized so that filling in one municipality doesn't force React to
 * re-render/diff every shape on the map — only the ones whose `status`
 * actually changed. `d` and `title` are precomputed once and never change. */
function MapShapeImpl({ d, status, title }: Props) {
  return (
    <path d={d} className={`map-shape map-shape-${status}`}>
      {(status === "solved" || status === "inactive") && <title>{title}</title>}
    </path>
  );
}

export const MapShape = memo(MapShapeImpl);
