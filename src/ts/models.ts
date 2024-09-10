import { collection, doc, Timestamp } from 'firebase/firestore';
import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import { FirestoreDataConverter } from '@firebase/firestore';

const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000;

export enum Role {
  Admin = 999,
  Chair = 200,
  ViceChair = 150,
  Secretary = 100,
  ClassRep = 50,
  Anonymous = 0,
}

export interface UserClaims {
  role: number;
  schoolNumber: string;
  clazz: string; // class, but to avoid internal keyword conflict
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role?: number | undefined;
  schoolNumber?: string;
  clazz?: string; // class, but to avoid internal keyword conflict
}

export interface Meeting extends DocumentType {
  active: boolean;
  name: string;
  participants: string[];
  punchInPasscode: string;
  signOffPasscode?: string;
  activeProposal?: string;
  signedOff: string[];
  start: Date;
  stop?: Date;
  absences: Record<string, Absence>;
}

interface Absence {
  reason: string;
  scheduledAt: Date;
}

export const meetingConverter: FirestoreDataConverter<Meeting | null> = {
  toFirestore(data: any) {
    data.start = Timestamp.fromMillis(data.start.valueOf() - timezoneOffset);
    if (data.stop) data.stop = Timestamp.fromMillis(data.stop.valueOf() - timezoneOffset);
    for (const key in data.absences) {
      data.absences[key].scheduledAt = Timestamp.fromMillis(data.absences[key].scheduledAt.valueOf() - timezoneOffset);
    }
    return firestoreDeaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    data.start = new Date(data.start.toMillis() + timezoneOffset);
    if (data.stop) data.stop = new Date(data.stop.toMillis() + timezoneOffset);
    for (const key in data.absences) {
      data.absences[key].scheduledAt = new Date(data.absences[key].scheduledAt.toMillis() + timezoneOffset);
    }
    return data as unknown as Meeting;
  },
};

export function rawMeetingCollection() {
  const db = useFirestore();
  return collection(db, 'meetings').withConverter(meetingConverter);
}

export function meetingCollection() {
  return useCollection(rawMeetingCollection());
}

export function getMeeting(id: string) {
  return useDocument(doc(rawMeetingCollection(), id));
}

export interface Proposal extends DocumentType {
  attachments: string[];
  proposer: string;
  activeVotable?: string;
  title: string;
  content: string;
  order: number;
  speakRequests: string[];
}

export function rawProposalCollection(meetingId: string) {
  const db = useFirestore();
  return collection(db, `meetings/${meetingId}/proposals`);
}

export function proposalCollection(meetingId: string) {
  return useCollection(rawProposalCollection(meetingId));
}

export function getProposal(meetingId: string, proposalId: string) {
  return useDocument(doc(rawProposalCollection(meetingId), proposalId));
}

export interface Votable extends DocumentType {
  choices: string[];
  question: string;
  order: number;
  results: Record<string, string[]>;
}

export function rawVotableCollection(meetingId: string, proposalId: string) {
  const db = useFirestore();
  return collection(db, `meetings/${meetingId}/proposals/${proposalId}/votables`);
}

export function votableCollection(meetingId: string, proposalId: string) {
  return useCollection(rawVotableCollection(meetingId, proposalId));
}

export function getVotable(meetingId: string, proposalId: string, votableId: string) {
  return useDocument(doc(rawVotableCollection(meetingId, proposalId), votableId));
}
