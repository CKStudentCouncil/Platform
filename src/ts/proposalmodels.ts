import { collection, doc, orderBy, query, Timestamp } from 'firebase/firestore';
import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from '@firebase/firestore';

export interface Proposal {
  title: string;
  content: string;
  type: string;
  proposer: string;
  reign: string;
  basis?: string;
  done?: boolean;
  attachments?: string[];
  uploadedAt: Date;
}

export interface ProposalId extends Proposal {
  id: string;
}

export const proposalConverter: FirestoreDataConverter<Proposal | null> = {
  toFirestore(data: any) {
    if (data.uploadedAt) {
      data.uploadedAt = Timestamp.fromDate(data.uploadedAt);
    }
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    if (data.uploadedAt) {
      data.uploadedAt = new Date(data.uploadedAt.toMillis());
    }
    return data as unknown as Proposal;
  },
};

//
export function rawUserProposalCollectionLaw(userId: string) {
  const db = useFirestore();
  return collection(db, `proposal/law/${userId}/`).withConverter(proposalConverter);
}

export function userProposalCollectionLaw(userId: string) {
  return useCollection(query(rawUserProposalCollectionLaw(userId), orderBy('uploadedAt', 'desc')));
}

export function getProposalLaw(userId: string, proposalId: string) {
  return useDocument(doc(rawUserProposalCollectionLaw(userId), proposalId));
}

//
export function rawUserProposalCollectionGeneral(userId: string) {
  const db = useFirestore();
  return collection(db, `proposal/general/${userId}/`).withConverter(proposalConverter);
}

export function userProposalCollectionGeneral(userId: string) {
  return useCollection(query(rawUserProposalCollectionGeneral(userId), orderBy('uploadedAt', 'desc')));
}

export function getProposalGeneral(userId: string, proposalId: string) {
  return useDocument(doc(rawUserProposalCollectionGeneral(userId), proposalId));
}

//
export function rawUserProposalCollectionPresentation(userId: string) {
  const db = useFirestore();
  return collection(db, `proposal/presentation/${userId}/`).withConverter(proposalConverter);
}

export function userProposalCollectionPresentation(userId: string) {
  return useCollection(query(rawUserProposalCollectionPresentation(userId), orderBy('uploadedAt', 'desc')));
}

export function getProposal(userId: string, proposalId: string) {
  return useDocument(doc(rawUserProposalCollectionPresentation(userId), proposalId));
}

export function generateProposalId(date: Date, index: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}_${index}`;
}

export function parseProposalId(proposalId: string): { date: Date; index: number } | null {
  const match = proposalId.match(/^(\d{4})(\d{2})(\d{2})_(\d+)$/);
  if (!match) return null;

  const year = match[1];
  const month = match[2];
  const day = match[3];
  const index = match[4];

  if (!year || !month || !day || !index) return null;

  return {
    date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
    index: parseInt(index),
  };
}

export function translateProposalType(type: string): string {
  const typeMap: Record<string, string> = {
    law: '法律修正案',
    general: '一般提案',
    presentation: '專案報告',
  };
  return typeMap[type] || type;
}
