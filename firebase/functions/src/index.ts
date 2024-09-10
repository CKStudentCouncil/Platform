/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';
//@formatter:on
import { addUserWithRole, checkRole, editUserClaims } from './auth';
import { onCall } from 'firebase-functions/v2/https';
import { Role, User } from './models';
//@formatter:off
admin.initializeApp(); // This is required to run before everything else

// const db = admin.firestore();
const globalFunctionOptions = { region: 'asia-east1' };

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
  await checkRole(request, Role.Chair);
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
