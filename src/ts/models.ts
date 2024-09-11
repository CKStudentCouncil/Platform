import { collection, doc, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import { FirestoreDataConverter } from '@firebase/firestore';

const date = new Date();
export const timezoneOffset = date.getTimezoneOffset() * 60 * 1000; // -480
export const currentReign = `${date.getFullYear() - 1945}-${date.getMonth() > 7 || date.getMonth() < 1 ? '1' : '2'}`; // August to January

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
  seatNumber: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role?: number | undefined;
  schoolNumber?: string;
  clazz?: string; // class, but to avoid internal keyword conflict
  seatNumber?: string;
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
  reign: string; // 79-1
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
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    data.start = new Date(data.start.toMillis());
    if (data.stop) data.stop = new Date(data.stop.toMillis());
    for (const key in data.absences) {
      data.absences[key].scheduledAt = new Date(data.absences[key].scheduledAt.toMillis());
    }
    return data as unknown as Meeting;
  },
};

export function rawMeetingCollection() {
  const db = useFirestore();
  return collection(db, 'meetings').withConverter(meetingConverter);
}

export function meetingCollection() {
  return useCollection(query(rawMeetingCollection(), orderBy('start', 'desc')));
}

export function currentReignMeetingCollection() {
  return useCollection(query(query(rawMeetingCollection(), orderBy('start', 'desc')), where('reign', '==', currentReign)));
}

export function getMeeting(id: string) {
  return useDocument(doc(rawMeetingCollection(), id));
}

export interface Proposal extends DocumentType {
  attachments: string[];
  proposer: string;
  activeVotable?: string | null;
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
  return useCollection(query(rawProposalCollection(meetingId), orderBy('order')));
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
  return useCollection(query(rawVotableCollection(meetingId, proposalId), orderBy('order')));
}

export function getVotable(meetingId: string, proposalId: string, votableId: string) {
  return useDocument(doc(rawVotableCollection(meetingId, proposalId), votableId));
}
