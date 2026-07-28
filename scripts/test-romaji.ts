import { MUNICIPALITIES } from "../src/data/municipalities.generated";
import { kanaToBase, normalize, buildCanonicalMap, buildKanaMap, foldKana } from "../src/lib/romaji";

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

// 4. お列 long vowel: NO leniency at all (reverted — "o" and "oo" both rejected,
// only the literal "ou" spelling is accepted, same strictness as え/う columns).
check("toubetsu", namesFor("toubetsu"), ["当別町"]);
check("tobetsu (should NOT match)", namesFor("tobetsu"), []);
check("toobetsu (should NOT match)", namesFor("toobetsu"), []);
// The 町 suffix reading itself is ちょう (cho+u), so under full strictness the
// only accepted with-suffix spelling is "...chou", not "...cho".
check("toubetsuchou", namesFor("toubetsuchou"), ["当別町"]);
check("toubetsucho (should NOT match, missing final u)", namesFor("toubetsucho"), []);
check("tobetsucho (should NOT match)", namesFor("tobetsucho"), []);
check("toobetsucho (should NOT match)", namesFor("toobetsucho"), []);
check("koutou -> 江東区", namesFor("koutou"), ["江東区"]);
check("kotou (should NOT match)", namesFor("kotou"), []);
check("koto (should NOT match)", namesFor("koto"), []);

// 5. え列 long vowel: NO leniency at all
check("biei", namesFor("biei"), ["美瑛町"]);
check("bieichou", namesFor("bieichou"), ["美瑛町"]);
check("bieicho (should NOT match, missing final u)", namesFor("bieicho"), []);
check("biee (should NOT match)", namesFor("biee"), []);
check("bie (should NOT match)", namesFor("bie"), []);

// 6. Hepburn/Kunrei consonant folds, both directions
check("shizuoka == sizuoka", normalize("shizuoka"), normalize("sizuoka"));
check("tsu == tu (both directions map to same canonical)", normalize("matsudo"), normalize("matudo"));

// 7. ん handling: every non-final real ん optionally doubles to "nn"
// (IME-style typing habit, not just the classic んや/んゆ/んよ Hepburn
// ambiguity), and a word-final ん strictly requires "nn".
check("nanyoushi", namesFor("nanyoushi"), ["南陽市"]);
check("nannyoushi", namesFor("nannyoushi"), ["南陽市"]);
// Regression: "sanno" must NOT match 佐野市 (さのし, no ん at all — the "nn"
// in "sanno" is just a coincidental "n"+"no" concatenation, not a real ん,
// so it must never fold down to "sano").
check("sano -> 佐野市", namesFor("sano"), ["佐野市"]);
check("sanno (should NOT match 佐野市)", namesFor("sanno"), []);
// Regression: 陸前高田市's りくぜんたかた has ん before た (not や/ゆ/よ), which
// must still accept the doubled "rikuzenntakata" spelling.
check("rikuzentakata", namesFor("rikuzentakata"), ["陸前高田市"]);
check("rikuzenntakata (doubled ん before a plain consonant)", namesFor("rikuzenntakata"), ["陸前高田市"]);
// 東員町's suffix-stripped base とういん ends in ん (word-final).
check("touinn (word-final ん, doubled)", namesFor("touinn"), ["東員町"]);
check("touin (single trailing n, should NOT match)", namesFor("touin"), []);
// With the suffix included, ん is no longer word-final (ちょう follows), so
// it's just a regular non-final ん — both single and doubled n work.
check("touinchou (with suffix, ん not final)", namesFor("touinchou"), ["東員町"]);
check("touinnchou (with suffix, doubled non-final ん)", namesFor("touinnchou"), ["東員町"]);

// 8. Suffix variety: ward, town (both machi/cho readings), village (both mura/son)
// NOTE: 千代田区(Tokyo) and 千代田町(Gunma) share the base reading "chiyoda" once
// suffixes are stripped, so both legitimately fill on "chiyoda" — this is the
// same "fill every match" behavior as any other duplicate reading, just
// surfaced by making the suffix optional. "chiyodaku" still isolates the ward.
check("chiyoda (no suffix) -> both 千代田区/町", namesFor("chiyoda").sort(), ["千代田区", "千代田町"].sort());
check("chiyodaku (ward, with suffix)", namesFor("chiyodaku"), ["千代田区"]);
check("higashi (village, son reading, no suffix)", namesFor("higashi"), ["東村"]);
// 東村's full reading ひがしそん ends in ん, so the with-suffix form requires
// the word-final "nn" doubling — "higashison" (single n) must NOT match.
check("higashisonn (village, son reading, with suffix, doubled n)", namesFor("higashisonn"), ["東村"]);
check("higashison (single trailing n, should NOT match)", namesFor("higashison"), []);

// 9. Direct hiragana matching (buildKanaMap)
const kMap = buildKanaMap(MUNICIPALITIES);
console.log(`kanaMap has ${kMap.size} distinct keys for ${MUNICIPALITIES.length} entries`);

function kanaNamesFor(input: string): string[] {
  const codes = kMap.get(foldKana(input.trim())) ?? [];
  return codes.map((c) => MUNICIPALITIES.find((m) => m.cityCode === c)?.cityName ?? c);
}

check("さっぽろし (full reading, with suffix)", kanaNamesFor("さっぽろし"), ["札幌市"]);
check("さっぽろ (suffix-stripped)", kanaNamesFor("さっぽろ"), ["札幌市"]);
check("さっぽ (prefix, should NOT match)", kanaNamesFor("さっぽ"), []);

// Same duplicate-fill behavior as the romaji map, over the same collisions.
check("ふちゅうし -> both 府中市", kanaNamesFor("ふちゅうし").sort(), ["府中市", "府中市"].sort());
check("ふちゅう (no suffix) -> 府中市 x2 + 府中町", kanaNamesFor("ふちゅう").sort(), ["府中市", "府中市", "府中町"].sort());

// づ/ず fold: official readings use づ, but ず is the phonetically natural
// spelling an IME will produce — both must match.
check("ぬまづし (official づ spelling)", kanaNamesFor("ぬまづし"), ["沼津市"]);
check("ぬまずし (folded ず spelling)", kanaNamesFor("ぬまずし"), ["沼津市"]);
check("きさらづし (official づ spelling)", kanaNamesFor("きさらづし"), ["木更津市"]);
check("きさらずし (folded ず spelling)", kanaNamesFor("きさらずし"), ["木更津市"]);
check("たからづかし (official づ spelling)", kanaNamesFor("たからづかし"), ["宝塚市"]);
check("たからずかし (folded ず spelling)", kanaNamesFor("たからずかし"), ["宝塚市"]);

// ぢ/じ fold, same reasoning.
check("おぢやし (official ぢ spelling)", kanaNamesFor("おぢやし"), ["小千谷市"]);
check("おじやし (folded じ spelling)", kanaNamesFor("おじやし"), ["小千谷市"]);

// foldKana unit checks.
check("foldKana leaves unrelated kana alone", foldKana("さっぽろ"), "さっぽろ");
check("foldKana づ -> ず", foldKana("ぬまづ"), "ぬまず");
check("foldKana ぢ -> じ", foldKana("おぢや"), "おじや");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
