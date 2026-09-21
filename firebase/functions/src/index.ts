/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// @formatter:off
import * as admin from 'firebase-admin';
admin.initializeApp(); // This is required to run before everything else
import { addUserWithRole, checkRole, editUserClaims } from './auth';
import { DRIVE_ROOT_FOLDER_ID, MAX_ATTACHMENT_BYTES } from '../../../shared/constants';
import { getCurrentReign } from '../../../shared/utils';
import { onCall } from 'firebase-functions/v2/https';
import { drive_v3, google } from 'googleapis';
import * as Stream from 'stream';
import { getFirestore } from 'firebase-admin/firestore';
import { https, logger } from 'firebase-functions';
import { Role, User } from '../../../shared/models';
// @formatter:on

// const db = admin.firestore();
const globalFunctionOptions = { region: 'asia-east1' };
const auth = new google.auth.GoogleAuth({ keyFile: 'src/credential.json', scopes: ['https://www.googleapis.com/auth/drive.file'] });
const driveAPI = google.drive({ version: 'v3', auth }) as drive_v3.Drive;
const db = getFirestore();

export const addUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Chair);
  const user = request.data as User;
  await addUserWithRole(user);
  return { success: true };
});

export const bulkAddUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Chair);
  const users = request.data as User[];
  const tasks = [];
  for (const user of users) {
    tasks.push(addUserWithRole(user));
  }
  await Promise.all(tasks);
  return { success: true };
});

export const bulkRemoveUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Chair);
  const tasks = [];
  for (const user of request.data.users) {
    tasks.push(admin.auth().deleteUser(user));
  }
  await Promise.all(tasks);
  return { success: true };
});

export const deleteUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Chair);
  await admin.auth().deleteUser(request.data.uid);
  return { success: true };
});

export const editUser = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Chair);
  await editUserClaims(request.data.uid, request.data.claims);
  return { success: true };
});

export const getAllUsers = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Secretary); // They need this to export attendance
  const users = await admin.auth().listUsers();
  return users.users.map((user) => {
    return {
      uid: user.uid,
      email: user.email,
      role: user.customClaims?.role,
      schoolNumber: user.customClaims?.schoolNumber,
      clazz: user.customClaims?.clazz,
      name: user.displayName,
      seatNumber: user.customClaims?.seatNumber,
    };
  });
});

export const register = onCall(globalFunctionOptions, async (request) => {
  const activeMeeting = await db.collection('meetings').where('active', '==', true).get();
  if (activeMeeting.size == 0 || !activeMeeting.docs[0]?.data().registration) {
    throw new https.HttpsError('permission-denied', 'Registration disabled.');
  }
  const user = request.data as User;
  user.role = Role.ClassRep;
  await addUserWithRole(user);
  return { success: true };
});

const DEFAULT_MIME_TYPE = 'application/octet-stream';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const ATTACHMENT_OWNER_EMAIL = 'cksc77th@gmail.com';

// Drive's query language only escapes backslashes and single quotes inside a string literal.
function escapeDriveQueryValue(value: string) {
  return value.replace(/[\\']/g, (match) => `\\${match}`);
}

async function getOrCreateReignFolder(reign: string) {
  const folderQuery = await driveAPI.files.list({
    q: [
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      `name = '${escapeDriveQueryValue(reign)}'`,
      `'${DRIVE_ROOT_FOLDER_ID}' in parents`,
      'trashed = false',
    ].join(' and '),
    fields: 'files(id)',
    pageSize: 1,
  });
  const existing = folderQuery.data.files?.[0]?.id;
  if (existing) {
    return existing;
  }
  const created = await driveAPI.files.create({
    requestBody: {
      name: reign,
      mimeType: FOLDER_MIME_TYPE,
      parents: [DRIVE_ROOT_FOLDER_ID],
    },
    fields: 'id',
  });
  return created.data.id ?? DRIVE_ROOT_FOLDER_ID;
}

export const uploadAttachment = onCall({ ...globalFunctionOptions, memory: '512MiB' as const, timeoutSeconds: 120 }, async (request) => {
  await checkRole(request, Role.OtherDepartment);
  const data = request.data ?? {};
  const { name, content } = data;
  // Older bundles send `mimetype`; accept both spellings so they keep working after this deploy.
  const mimeType: string = data.mimeType || data.mimetype || DEFAULT_MIME_TYPE;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new https.HttpsError('invalid-argument', 'A file name is required.');
  }
  if (typeof content !== 'string' || content.length === 0) {
    throw new https.HttpsError('invalid-argument', `The contents of "${name}" are missing or could not be read.`);
  }

  const body = Buffer.from(content, 'base64');
  if (body.length === 0) {
    throw new https.HttpsError('invalid-argument', `The contents of "${name}" are empty.`);
  }
  if (body.length > MAX_ATTACHMENT_BYTES) {
    throw new https.HttpsError(
      'invalid-argument',
      `"${name}" is ${Math.round(body.length / 1024 / 1024)} MB, over the ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB limit.`,
    );
  }

  try {
    const folder = await getOrCreateReignFolder(getCurrentReign());
    const file = await driveAPI.files.create({
      requestBody: {
        name,
        mimeType,
        parents: [folder],
      },
      media: {
        mimeType,
        body: Stream.Readable.from(body),
      },
      fields: 'id,webViewLink',
    });
    const fileId = file.data.id;
    if (!fileId) {
      throw new Error('Drive accepted the upload but returned no file id');
    }
    await driveAPI.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    await driveAPI.permissions.create({
      fileId,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: ATTACHMENT_OWNER_EMAIL,
      },
    });
    return { success: true, url: file.data.webViewLink };
  } catch (e) {
    // Anything thrown past this point reaches the browser as an opaque "INTERNAL",
    // so record what actually failed and hand the caller something it can display.
    logger.error('uploadAttachment failed', { name, mimeType, bytes: body.length, error: e });
    throw new https.HttpsError('internal', `Google Drive rejected the upload: ${(e as Error).message}`);
  }
});
