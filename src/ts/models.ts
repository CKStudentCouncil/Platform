import { collection, doc, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { firestoreDefaultConverter, useCollection, useDocument, useFirestore } from 'vuefire';
import type { FirestoreDataConverter } from '@firebase/firestore';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';
import { getCurrentReign } from 'src/ts/utils.ts';
import { guardListener } from 'src/ts/firestore.ts';

export enum Role {
  Admin = 999,
  Chair = 200,
  ViceChair = 150,
  Secretary = 100,
  OtherDepartment = 25,
  ClassRep = 50,
  Anonymous = 0,
}

export interface UserClaims {
  role: number;
  schoolNumber: string;
  clazz: string; // class, but to avoid internal keyword conflict
  seatNumber: string;
  name: string;
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
  registration?: boolean; // Whether to allow account registration
  exemptFromAttendance?: boolean; // Whether to exempt this meeting from attendance
  customAttendanceBar?: number | null;
}

export interface MeetingId extends Meeting {
  id: string;
}

interface Absence {
  reason: string;
  scheduledAt: Date;
}

export const meetingConverter: FirestoreDataConverter<Meeting | null> = {
  toFirestore(data: any) {
    data.start = Timestamp.fromDate(data.start);
    if (data.stop) data.stop = Timestamp.fromDate(data.stop);
    for (const key in data.absences) {
      data.absences[key].scheduledAt = Timestamp.fromDate(data.absences[key].scheduledAt);
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

export function meetingCollectionOfReign(reign: Ref<string>) {
  const meetingsQuery = computed(() => query(rawMeetingCollection(), where('reign', '==', reign.value), orderBy('start', 'desc')));
  return guardListener(useCollection(meetingsQuery), 'meetingCollectionOfReign');
}

export function rawMeetingsOfCurrentReignQuery() {
  return query(query(rawMeetingCollection(), orderBy('start', 'desc')), where('reign', '==', getCurrentReign()));
}

export function meetingCollectionOfCurrentReign() {
  return guardListener(useCollection(rawMeetingsOfCurrentReignQuery()), 'meetingCollectionOfCurrentReign');
}

/**
 * @param id - which meeting to watch. Accepts a getter so a caller can hold the
 *   listener shut — by resolving to `null` — until it is allowed to read.
 *   `firestore.rules` grants `meetings/**` to `request.auth != null` and nothing
 *   else, so a page that opens this before Firebase Auth has restored the
 *   session is asking for a denial rather than racing one: Firestore does not
 *   retry a listener the rules rejected, it reports the error and gives up.
 */
export function getMeeting(id: MaybeRefOrGetter<string | null | undefined>) {
  const meetingRef = computed(() => {
    const meetingId = toValue(id);
    return meetingId ? doc(rawMeetingCollection(), meetingId) : null;
  });
  return guardListener(useDocument(meetingRef, { reset: true }), 'getMeeting');
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

export interface ProposalId extends Proposal {
  id: string;
}

export function rawProposalCollection(meetingId: string) {
  const db = useFirestore();
  return collection(db, `meetings/${meetingId}/proposals`);
}

export function proposalCollection(meetingId: string) {
  return guardListener(useCollection(query(rawProposalCollection(meetingId), orderBy('order'))), 'proposalCollection');
}

export function getProposal(meetingId: string, proposalId: string) {
  return guardListener(useDocument(doc(rawProposalCollection(meetingId), proposalId)), 'getProposal');
}

export interface Votable extends DocumentType {
  choices: string[];
  question: string;
  order: number;
  type: VotableType;
  results: Record<string, string[]>;
}

export class VotableType {
  static Absolute = new VotableType('Absolute', '絕對多數決');
  static AbsoluteTwoThirds = new VotableType('AbsoluteTwoThirds', '>=出席班代2/3');
  static Relative = new VotableType('Relative', '相對多數決');
  static VALUES = {
    Absolute: VotableType.Absolute,
    AbsoluteTwoThirds: VotableType.AbsoluteTwoThirds,
    Relative: VotableType.Relative,
  } as Record<string, VotableType>;

  constructor(
    public firebase: string,
    public translation: string,
  ) {}
}

export const votableConverter: FirestoreDataConverter<Votable | null> = {
  toFirestore(data: any) {
    data.type = data.type.firebase;
    return firestoreDefaultConverter.toFirestore(data);
  },
  fromFirestore(snapshot, options) {
    const data = firestoreDefaultConverter.fromFirestore(snapshot, options);
    if (!data) return null;
    if (data.type && typeof data.type === 'string' && data.type in VotableType.VALUES) data.type = VotableType.VALUES[data.type];
    else data.type = VotableType.Absolute;
    return data as unknown as Votable;
  },
};

export function rawVotableCollection(meetingId: string, proposalId: string) {
  const db = useFirestore();
  return collection(db, `meetings/${meetingId}/proposals/${proposalId}/votables`).withConverter(votableConverter);
}

export function votableCollection(meetingId: string, proposalId: string) {
  return guardListener(useCollection(query(rawVotableCollection(meetingId, proposalId), orderBy('order'))), 'votableCollection');
}

export function getVotable(meetingId: string, proposalId: string, votableId: string) {
  return guardListener(useDocument(doc(rawVotableCollection(meetingId, proposalId), votableId)), 'getVotable');
}
