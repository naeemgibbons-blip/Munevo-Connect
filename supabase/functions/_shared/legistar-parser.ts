// Mirrors src/lib/legistar-parser.ts. Duplicated here (rather than imported
// across the supabase/functions boundary) so this edge function deploys as a
// self-contained bundle.

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

export function stripNoiseLines(text: string): string[] {
  return text
    .replace(/\f/g, "\n")
    .split(/\r\n|\r|\n/)
    .filter((line) => !NOISE_LINE_PATTERNS.some((re) => re.test(line)));
}

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

const LABEL_LINE_RE = /^([A-Za-z][A-Za-z()/.\s]*?):\s?(.*)$/;

function resolveAlias(rawLabel: string): FactSheetLabel | null {
  return LABEL_ALIASES[normalizeLabelKey(rawLabel)] ?? null;
}

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

export function parseCheckedOptions(value: string | undefined): string {
  if (!value) return "";
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
  const line = raw.trim().replace(PROPERTY_HINT_RE, "").trim();
  const parts = line.split("/").map((p) => p.trim()).filter(Boolean);

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
