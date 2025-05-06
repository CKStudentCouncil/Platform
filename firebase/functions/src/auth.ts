import { https } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Role, User } from './models';

const auth = admin.auth();

export async function checkRole(request: https.CallableRequest, role: Role) {
  if (!request.auth) {
    throw new https.HttpsError('unauthenticated', 'You must be authenticated');
  }
  if (request.auth.uid == '38fWtZ4AKRU3oAZjfrt9nBq7d8B2') {
    // Root account
    return;
  }
  const user = await auth.getUser(request.auth.uid);
  const userRole = user.customClaims?.role;
  if (userRole == null || userRole < role.valueOf()) {
    throw new https.HttpsError(
      'permission-denied',
      `You do not have the required role (You:${userRole}/Req:${role.valueOf()}) to perform this action`,
    );
  }
}

export async function addUserWithRole(user: User) {
  let result = null;
  try {
    result = await auth.getUserByEmail(user.email);
  } catch {
    // user not found
  }
  if (!result) {
    result = await auth.createUser({
      email: user.email,
      emailVerified: true,
      password: 'ck$c' + user.schoolNumber + '@' + user.clazz,
      displayName: user.name,
      disabled: false,
    });
  }
  await auth.setCustomUserClaims(result.uid, {
    role: user.role,
    schoolNumber: user.schoolNumber,
    seatNumber: user.seatNumber,
    clazz: user.clazz,
    realName: user.name,
  });
  return result;
}

export async function editUserClaims(uid: string, user: User) {
  let validClaims = (await auth.getUser(uid)).customClaims;
  if (validClaims == null) {
    validClaims = {};
  }
  for (const key in user) {
    if (user[key as keyof User] != null && key != 'uid' && key != 'email' && key != 'name') {
      validClaims[key as keyof typeof validClaims] = user[key as keyof User];
    }
  }
  await auth.setCustomUserClaims(uid, validClaims);
}
