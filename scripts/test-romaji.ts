import { MUNICIPALITIES } from "../src/data/municipalities.generated";
import { kanaToBase, normalize, buildCanonicalMap } from "../src/lib/romaji";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

// Unknown-character coverage check across the full dataset.
const unknownCharPattern = /[^a-zぁ-んー]/u;
let unknownCount = 0;
for (const m of MUNICIPALITIES) {
  const base = kanaToBase(m.cityKana);
  if (/[^a-z]/.test(base)) {
    unknownCount++;
    console.error(`unmapped char in ${m.cityName} (${m.cityKana}) -> ${base}`);
  }
}
console.log(`kanaToBase produced non-latin output for ${unknownCount} / ${MUNICIPALITIES.length} entries`);

const map = buildCanonicalMap(MUNICIPALITIES);
console.log(`canonicalMap has ${map.size} distinct keys for ${MUNICIPALITIES.length} entries`);

function namesFor(input: string): string[] {
  const codes = map.get(normalize(input)) ?? [];
  return codes.map((c) => MUNICIPALITIES.find((m) => m.cityCode === c)?.cityName ?? c);
}

// 1. Basic live match, suffix optional
check("sapporo (no suffix)", namesFor("sapporo"), ["札幌市"]);
check("sapporoshi (with suffix)", namesFor("sapporoshi"), ["札幌市"]);

// 2. Prefix must not match
check("sap (prefix)", namesFor("sap"), []);
check("sappo (prefix)", namesFor("sappo"), []);

// 3. Simultaneous duplicates
// 府中市's kana is ふちゅうし (fu+chu+u+shi) — う column, like え column, gets no
// leniency, so the literal double-u form is the only accepted spelling.
check("fuchuushi -> both 府中市", namesFor("fuchuushi").sort(), ["府中市", "府中市"].sort());
// Also collides with 府中町(広島県, ふちゅうちょう) once its suffix is stripped —
// same "fill every match" behavior, just a third entry sharing the base reading.
check("fuchuu (no suffix) -> 府中市 x2 + 府中町", namesFor("fuchuu").sort(), ["府中市", "府中市", "府中町"].sort());
check("fuchushi (single u, should NOT match)", namesFor("fuchushi"), []);
check("tomarimura -> both 泊村", namesFor("tomarimura").sort(), ["泊村", "泊村"].sort());
check("tomari (no suffix) -> both 泊村", namesFor("tomari").sort(), ["泊村", "泊村"].sort());

// 4. お列 long vowel: ou and o both accepted, oo rejected
check("toubetsu", namesFor("toubetsu"), ["当別町"]);
check("tobetsu", namesFor("tobetsu"), ["当別町"]);
check("toobetsu (should NOT match)", namesFor("toobetsu"), []);
check("toubetsucho", namesFor("toubetsucho"), ["当別町"]);
check("tobetsucho", namesFor("tobetsucho"), ["当別町"]);
check("toobetsucho (should NOT match)", namesFor("toobetsucho"), []);

// 5. え列 long vowel: NO leniency at all
check("biei", namesFor("biei"), ["美瑛町"]);
check("bieicho", namesFor("bieicho"), ["美瑛町"]);
check("biee (should NOT match)", namesFor("biee"), []);
check("bie (should NOT match)", namesFor("bie"), []);

// 6. Hepburn/Kunrei consonant folds, both directions
check("shizuoka == sizuoka", normalize("shizuoka"), normalize("sizuoka"));
check("tsu == tu (both directions map to same canonical)", normalize("matsudo"), normalize("matudo"));

// 7. ん run collapsing
check("nanyoushi", namesFor("nanyoushi"), ["南陽市"]);
check("nannyoushi", namesFor("nannyoushi"), ["南陽市"]);

// 8. Suffix variety: ward, town (both machi/cho readings), village (both mura/son)
// NOTE: 千代田区(Tokyo) and 千代田町(Gunma) share the base reading "chiyoda" once
// suffixes are stripped, so both legitimately fill on "chiyoda" — this is the
// same "fill every match" behavior as any other duplicate reading, just
// surfaced by making the suffix optional. "chiyodaku" still isolates the ward.
check("chiyoda (no suffix) -> both 千代田区/町", namesFor("chiyoda").sort(), ["千代田区", "千代田町"].sort());
check("chiyodaku (ward, with suffix)", namesFor("chiyodaku"), ["千代田区"]);
check("higashi (village, son reading, no suffix)", namesFor("higashi"), ["東村"]);
check("higashison (village, son reading, with suffix)", namesFor("higashison"), ["東村"]);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
