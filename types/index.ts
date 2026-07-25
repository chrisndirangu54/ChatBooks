export type TransactionType = "sale" | "expense";

export type TransactionSource = "chat" | "manual" | "receipt";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  source: TransactionSource;
  confidence: number;
  createdAt: number;
  receiptUrl?: string;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  currency: string;
  categories: string[];
  createdAt: number;
}

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  confidence: number;
}

export interface WeeklySummary {
  label: string;
  sales: number;
  expenses: number;
  profit: number;
}
