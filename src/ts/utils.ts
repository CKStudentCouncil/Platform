export function generateRandomText(length: number): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const date = new Date();
export const currentReign = date.getMonth() > 7 || date.getMonth() < 1 ?
  `${date.getFullYear() - 1945}-1` : // August to January
  `${date.getFullYear() - 1945 - 1}-2`; // February to July
