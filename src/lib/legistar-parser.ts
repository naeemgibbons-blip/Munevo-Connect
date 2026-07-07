// Parser for Newark Legistar MatterTitle fact-sheet text blocks.
// Includes matter classification (PROCEDURAL / HEADER / ACTIONABLE) and
// structured field extraction for the relationship engine.

// ─── Fact-sheet label types ─────────────────────────────────────────────────

export const FACT_SHEET_LABELS = [
  "Dept/Agency",
  "Monitoring Dept/Agency",
  "Contract Basis",
  "Entity Name/Address",
  "Purpose",
  "Funding Source",
  "Total Grant Amount",
  "Contract/Grant Period",
  "Sale Amount",
  "Assessed/Appraised Amount",
  "List of Property",
  "Action",
  "Resolution Number",
  "Ordinance Number",
  "Meeting Body",
] as const;

export type FactSheetLabel = (typeof FACT_SHEET_LABELS)[number];
export type ParsedFactSheet = Partial<Record<FactSheetLabel, string>>;

export type PropertyEntry = {
  address?: string;
  block?: string;
  lot?: string;
  ward?: string;
  raw: string;
};

export type MatterClassification = "grant" | "property_disposition" | "other";
export type AgendaClassification = "PROCEDURAL" | "HEADER" | "ACTIONABLE";

export type ExtractedFields = {
  actionType: string | null;
  addresses: string[];
  businesses: string[];
  contractors: string[];
  parcels: string[];
  amounts: string[];
  resolutionNumber: string | null;
  ordinanceNumber: string | null;
  fundingSource: string | null;
  meetingBody: string | null;
};

// ─── Classification constants ────────────────────────────────────────────────

const PROCEDURAL_MATTER_TYPES = new Set([
  "roll call",
  "call to order",
  "adjournment",
  "recess",
  "minutes",
  "approval of minutes",
  "public hearing",
  "pledge of allegiance",
  "opening",
  "closing",
  "public comment",
  "executive session",
  "invocation",
  "moment of silence",
  "communications",
  "announcement",
  "presentations",
]);

const PROCEDURAL_TITLE_RE = [
  /^roll call\b/i,
  /^call to order\b/i,
  /^adjournment\b/i,
  /^pledge of allegiance\b/i,
  /^recess\b/i,
  /^approval of (the )?minutes\b/i,
  /^executive session\b/i,
  /^invocation\b/i,
  /^moment of silence\b/i,
  /^-{3,}$/, // page-break lines
  /^page \d+ of \d+$/i,
  /^public comment(s)?\b/i,
  /^open(ing)? public hearing\b/i,
  /^close (the )?public hearing\b/i,
];

const HEADER_TITLE_SET = new Set([
  "administration",
  "engineering",
  "finance",
  "health and wellness",
  "health & wellness",
  "public works",
  "housing",
  "economic development",
  "economic & housing development",
  "public safety",
  "parks and recreation",
  "parks & recreation",
  "technology",
  "municipal court",
  "library",
  "education",
  "water and sewer",
  "water & sewer",
  "utilities",
  "planning",
  "planning & zoning",
  "consent agenda",
  "regular agenda",
  "introduction",
  "second reading",
  "third reading",
  "communications and petitions",
  "new business",
  "old business",
  "resolutions",
  "ordinances",
  "agenda items",
  "director's report",
  "department report",
]);

export const ACTION_VERBS = [
  "authorizing",
  "ratifying",
  "amending",
  "accepting",
  "awarding",
  "approving",
  "establishing",
  "adopting",
  "creating",
  "directing",
  "repealing",
  "supplementing",
  "confirming",
  "designating",
  "appropriating",
  "granting",
  "transferring",
  "appointing",
  "canceling",
  "cancelling",
  "renewing",
  "extending",
  "revoking",
  "declaring",
  "waiving",
  "releasing",
  "entering",
  "executing",
  "rejecting",
  "withdrawing",
];

// ─── Extraction regex ────────────────────────────────────────────────────────

const ADDRESS_RE =
  /\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:Avenue|Ave|Street|St\.?|Road|Rd\.?|Boulevard|Blvd|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Place|Pl\.?|Way|Terrace|Ter\.?|Parkway|Pkwy|Highway|Hwy)\b/gi;

const AMOUNT_RE = /\$[\d,]+(?:\.\d{1,2})?/g;

const RESOLUTION_RE = /\bResolution(?:\s+No\.?)?\s*([\d]{2}-[\d]+)/gi;
const ORDINANCE_RE = /\bOrdinance(?:\s+No\.?)?\s*([\d]{2}-[\d]+)/gi;

// ─── Classification ──────────────────────────────────────────────────────────

export function classifyMatter(matter: {
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterFile: string | null;
}): AgendaClassification {
  const title = matter.MatterTitle?.trim() ?? "";
  const typeNorm = matter.MatterTypeName?.toLowerCase().trim() ?? "";
  const file = matter.MatterFile?.trim() ?? "";
  const titleLower = title.toLowerCase().trim();

  if (PROCEDURAL_MATTER_TYPES.has(typeNorm)) return "PROCEDURAL";

  for (const re of PROCEDURAL_TITLE_RE) {
    if (re.test(title)) return "PROCEDURAL";
  }

  if (!file && HEADER_TITLE_SET.has(titleLower)) return "HEADER";

  if (file) return "ACTIONABLE";

  if (ACTION_VERBS.some((v) => titleLower.startsWith(v))) return "ACTIONABLE";

  if (title.length < 60 && !ACTION_VERBS.some((v) => titleLower.includes(v))) {
    return "HEADER";
  }

  return "ACTIONABLE";
}

// ─── Structured field extraction ─────────────────────────────────────────────

function firstCapture(re: RegExp, text: string): string | null {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m ? m[1] : null;
}

export function extractStructuredFields(
  parsed: ParsedFactSheet,
  matterTitle: string
): ExtractedFields {
  const fullText = [matterTitle, ...Object.values(parsed)].filter(Boolean).join(" ");

  const searchText = (parsed["Purpose"] ?? matterTitle).toLowerCase();
  const actionVerb =
    ACTION_VERBS.find((v) => searchText.startsWith(v)) ??
    ACTION_VERBS.find((v) => searchText.includes(v)) ??
    null;
  const actionType = actionVerb
    ? actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)
    : null;

  const addresses = [...new Set((fullText.match(ADDRESS_RE) ?? []).map((a) => a.trim()))];

  const businesses: string[] = [];
  const contractors: string[] = [];
  const entityRaw = parsed["Entity Name/Address"] ?? "";
  if (entityRaw) {
    const firstLine = entityRaw.split(/[,\n]/)[0].trim();
    if (firstLine && !/^\d+\s+/.test(firstLine)) {
      const cb = (parsed["Contract Basis"] ?? "").toLowerCase();
      if (/contract|vendor|contractor|construction/i.test(cb)) {
        contractors.push(firstLine);
      } else {
        businesses.push(firstLine);
      }
    }
  }

  const parcels: string[] = [];
  const parcelRe = /Block\s+(\d+)[,\s/]+Lot\s+(\d+[A-Z]?)/gi;
  let pm: RegExpExecArray | null;
  parcelRe.lastIndex = 0;
  while ((pm = parcelRe.exec(fullText)) !== null) {
    parcels.push(`Block ${pm[1]} Lot ${pm[2]}`);
  }

  const amounts = [...new Set((fullText.match(AMOUNT_RE) ?? []))];

  const resolutionNumber = firstCapture(RESOLUTION_RE, fullText);
  const ordinanceNumber = firstCapture(ORDINANCE_RE, fullText);
  const fundingSource = parsed["Funding Source"] ?? null;
  const meetingBody = parsed["Meeting Body"] ?? null;

  return {
    actionType,
    addresses,
    businesses: [...new Set(businesses)],
    contractors: [...new Set(contractors)],
    parcels: [...new Set(parcels)],
    amounts,
    resolutionNumber,
    ordinanceNumber,
    fundingSource,
    meetingBody,
  };
}

// ─── Fact-sheet parser ───────────────────────────────────────────────────────

const LABEL_ALIASES: Record<string, FactSheetLabel> = {
  deptagency: "Dept/Agency",
  departmentagency: "Dept/Agency",
  dept: "Dept/Agency",
  monitoringdeptagency: "Monitoring Dept/Agency",
  monitoringdepartmentagency: "Monitoring Dept/Agency",
  contractbasis: "Contract Basis",
  entitynameaddress: "Entity Name/Address",
  entityname: "Entity Name/Address",
  entityaddress: "Entity Name/Address",
  purpose: "Purpose",
  fundingsource: "Funding Source",
  totalgrantamount: "Total Grant Amount",
  grantamount: "Total Grant Amount",
  contractgrantperiod: "Contract/Grant Period",
  contractperiod: "Contract/Grant Period",
  grantperiod: "Contract/Grant Period",
  saleamount: "Sale Amount",
  assessedappraisedamount: "Assessed/Appraised Amount",
  assessedamount: "Assessed/Appraised Amount",
  appraisedamount: "Assessed/Appraised Amount",
  listofproperty: "List of Property",
  action: "Action",
  resolutionnumber: "Resolution Number",
  ordinancenumber: "Ordinance Number",
  meetingbody: "Meeting Body",
};

function normalizeLabelKey(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, "").toLowerCase();
}

const LABEL_LINE_RE = /^([A-Za-z][A-Za-z0-9 \t\/&.,\-()]{0,60}):\s*(.*)$/;

export function stripNoiseLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^-{3,}$/.test(line.trim()) &&
        !/^Page \d+ of \d+$/i.test(line.trim())
    )
    .join("\n");
}

export function parseFactSheet(matterTitle: string): ParsedFactSheet {
  const cleaned = stripNoiseLines(matterTitle);
  const lines = cleaned.split(/\r?\n/);
  const result: ParsedFactSheet = {};
  let currentLabel: FactSheetLabel | null = null;

  for (const rawLine of lines) {
    const m = rawLine.match(LABEL_LINE_RE);
    if (m) {
      const normalized = normalizeLabelKey(m[1]);
      const canonical = LABEL_ALIASES[normalized] ?? null;
      if (canonical) {
        const value = m[2].trim();
        if (canonical === "Entity Name/Address" && result["Entity Name/Address"]) {
          result["Entity Name/Address"] += `, ${value}`;
        } else if (
          canonical === "Assessed/Appraised Amount" &&
          result["Assessed/Appraised Amount"]
        ) {
          if (value) {
            result["Assessed/Appraised Amount"] += `; ${m[1].trim()}: ${value}`;
          }
        } else {
          result[canonical] = value;
        }
        currentLabel = canonical;
        continue;
      }
    }
    if (currentLabel && rawLine.trim()) {
      result[currentLabel] = (result[currentLabel] ?? "") + " " + rawLine.trim();
    }
  }

  return result;
}

export function parseCheckedOptions(value: string): string {
  if (!value.includes("(")) return value.trim();
  const checked: string[] = [];
  const re = /\(([^)]*)\)\s*([^()]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const mark = m[1].trim();
    const label = m[2].trim();
    if (mark && mark !== " " && label) checked.push(label);
  }
  return checked.join(", ");
}

function stripPrefix(s: string, ...prefixes: string[]): string {
  for (const p of prefixes) {
    if (s.toLowerCase().startsWith(p.toLowerCase())) return s.slice(p.length).trim();
  }
  return s;
}

function parsePropertyLine(raw: string): PropertyEntry {
  let line = raw.replace(/^\s*[•\-*]\s*/, "").trim();
  line = line.replace(/^\([^)]*\)\s*/, "");

  const parts = line.split("/").map((p) => p.trim());
  const last = parts[parts.length - 1];
  const wardMatch = last?.match(/^(.+?)\s*\(([^)]+\s*Ward)\)\s*$/i);
  let ward: string | undefined;
  if (wardMatch) {
    parts[parts.length - 1] = wardMatch[1].trim();
    ward = wardMatch[2].trim();
  }

  const [rawAddr, rawBlock, rawLot, rawWard2] = parts;
  if (!ward && rawWard2) ward = rawWard2;

  return {
    address: rawAddr ? stripPrefix(rawAddr, "Address ") : undefined,
    block: rawBlock ? stripPrefix(rawBlock, "Block ", "B ") : undefined,
    lot: rawLot ? stripPrefix(rawLot, "Lot ", "L ") : undefined,
    ward,
    raw,
  };
}

export function parseListOfProperty(value: string): PropertyEntry[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parsePropertyLine);
}

export type ParsedMatter = {
  fields: ParsedFactSheet;
  properties: PropertyEntry[];
  classification: MatterClassification;
  action: string;
};

export function parseMatterTitle(matterTitle: string): ParsedMatter {
  const fields = parseFactSheet(matterTitle);

  const properties = fields["List of Property"]
    ? parseListOfProperty(fields["List of Property"])
    : [];

  const action = fields["Action"] ? parseCheckedOptions(fields["Action"]) : "";
  const contractBasis = fields["Contract Basis"]
    ? parseCheckedOptions(fields["Contract Basis"]).toLowerCase()
    : "";

  const isGrant =
    contractBasis.includes("grant") || Boolean(fields["Total Grant Amount"]);
  const isPropertyDisposition =
    action.toLowerCase().includes("private sale") ||
    contractBasis.includes("private sale") ||
    Boolean(fields["Sale Amount"]);

  const classification: MatterClassification = isGrant
    ? "grant"
    : isPropertyDisposition
    ? "property_disposition"
    : "other";

  return { fields, properties, classification, action };
}
