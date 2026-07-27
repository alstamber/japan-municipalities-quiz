import type { Municipality } from "../data/municipalities.generated";

// Single-mora romanization. Picking one canonical spelling per mora is fine —
// normalize() below folds Hepburn/Kunrei variants together afterward.
const MORA_TABLE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
};

const YOON_TABLE: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
};

function moraAt(kana: string, i: number): { romaji: string; len: number } | null {
  const twoChar = kana.slice(i, i + 2);
  if (YOON_TABLE[twoChar]) return { romaji: YOON_TABLE[twoChar], len: 2 };
  const oneChar = kana[i];
  if (MORA_TABLE[oneChar]) return { romaji: MORA_TABLE[oneChar], len: 1 };
  return null;
}

/** Mora-by-mora literal romanization of a hiragana reading. っ doubles the
 * following consonant; ん becomes plain "n", except a word-final ん (nothing
 * follows it) becomes "nn" — required doubling, not just leniency, so e.g.
 * 東員町's stripped base とういん must be typed "touinn", not "touin". No
 * long-vowel folding happens here — that's normalize()'s job.
 *
 * Also returns the output-string index right after every non-final ん —
 * IME-style romaji input commonly types ん as "nn" everywhere (not just the
 * classic んや/んゆ/んよ vs にゃ/にゅ/にょ Hepburn ambiguity, e.g. 陸前高田市's
 * りくぜんたかた needs "rikuzenntakata" to work too), so every real ん gets an
 * optional doubled spelling. These positions come directly from the kana,
 * not from pattern-matching the resulting romaji, so they can only ever mark
 * a real ん (that's what fixed "sanno" wrongly matching 佐野市's さの, which
 * has no ん at all) — see kanaToBaseVariants(). */
function kanaToBaseWithDoubleableNPositions(kana: string): { base: string; doubleableAt: number[] } {
  let out = "";
  const doubleableAt: number[] = [];
  let i = 0;
  while (i < kana.length) {
    const ch = kana[i];
    if (ch === "ん") {
      const isFinal = i === kana.length - 1;
      out += isFinal ? "nn" : "n";
      if (!isFinal) {
        doubleableAt.push(out.length);
      }
      i++;
      continue;
    }
    if (ch === "っ") {
      const next = moraAt(kana, i + 1);
      if (next) out += next.romaji[0];
      i++;
      continue;
    }
    const mora = moraAt(kana, i);
    if (mora) {
      out += mora.romaji;
      i += mora.len;
      continue;
    }
    // Unknown character (shouldn't occur in this dataset) — pass through raw.
    out += ch;
    i++;
  }
  return { base: out, doubleableAt };
}

export function kanaToBase(kana: string): string {
  return kanaToBaseWithDoubleableNPositions(kana).base;
}

/** kanaToBase(kana), plus one extra spelling for every non-final real ん,
 * with that ん doubled to "nn". Multiple such ん in one reading combine
 * (every real one is independently optional-doubled). */
export function kanaToBaseVariants(kana: string): string[] {
  const { base, doubleableAt } = kanaToBaseWithDoubleableNPositions(kana);
  if (doubleableAt.length === 0) return [base];

  const variants = new Set<string>();
  const combinations = 1 << doubleableAt.length;
  for (let mask = 0; mask < combinations; mask++) {
    let s = base;
    // Insert right-to-left so earlier positions stay valid as we go.
    for (let bit = doubleableAt.length - 1; bit >= 0; bit--) {
      if (mask & (1 << bit)) {
        const pos = doubleableAt[bit];
        s = s.slice(0, pos) + "n" + s.slice(pos);
      }
    }
    variants.add(s);
  }
  return [...variants];
}

const NORMALIZE_RULES: [RegExp, string][] = [
  // Hepburn <-> Kunrei-shiki digraph/consonant folds.
  [/tya/g, "cha"], [/tyu/g, "chu"], [/tyo/g, "cho"],
  [/cya/g, "cha"], [/cyu/g, "chu"], [/cyo/g, "cho"],
  [/sya/g, "sha"], [/syu/g, "shu"], [/syo/g, "sho"],
  [/zya/g, "ja"], [/zyu/g, "ju"], [/zyo/g, "jo"],
  [/si/g, "shi"], [/ti/g, "chi"], [/tu/g, "tsu"], [/hu/g, "fu"],
  [/di/g, "ji"], [/du/g, "zu"], [/zi/g, "ji"],
  // Sokuon before ch: "maccha" and "matcha" style spellings converge.
  [/cch/g, "tch"],
  // No long-vowel leniency at all, for ANY vowel column. お列/え列/う列 etc. must
  // be typed literally, mora-by-mora (e.g. 江東区=こうとうく requires "koutou",
  // not "kotou" or "koto"). This was previously more lenient for お列 (folding
  // "ou"->"o"), but that was explicitly reverted per product decision.
];

// んの表記ゆれ (n vs nn for every non-final ん, and required word-final
// doubling) is handled entirely by kanaToBaseVariants() generating the exact accepted
// spellings from the kana itself — not by pattern-matching the romaji here.
// An earlier version tried to fold this in normalize() with a generic
// `n{2,}` regex, which incorrectly treated any coincidental double-n as the
// same ambiguity (e.g. "sanno" wrongly matched 佐野市's "sano", which has no
// ん at all). Deriving the leniency from real ん positions in the kana avoids
// that entire class of bug by construction.

/** Reduces romaji (from either the reference kana or live user input) to one
 * canonical comparable form. Applying the same function to both sides is
 * what makes the leniency rules symmetric. */
export function normalize(input: string): string {
  let s = input.toLowerCase().replace(/[^a-z]/g, "");
  for (const [pattern, replacement] of NORMALIZE_RULES) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

const SUFFIX_KANA: Record<string, string[]> = {
  市: ["し"],
  区: ["く"],
  町: ["ちょう", "まち"],
  村: ["むら", "そん"],
};

/** Returns the reading with the trailing 市/町/区/村 mora(s) removed, or null
 * if the name doesn't end in one of those or the kana doesn't end with a
 * recognized suffix reading. */
export function stripSuffixKana(cityName: string, cityKana: string): string | null {
  const suffixChar = cityName.at(-1) ?? "";
  const candidates = SUFFIX_KANA[suffixChar];
  if (!candidates) return null;
  for (const candidate of candidates) {
    if (cityKana.endsWith(candidate)) {
      return cityKana.slice(0, -candidate.length);
    }
  }
  return null;
}

/** normalized romaji -> matching city codes (still-unsolved filtering happens
 * at the call site). Built once from the static data. */
export function buildCanonicalMap(municipalities: Municipality[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (key: string, code: string) => {
    if (!key) return;
    const existing = map.get(key);
    if (existing) {
      if (!existing.includes(code)) existing.push(code);
    } else {
      map.set(key, [code]);
    }
  };

  for (const m of municipalities) {
    for (const variant of kanaToBaseVariants(m.cityKana)) {
      add(normalize(variant), m.cityCode);
    }

    const stripped = stripSuffixKana(m.cityName, m.cityKana);
    if (stripped === null) {
      console.warn(`could not identify suffix reading for ${m.cityName} (${m.cityKana})`);
    } else if (stripped.length > 0) {
      for (const variant of kanaToBaseVariants(stripped)) {
        add(normalize(variant), m.cityCode);
      }
    }
  }

  return map;
}
