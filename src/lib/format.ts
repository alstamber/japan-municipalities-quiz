import type { Municipality } from "../data/municipalities.generated";

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** "cityName（districtName）" when a district is set to disambiguate, else
 * just "cityName". */
export function formatMunicipalityName(m: Municipality | undefined): string {
  if (!m) return "";
  return m.districtName ? `${m.cityName}（${m.districtName}）` : m.cityName;
}
