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
 * following consonant; ん becomes plain "n". No long-vowel folding happens
 * here — that's normalize()'s job. */
export function kanaToBase(kana: string): string {
  let out = "";
  let i = 0;
  while (i < kana.length) {
    const ch = kana[i];
    if (ch === "ん") {
      out += "n";
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
  return out;
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
  // お列 long vowel: "ou" and "o" (u dropped) are both accepted. This is a
  // ONE-WAY fold — "oo" is deliberately left untouched and will not match.
  [/ou/g, "o"],
  // え列 long vowel gets NO leniency at all (no "ei"->"e" or "ee" folding) —
  // this asymmetry with お列 is intentional, per explicit product decision.
  // んの連続表記ゆれ: collapse repeated n (e.g. "nannyou" == "nanyou").
  // Verified zero collisions across the full 1747-entry dataset.
  [/n{2,}/g, "n"],
];

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
    add(normalize(kanaToBase(m.cityKana)), m.cityCode);

    const stripped = stripSuffixKana(m.cityName, m.cityKana);
    if (stripped === null) {
      console.warn(`could not identify suffix reading for ${m.cityName} (${m.cityKana})`);
    } else if (stripped.length > 0) {
      add(normalize(kanaToBase(stripped)), m.cityCode);
    }
  }

  return map;
}
