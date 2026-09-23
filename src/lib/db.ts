import Dexie, { type Table } from 'dexie';
import type { RiskLevel, DocumentType, Clause } from './constants';

export type { RiskLevel, DocumentType, Clause };

export interface Contract {
  id?: number;
  title: string;
  createdAt: Date;
  documentType: DocumentType;
  rawText: string;
  scrubbedText: string;
  clauses: Clause[];
  overallRisk?: RiskLevel;
  summaryNotes?: string;
}

export class LexARDatabase extends Dexie {
  contracts!: Table<Contract, number>;

  constructor() {
    super('LexAR_Database');
    this.version(1).stores({
      contracts: '++id, title, createdAt, documentType, overallRisk',
    });
  }
}

// Singleton database instance
export const db = new LexARDatabase();

// Database helper functions
export async function saveContract(
  contractData: Omit<Contract, 'id'>
): Promise<number> {
  const contractId = await db.contracts.add({
    ...contractData,
    createdAt: contractData.createdAt || new Date(),
  });
  return contractId as number;
}

export async function getAllContracts(): Promise<Contract[]> {
  return await db.contracts.orderBy('createdAt').reverse().toArray();
}

export async function getContractById(id: number): Promise<Contract | undefined> {
  return await db.contracts.get(id);
}

export async function deleteContract(id: number): Promise<void> {
  await db.contracts.delete(id);
}

export async function clearAllContracts(): Promise<void> {
  await db.contracts.clear();
}
