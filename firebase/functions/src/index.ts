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
import {addUserWithRole, checkRole, editUserClaims} from './auth';
import {onCall} from 'firebase-functions/v2/https';
import {Role, User} from './models';
import {drive_v3, google} from 'googleapis';
import * as Stream from 'stream';
// @formatter:on

// const db = admin.firestore();
const globalFunctionOptions = { region: 'asia-east1' };
const auth = new google.auth.GoogleAuth({ keyFile: 'src/credential.json', scopes: ['https://www.googleapis.com/auth/drive.file'] });
const driveAPI = google.drive({ version: 'v3', auth }) as drive_v3.Drive;

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
      seatNumber: user.customClaims?.seatNumber
    };
  });
});

export const uploadAttachment = onCall(globalFunctionOptions, async (request) => {
  await checkRole(request, Role.Secretary);
  const { name, content, mimeType } = request.data;
  const folderQuery = await driveAPI.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${getCurrentReign()}'`,
    fields: 'files(id)'
  });
  let folder: string | null | undefined = null;
  if ((folderQuery.data.files?.length ?? 0) == 0) {
    folder = (await driveAPI.files.create({
      requestBody: {
        name: getCurrentReign(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['1nvd__dCm-_yUR-QpV0rn6NKdavxcN2B0']
      },
      fields: 'id'
    })).data.id;
  } else {
    folder = folderQuery.data.files?.[0].id;
  }
  const file = await driveAPI.files.create({
    requestBody: {
      name,
      mimeType,
      parents: [folder ?? '1nvd__dCm-_yUR-QpV0rn6NKdavxcN2B0']
    },
    media: {
      mimeType,
      body: new Stream.PassThrough().end(Buffer.from(content, 'base64'))
    },
    fields: 'id,webViewLink'
  });
  await driveAPI.permissions.create({
    fileId: file.data.id ?? '',
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
  await driveAPI.permissions.create({
    fileId: file.data.id ?? '',
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: 'cksc77th@gmail.com'
    }
  });
  return { success: true, url: file.data.webViewLink };
});

export function getReign(date: Date) {
  if (date.getMonth() > 7 || date.getMonth() < 1) { // -1
    return `${date.getFullYear() - 1945}-1`
  }
  return `${date.getFullYear() - 1945 - 1}-2`;
}

export function getCurrentReign() {
  return getReign(new Date());
}
