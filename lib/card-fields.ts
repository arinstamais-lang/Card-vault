export type ConfirmedCardFields = {
  name: string;
  sport: string;
  year: string;
  manufacturer: string;
  setName: string;
  cardNumber: string;
  parallel: string;
  serial: string;
  grader: string;
  grade: string;
  autograph: boolean;
  memorabilia: boolean;
  rookie: boolean;
};

const EMPTY_FIELDS: ConfirmedCardFields = {
  name: "",
  sport: "",
  year: "",
  manufacturer: "",
  setName: "",
  cardNumber: "",
  parallel: "",
  serial: "",
  grader: "",
  grade: "",
  autograph: false,
  memorabilia: false,
  rookie: false,
};

const GENERIC_SPORT = /^(trading card|sports card|card)$/i;
const YEAR = /^(19|20)\d{2}$/;
const CARD_CODE = /^(?:#\s*)?([A-Z]{1,8}-[A-Z0-9]{1,9}|\d{1,4})$/i;
const GRADE = /\b(PSA|BGS|SGC|CGC|HGA|CSG|TAG)\s*-?\s*(\d+(?:\.\d+)?)\b/i;
const NUMBERED = /^\d{1,4}\s*\/\s*\d{1,5}$/;
const MANUFACTURERS = ["Topps", "Panini", "Bowman", "Upper Deck", "Donruss"];

function clean(value: string) {
  return value.replaceAll("·", " ").replace(/\s+/g, " ").trim();
}

function splitParts(value: string) {
  return value
    .split(/\s*[·•|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseGrade(value: string) {
  const match = value.match(GRADE);
  if (!match) return { grader: "", grade: "" };
  return { grader: match[1].toUpperCase(), grade: match[2] };
}

function detectManufacturer(value: string) {
  return MANUFACTURERS.find((name) => value.toLowerCase().includes(name.toLowerCase())) || "";
}

function looksLikeCardNumber(value: string) {
  const trimmed = value.replace(/^card\s+/i, "").trim();
  return CARD_CODE.test(trimmed);
}

function cardNumberFrom(value: string) {
  const labelled = value.match(/(?:card(?:\s+no(?:\.|umber)?)?|no\.|#)\s*[:#-]?\s*([A-Z]{1,8}-[A-Z0-9]{1,9}|\d{1,4})/i);
  if (labelled?.[1]) return labelled[1].toUpperCase();
  const coded = value.match(/\b([A-Z]{1,8}-[A-Z0-9]{1,9})\b/i);
  if (coded?.[1]) return coded[1].toUpperCase();
  return "";
}

export function emptyCardFields(overrides: Partial<ConfirmedCardFields> = {}): ConfirmedCardFields {
  return { ...EMPTY_FIELDS, ...overrides };
}

export function parseConfirmedCardFields(input: {
  name?: string;
  sport?: string;
  year?: string;
  setName?: string;
  cardNumber?: string;
  parallel?: string;
  serial?: string;
  description?: string;
  subtitle?: string;
}): ConfirmedCardFields {
  const name = clean(input.name || "");
  const serial = clean(input.serial || "");
  const parsedGrade = parseGrade(`${serial} ${input.description || ""} ${input.subtitle || ""}`);
  const subtitleParts = splitParts(input.subtitle || "");
  const descriptionParts = splitParts(input.description || "");
  const allParts = [...subtitleParts, ...descriptionParts];

  let year = (input.year || "").trim();
  let sport = clean(input.sport || "");
  let setName = clean(input.setName || "");
  let cardNumber = clean(input.cardNumber || "").replace(/^#/, "");
  let parallel = clean(input.parallel || "");

  if (!year) {
    const yearPart = allParts.find((part) => YEAR.test(part.split(/\s+/)[0] || ""));
    if (yearPart) {
      const token = yearPart.split(/\s+/)[0] || "";
      if (YEAR.test(token)) year = token;
    }
    if (!year) {
      const embedded = `${input.subtitle || ""} ${input.description || ""}`.match(/\b((?:19|20)\d{2})\b/);
      if (embedded) year = embedded[1];
    }
  }

  if (!setName) {
    const setPart = subtitleParts.find((part) => !looksLikeCardNumber(part) && !NUMBERED.test(part)) || "";
    setName = clean(setPart.replace(/^(?:19|20)\d{2}\s+/, "").trim());
  }

  if (!cardNumber) {
    const fromSubtitle = [...subtitleParts].reverse().find((part) => looksLikeCardNumber(part));
    cardNumber = fromSubtitle
      ? fromSubtitle.replace(/^card\s+/i, "").replace(/^#/, "").toUpperCase()
      : cardNumberFrom(`${input.subtitle || ""} ${input.description || ""}`);
  }

  if (!sport) {
    const sportPart = allParts.find((part) => /UFC|MMA|NBA|NFL|MLB|NHL|Pokémon|Pokemon/i.test(part) && part.length <= 24);
    sport = sportPart ? clean(sportPart) : "";
  }
  if (GENERIC_SPORT.test(sport)) sport = "";

  if (!parallel) {
    const parallelParts = descriptionParts.filter((part) => {
      if (YEAR.test(part) || looksLikeCardNumber(part) || NUMBERED.test(part)) return false;
      if (part === setName || part === sport) return false;
      return /refractor|autograph|turquoise|foil|chrome|parallel|variation|holographic|\bholo\b|orange|magenta|blue|gold|silver|rookie/i.test(part);
    });
    parallel = parallelParts.join(" ");
  }

  const blob = `${setName} ${parallel} ${input.subtitle || ""} ${input.description || ""}`;
  return {
    name,
    sport,
    year,
    manufacturer: detectManufacturer(`${setName} ${blob}`),
    setName,
    cardNumber: cardNumber.replace(/^#/, ""),
    parallel,
    serial: NUMBERED.test(serial) || parsedGrade.grader ? serial : serial,
    grader: parsedGrade.grader,
    grade: parsedGrade.grade,
    autograph: /autograph|\bauto\b/i.test(blob),
    memorabilia: /memorabilia|\bpatch\b|\brelic\b|\bswatch\b/i.test(blob),
    rookie: /\bRC\b|rookie/i.test(`${input.subtitle || ""} ${blob}`),
  };
}

export function parseCardFieldsFromAsset(asset: {
  name?: string;
  subtitle?: string;
  description?: string;
  serial?: string;
}) {
  return parseConfirmedCardFields({
    name: asset.name,
    subtitle: asset.subtitle,
    description: asset.description,
    serial: asset.serial,
  });
}
