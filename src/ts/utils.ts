export function generateRandomText(length: number, bannedPrefix: string | null): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  if (bannedPrefix && result.startsWith(bannedPrefix)) {
    return generateRandomText(length, bannedPrefix);
  }
  return result;
}

export function schoolEmailFromSchoolNumber(schoolNumber: string): string {
  return schoolNumber.startsWith('11100')
    ? `ck${schoolNumber.replace('11100', '1110')}@gl.ck.tp.edu.tw`
    : `ck${schoolNumber}@gl.ck.tp.edu.tw`;
}

const date = new Date();
export const currentReign = date.getMonth() > 7 || date.getMonth() < 1 ?
  `${date.getFullYear() - 1945}-1` : // August to January
  `${date.getFullYear() - 1945 - 1}-2`; // February to July
