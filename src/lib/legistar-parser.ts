/**
 * Parser for Legistar's MatterTitle field: a "fact sheet" text block of
 * CRLF-separated `Label: value` pairs, as returned by
 * https://webapi.legistar.com/v1/newark/matters
 *
 * Real Newark matters use several label spellings across years
 * (e.g. "Dept/ Agency" vs "Dept/Agency", "Grant Amount" vs "Total Grant
 * Amount", "Assessed Amount"/"Appraised Amount" as separate lines), so
 * label matching is alias-based and whitespace-tolerant rather than exact.
 */

export const FACT_SHEET_LABELS = [
  "Dept/Agency",
  "Action",
  "Type of Service",
  "Purpose",
  "Entity Name/Address",
  "Sale Amount",
  "Total Grant Amount",
  "Funding Source",
  "Cost Basis",
  "Assessed/Appraised Amount",
  "Contract/Grant Period",
  "Contract Basis",
  "Monitoring Dept/Agency",
  "List of Property",
  "Additional Information",
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

const NOISE_LINE_PATTERNS = [
  /^\s*page\s*break\s*$/i,
  /^\s*page\s+\d+\s+of\s+\d+\s*$/i,
  /^\s*$/,
];

/** Strips page-break markers, "page N of M" footers, form-feed chars, and blank lines. */
export function stripNoiseLines(text: string): string[] {
  return text
    .replace(/\f/g, "\n")
    .split(/\r\n|\r|\n/)
    .filter((line) => !NOISE_LINE_PATTERNS.some((re) => re.test(line)));
}

/** Normalizes a raw label to a comparison key: lowercase, letters only. */
function normalizeLabelKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z]/g, "");
}

const LABEL_ALIASES: Record<string, FactSheetLabel> = {
  deptagency: "Dept/Agency",
  action: "Action",
  typeofservice: "Type of Service",
  purpose: "Purpose",
  entitynameaddress: "Entity Name/Address",
  entitynamesaddresses: "Entity Name/Address",
  entityname: "Entity Name/Address",
  entityaddress: "Entity Name/Address",
  saleamount: "Sale Amount",
  totalgrantamount: "Total Grant Amount",
  grantamount: "Total Grant Amount",
  fundingsource: "Funding Source",
  costbasis: "Cost Basis",
  assessedappraisedamount: "Assessed/Appraised Amount",
  assessedamount: "Assessed/Appraised Amount",
  appraisedamount: "Assessed/Appraised Amount",
  contractgrantperiod: "Contract/Grant Period",
  contractperiod: "Contract/Grant Period",
  grantperiod: "Contract/Grant Period",
  contractbasis: "Contract Basis",
  monitoringdeptagency: "Monitoring Dept/Agency",
  listofproperty: "List of Property",
  additionalinformation: "Additional Information",
  additionalcomments: "Additional Information",
};

// Matches "Some Label:" (with arbitrary spacing/punctuation) followed by the rest of the line.
const LABEL_LINE_RE = /^([A-Za-z][A-Za-z()/.\s]*?):\s?(.*)$/;

function resolveAlias(rawLabel: string): FactSheetLabel | null {
  return LABEL_ALIASES[normalizeLabelKey(rawLabel)] ?? null;
}

/** Parses the labeled fact-sheet block into a field map, merging wrapped continuation lines. */
export function parseFactSheet(matterTitle: string): ParsedFactSheet {
  const lines = stripNoiseLines(matterTitle);
  const fields: ParsedFactSheet = {};
  let currentLabel: FactSheetLabel | null = null;
  let currentRawLabel: string | null = null;

  for (const line of lines) {
    const match = line.match(LABEL_LINE_RE);
    const canonical = match ? resolveAlias(match[1]) : null;

    if (match && canonical) {
      const value = match[2].trim();
      const rawLabelKey = normalizeLabelKey(match[1]);

      if (canonical === "Entity Name/Address" && fields[canonical]) {
        fields[canonical] = value ? `${fields[canonical]}, ${value}` : fields[canonical];
      } else if (
        canonical === "Assessed/Appraised Amount" &&
        fields[canonical] &&
        rawLabelKey !== normalizeLabelKey(currentRawLabel ?? "")
      ) {
        if (value) {
          fields[canonical] = `${fields[canonical]}; ${match[1].trim()}: ${value}`;
        }
      } else {
        fields[canonical] = value;
      }

      currentLabel = canonical;
      currentRawLabel = match[1].trim();
    } else if (currentLabel) {
      fields[currentLabel] = `${fields[currentLabel] ?? ""} ${line.trim()}`.trim();
    }
  }

  return fields;
}

/**
 * Extracts all checked checkbox options from a value like
 * "( ) Foo (X) Bar ( ) Baz" -> "Bar". Multiple checked boxes are joined with ", ".
 * A box counts as checked when its mark is non-whitespace.
 */
export function parseCheckedOptions(value: string | undefined): string {
  if (!value) return "";

  // Plain (non-checkbox) values, e.g. "Contract Basis: Private Sale", pass through as-is.
  if (!value.includes("(")) return value.trim();

  const checked: string[] = [];
  const re = /\(([^)]*)\)\s*([^()]*)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(value)) !== null) {
    const mark = match[1].trim();
    const label = match[2].trim().replace(/\s+/g, " ").replace(/^[:_\-,\s]+|[:_\-,\s]+$/g, "");
    if (mark.length > 0 && label.length > 0) {
      checked.push(label);
    }
  }

  return checked.join(", ");
}

const PROPERTY_HINT_RE = /^\([^)]*\)\s*/;

function stripPrefix(value: string | undefined, prefixRe: RegExp): string | undefined {
  if (value === undefined) return value;
  return value.replace(prefixRe, "").trim();
}

function parsePropertyLine(raw: string): PropertyEntry {
  let line = raw.trim().replace(PROPERTY_HINT_RE, "").trim();
  const parts = line.split("/").map((p) => p.trim()).filter(Boolean);

  // Pull a trailing "(... Ward)" out of the last segment, e.g. "Lot 4 (East Ward)".
  if (parts.length) {
    const last = parts[parts.length - 1];
    const wardInParens = last.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (wardInParens && /ward/i.test(wardInParens[2])) {
      parts[parts.length - 1] = wardInParens[1].trim();
      parts.push(wardInParens[2].trim());
    }
  }

  const [addressRaw, blockRaw, lotRaw, wardRaw] = parts;

  return {
    address: addressRaw,
    block: stripPrefix(blockRaw, /^b(lock)?\.?\s*/i),
    lot: stripPrefix(lotRaw, /^l(ot)?\.?\s*/i),
    ward: wardRaw,
    raw,
  };
}

/**
 * Parses "List of Property" entries. Each entry is formatted as
 * "(Address/Block/Lot/Ward) 90 Garside Street/Block 490/Lot 23/ Central Ward"
 * — the leading hint prefix is stripped before splitting on "/". Block/Lot
 * prefixes ("Block ", "B ", "Lot ", "L ") are optional, and a ward
 * mentioned in trailing parens (e.g. "Lot 4 (East Ward)") is also handled.
 */
export function parseListOfProperty(value: string | undefined): PropertyEntry[] {
  if (!value) return [];

  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parsePropertyLine);
}

export type ParsedMatter = {
  fields: ParsedFactSheet;
  action: string;
  contractBasis: string;
  properties: PropertyEntry[];
  classification: MatterClassification;
};

export function parseMatterTitle(matterTitle: string): ParsedMatter {
  const fields = parseFactSheet(matterTitle);
  const action = parseCheckedOptions(fields["Action"]);
  const contractBasis = parseCheckedOptions(fields["Contract Basis"]);
  const properties = parseListOfProperty(fields["List of Property"]);

  const isGrant =
    contractBasis.toLowerCase().includes("grant") || Boolean(fields["Total Grant Amount"]);
  const isPropertyDisposition =
    action.toLowerCase().includes("private sale") ||
    contractBasis.toLowerCase().includes("private sale") ||
    Boolean(fields["Sale Amount"]);

  let classification: MatterClassification = "other";
  if (isGrant) classification = "grant";
  else if (isPropertyDisposition) classification = "property_disposition";

  return { fields, action, contractBasis, properties, classification };
}
