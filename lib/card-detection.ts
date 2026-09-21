export type CardDetection = {
  name: string;
  sport: string;
  year: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  serial: string;
  confidence: number;
};

const BLOCKED_NAME_WORDS = new Set([
  "ALL", "AND", "AUTOGRAPH", "BANTAMWEIGHT", "BASE", "BASEBALL", "BASKETBALL", "CARD", "CARDS",
  "CHAMPION", "CHROME", "CLUB", "COMPANY", "FIGHT", "FIGHTER", "FOOTBALL", "GOLD",
  "HEAVYWEIGHT", "HOCKEY", "LIGHTWEIGHT", "MIDDLEWEIGHT", "PANINI", "PRIZM", "REFRACTOR",
  "ISSUE", "RESERVED", "ROOKIE", "SILVER", "STADIUM", "THE", "TOPPS", "TRADING", "UFC", "VARIATION",
  "WELTERWEIGHT", "YEARS",
]);

const NAME_TRAILERS = /\b(?:flyweight|bantamweight|featherweight|lightweight|welterweight|middleweight|light heavyweight|heavyweight|rookie|champion)\b.*$/i;

function cleanLine(line: string) {
  return line
    .replace(/[|_]+/g, " ")
    .replace(/[^A-Za-z0-9#/'&().:+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function titleCaseName(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`)
    .replace(/\b(Ii|Iii|Iv|Jr|Sr)\b/g, (part) => part.toUpperCase());
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function wordSimilarity(left: string, right: string) {
  return 1 - editDistance(left, right) / Math.max(left.length, right.length, 1);
}

function knownNameMatch(text: string, knownNames: string[]) {
  const textKey = normalKey(text);
  const textWords = textKey.split(" ").filter((word) => word.length >= 3);
  let best = { name: "", score: 0 };

  for (const name of knownNames) {
    const nameKey = normalKey(name);
    if (!nameKey) continue;
    if (textKey.includes(nameKey)) return name;
    const nameWords = nameKey.split(" ").filter(Boolean);
    const similarities = nameWords.map((nameWord) => Math.max(0, ...textWords.map((word) => wordSimilarity(nameWord, word))));
    const surnameScore = similarities.at(-1) || 0;
    const otherScore = similarities.length > 1
      ? similarities.slice(0, -1).reduce((sum, score) => sum + score, 0) / (similarities.length - 1)
      : surnameScore;
    const score = surnameScore * 0.65 + otherScore * 0.35;
    if (surnameScore >= 0.72 && score > best.score) best = { name, score };
  }

  return best.score >= 0.61 ? best.name : "";
}

function findName(frontLines: string[], backLines: string[], knownNames: string[]) {
  const allLines = [...frontLines, ...backLines];
  const matchedKnownName = knownNameMatch(allLines.join(" "), knownNames);
  if (matchedKnownName) return matchedKnownName;
  const lineFrequency = new Map<string, number>();

  for (const line of allLines) {
    const candidate = cleanLine(line.replace(NAME_TRAILERS, "")).replace(/^[^A-Za-z]+|[^A-Za-z.'-]+$/g, "");
    const key = normalKey(candidate);
    if (key) lineFrequency.set(key, (lineFrequency.get(key) || 0) + 1);
  }

  const candidates = allLines.flatMap((rawLine, index) => {
    const candidate = cleanLine(rawLine.replace(NAME_TRAILERS, "")).replace(/^[^A-Za-z]+|[^A-Za-z.'-]+$/g, "");
    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 4 || candidate.length < 4 || candidate.length > 42) return [];
    if (!words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))) return [];
    const upperWords = words.map((word) => word.toUpperCase().replace(/[^A-Z]/g, ""));
    if (upperWords.some((word) => BLOCKED_NAME_WORDS.has(word))) return [];
    if (words.length === 1 && (lineFrequency.get(normalKey(candidate)) || 0) < 2) return [];

    let score = 0;
    if (rawLine === rawLine.toUpperCase()) score += 3;
    if ((lineFrequency.get(normalKey(candidate)) || 0) > 1) score += 10;
    if (words.length === 2) score += 5;
    if (words.length === 3) score += 3;
    if (candidate.length <= 28) score += 2;
    if (index < frontLines.length) score += 2;
    return [{ candidate, score }];
  });

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.candidate && candidates[0].score >= 12 ? titleCaseName(candidates[0].candidate) : "";
}

function findSport(text: string) {
  const sports: Array<[RegExp, string]> = [
    [/\bUFC\b|MIXED MARTIAL ARTS|\bMMA\b/i, "UFC / MMA"],
    [/\bNBA\b|BASKETBALL/i, "Basketball"],
    [/\bNFL\b|AMERICAN FOOTBALL/i, "Football"],
    [/\bMLB\b|BASEBALL/i, "Baseball"],
    [/\bNHL\b|ICE HOCKEY|HOCKEY/i, "Hockey"],
    [/\bFIFA\b|SOCCER/i, "Soccer"],
    [/POK[ÉE]MON|POCKET MONSTERS/i, "Pokémon"],
  ];
  return sports.find(([pattern]) => pattern.test(text))?.[1] || "";
}

function findSet(text: string, sport: string) {
  const upper = text.toUpperCase();
  const products: Array<[string[], string]> = [
    [["STADIUM CLUB", "CHROME"], "Topps Stadium Club Chrome"],
    [["TOPPS", "STADIUM CLUB"], "Topps Stadium Club"],
    [["TOPPS", "CHROME"], "Topps Chrome"],
    [["TOPPS", "KNOCKOUT"], "Topps Knockout"],
    [["TOPPS", "MIDNIGHT"], "Topps Midnight"],
    [["BOWMAN", "CHROME"], "Bowman Chrome"],
    [["DONRUSS", "OPTIC"], "Donruss Optic"],
    [["NATIONAL TREASURES"], "Panini National Treasures"],
    [["IMMACULATE"], "Panini Immaculate"],
    [["PANINI", "PRIZM"], "Panini Prizm"],
    [["PANINI", "SELECT"], "Panini Select"],
    [["UPPER DECK"], "Upper Deck"],
    [["TOPPS"], "Topps"],
    [["PANINI"], "Panini"],
  ];
  const product = products.find(([terms]) => terms.every((term) => upper.includes(term)))?.[1] || "";
  return product && sport === "UFC / MMA" && !product.includes("UFC") ? `${product} UFC` : product;
}

function findCardNumber(text: string, lines: string[], year: string, serial: string) {
  const labelled = text.match(/(?:CARD(?:\s+NO(?:\.|UMBER)?)?|NO\.|#)\s*[:#-]?\s*([A-Z]{1,7}(?:-[A-Z0-9]{1,9})+|\d{1,4})/i)?.[1];
  if (labelled) return labelled.toUpperCase();

  const coded = text.match(/\b([A-Z]{2,7}-[A-Z0-9]{1,9})\b/i)?.[1];
  if (coded) return coded.toUpperCase();

  const serialParts = serial.split("/");
  const numberLine = lines
    .map(cleanLine)
    .find((line) => /^\d{1,3}$/.test(line) && line !== year && !serialParts.includes(line));
  return numberLine || "";
}

function findParallel(text: string) {
  const upper = text.toUpperCase();
  const labels: Array<[string, string]> = [
    ["SUPERFRACTOR", "Superfractor"],
    ["TURQUOISE", "Turquoise"],
    ["PURPLE", "Purple"],
    ["MAGENTA", "Magenta"],
    ["ORANGE", "Orange"],
    ["REFRACTOR", "Refractor"],
    ["AUTOGRAPH", "Autograph"],
    ["ROOKIE", "Rookie"],
    ["HOLOGRAPHIC", "Holographic"],
    ["HOLO", "Holo"],
  ];
  return labels.filter(([needle]) => upper.includes(needle)).map(([, label]) => label).join(" · ");
}

export function detectCardDetails(frontText: string, backText: string, knownNames: string[] = []): CardDetection {
  const frontLines = frontText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const backLines = backText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const allLines = [...frontLines, ...backLines];
  const text = allLines.join("\n");
  const serialMatch = text.match(/\b(\d{1,4})\s*\/\s*(\d{1,5})\b/);
  const serial = serialMatch ? `${serialMatch[1]}/${serialMatch[2]}` : "";
  const possibleYears = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year <= new Date().getFullYear() + 1);
  const year = possibleYears.length ? String(Math.max(...possibleYears)) : "";
  const sport = findSport(text);
  const name = findName(frontLines, backLines, knownNames);
  const setName = findSet(text, sport);
  const parallel = findParallel(text);
  const cardNumber = findCardNumber(text, allLines, year, serial);

  let confidence = 0;
  if (name) confidence += 40;
  if (sport) confidence += 10;
  if (year) confidence += 10;
  if (setName) confidence += 18;
  if (cardNumber) confidence += 10;
  if (parallel) confidence += 7;
  if (serial) confidence += 5;

  return { name, sport, year, setName, cardNumber, parallel, serial, confidence: Math.min(confidence, 98) };
}
