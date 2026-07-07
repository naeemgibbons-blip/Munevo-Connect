// Hand-written types for the tables this app currently queries.
// Regenerate with `supabase gen types typescript` once a project is linked.

export type Department = {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
};

export type LegistarMatter = {
  id: string;
  org_id: string;
  matter_id: number;
  matter_file: string | null;
  matter_title: string | null;
  matter_type: string | null;
  matter_status: string | null;
  department_id: string | null;
  parsed_fields: Record<string, string> | null;
  classification: "grant" | "property_disposition" | "other";
  synced_at: string;
  matter_category: "PROCEDURAL" | "HEADER" | "ACTIONABLE" | null;
  action_type: string | null;
  resolution_number: string | null;
  ordinance_number: string | null;
  funding_source_parsed: string | null;
  meeting_body: string | null;
  extracted_addresses: string[] | null;
  extracted_businesses: string[] | null;
  extracted_contractors: string[] | null;
  extracted_parcels: string[] | null;
  extracted_amounts: string[] | null;
};

export type LegistarMatterLink = {
  id: string;
  org_id: string;
  legistar_matter_id: string;
  record_type: string;
  record_id: string | null;
  match_basis: string;
  match_text: string;
  confidence: "high" | "medium" | "low" | "needs_review";
  status: "pending" | "confirmed" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type PropertyDisposition = {
  id: string;
  org_id: string;
  legistar_matter_id: string | null;
  department_id: string | null;
  address: string | null;
  block: string | null;
  lot: string | null;
  ward: string | null;
  purpose: string | null;
  entity_name: string | null;
  action: string | null;
  sale_amount: number | null;
  assessed_appraised_amount: string | null;
  created_at: string;
};

export type Grant = {
  id: string;
  org_id: string | null;
  legistar_matter_id: string | null;
  department_id: string | null;
  title: string;
  funder: string;
  source: string;
  cfda_number: string | null;
  amount: number;
  status: string;
  owner_id: string | null;
  deadline: string | null;
  program_id: string | null;
  created_at: string;
};

export type GrantTransaction = {
  id: string;
  grant_id: string | null;
  type: string;
  vendor: string | null;
  amount: number;
  category: string | null;
  gl_ref: string | null;
  status: string;
  date: string;
  created_by: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      departments: { Row: Department; Insert: Partial<Department>; Update: Partial<Department> };
      legistar_matters: {
        Row: LegistarMatter;
        Insert: Partial<LegistarMatter>;
        Update: Partial<LegistarMatter>;
      };
      property_dispositions: {
        Row: PropertyDisposition;
        Insert: Partial<PropertyDisposition>;
        Update: Partial<PropertyDisposition>;
      };
      grants: { Row: Grant; Insert: Partial<Grant>; Update: Partial<Grant> };
      grant_transactions: {
        Row: GrantTransaction;
        Insert: Partial<GrantTransaction>;
        Update: Partial<GrantTransaction>;
      };
    };
  };
};
