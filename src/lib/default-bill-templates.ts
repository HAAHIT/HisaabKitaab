import { type ColumnDef } from "@/lib/formula";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  /** Suggested prefix for the bill series this template is associated with. */
  suggestedPrefix: string;
  /** Default terms text added to bills created from this template. */
  defaultTerms?: string;
  /** Columns the user gets pre-filled. They can edit before saving. */
  columns: Omit<ColumnDef, "id">[];
}

function withIds(cols: Omit<ColumnDef, "id">[]): ColumnDef[] {
  return cols.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

export function applyStarter(starter: StarterTemplate): {
  name: string;
  columns: ColumnDef[];
  defaultTerms?: string;
} {
  return {
    name: starter.name,
    columns: withIds(starter.columns),
    defaultTerms: starter.defaultTerms,
  };
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "tax-invoice",
    name: "Tax Invoice",
    description:
      "GST-registered invoice with CGST/SGST/IGST. Use when you're charging tax on goods or services.",
    suggestedPrefix: "INV",
    defaultTerms:
      "Goods once sold will not be taken back. Subject to local jurisdiction.",
    columns: [
      { name: "Item", type: "text", position: 0 },
      { name: "HSN/SAC", type: "text", position: 1 },
      { name: "Qty", type: "number", position: 2 },
      { name: "Rate", type: "number", position: 3 },
      { name: "GST %", type: "number", position: 4, default: 18 },
      {
        name: "Amount",
        type: "formula",
        position: 5,
        formula: "{Qty} * {Rate}",
      },
    ],
  },
  {
    id: "bill-of-supply",
    name: "Bill of Supply",
    description:
      "For composition-scheme dealers or supplies of exempt / nil-rated goods. No GST charged on the invoice.",
    suggestedPrefix: "BOS",
    defaultTerms:
      "Composition taxable person, not eligible to collect tax on supplies.",
    columns: [
      { name: "Item", type: "text", position: 0 },
      { name: "HSN/SAC", type: "text", position: 1 },
      { name: "Qty", type: "number", position: 2 },
      { name: "Rate", type: "number", position: 3 },
      {
        name: "Amount",
        type: "formula",
        position: 4,
        formula: "{Qty} * {Rate}",
      },
    ],
  },
  {
    id: "proforma-invoice",
    name: "Proforma Invoice",
    description:
      "Pre-sale estimate sent to confirm order details before delivery. Not a tax document.",
    suggestedPrefix: "PROF",
    defaultTerms:
      "This is a Proforma Invoice and not a Tax Invoice. Goods will be supplied on confirmation.",
    columns: [
      { name: "Item / Description", type: "text", position: 0 },
      { name: "Qty", type: "number", position: 1 },
      { name: "Rate", type: "number", position: 2 },
      {
        name: "Amount",
        type: "formula",
        position: 3,
        formula: "{Qty} * {Rate}",
      },
    ],
  },
  {
    id: "quotation",
    name: "Quotation / Estimate",
    description:
      "Price quote sent to a prospective customer before the order is confirmed.",
    suggestedPrefix: "QUO",
    defaultTerms:
      "Valid for 30 days from the date of quotation. Prices subject to change thereafter.",
    columns: [
      { name: "Item / Description", type: "text", position: 0 },
      { name: "Qty", type: "number", position: 1 },
      { name: "Rate", type: "number", position: 2 },
      {
        name: "Amount",
        type: "formula",
        position: 3,
        formula: "{Qty} * {Rate}",
      },
    ],
  },
];
