import { collection, doc, orderBy, query, Timestamp } from 'firebase/firestore';
import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from '@firebase/firestore';

export type Person = [string, string, string];

export interface PersonRecord {
  classNum: string;
  jobTitle: string;
  name: string;
}

export function personToRecord(p: Person): PersonRecord {
  return { classNum: p[0], jobTitle: p[1], name: p[2] };
}

export function recordToPerson(r: PersonRecord): Person {
  return [r.classNum ?? '', r.jobTitle ?? '', r.name ?? ''];
}

export interface Proposal {
  title: string;
  content: string;
  type: string;
  proposer: string;
  reign: string;
  basis?: string;
  done?: boolean;
  attachments?: string[];
  cosigners?: PersonRecord[];
  uploadedAt: Date;
  submittedAt?: Date;
}

export interface ProposalId extends Proposal {
  id: string;
}

export const proposalConverter: FirestoreDataConverter<Proposal | null> = {
  toFirestore(data: any) {
    const out = { ...data };

    if (out.uploadedAt) {
      out.uploadedAt = Timestamp.fromDate(out.uploadedAt);
    }

    if (out.submittedAt) {
      out.submittedAt = Timestamp.fromDate(out.submittedAt);
    }

    if (Array.isArray(out.proposer)) {
      out.proposer = personToRecord(out.proposer as Person);
    }

    if (Array.isArray(out.cosigners)) {
      out.cosigners = out.cosigners.map((c: Person | PersonRecord) => (Array.isArray(c) ? personToRecord(c) : c));
    }

    return firestoreDefaultConverter.toFirestore(out);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;

    if (data.uploadedAt) {
      data.uploadedAt = new Date(data.uploadedAt.toMillis());
    }

    if (data.submittedAt) {
      data.submittedAt = new Date(data.submittedAt.toMillis());
    }

    return data as unknown as Proposal;
  },
};

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

export function generateProposalId(type: string, date: Date, clazz: string, seatnumber: string, proposername: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${type}_${year}${month}${day}_${hour}:${minute}:${second}_${clazz}${seatnumber}${proposername}`;
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

export function translateProposalType(type: string, role?: number): string {
  const typeMap: Record<string, string> = {
    law: '法律修正案',
    general: '一般提案',
    presentation: '專案報告',
    ...(role === 25 && {
      nomination: '人事案',
      election: '學代選舉案',
    }),
  };
  return typeMap[type] || '';
}
