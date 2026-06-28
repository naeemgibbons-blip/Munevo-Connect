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
  parsed_fields: Record<string, unknown> | null;
  classification: "grant" | "property_disposition" | "other";
  synced_at: string;
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
  org_id: string;
  legistar_matter_id: string | null;
  department_id: string | null;
  entity_name: string | null;
  purpose: string | null;
  funding_source: string | null;
  grant_period: string | null;
  total_amount: number | null;
  created_at: string;
};

export type GrantTransaction = {
  id: string;
  org_id: string;
  grant_id: string;
  amount: number;
  description: string | null;
  recorded_by: string | null;
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
