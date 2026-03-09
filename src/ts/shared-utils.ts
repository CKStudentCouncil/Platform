import { REIGN_YEAR_BASE } from '../../constants';

export function schoolEmailFromSchoolNumber(schoolNumber: string): string {
  return schoolNumber.startsWith('11100') ? `ck${schoolNumber.replace('11100', '1110')}@gl.ck.tp.edu.tw` : `ck${schoolNumber}@gl.ck.tp.edu.tw`;
}

export function getReign(date: Date) {
  let year: number;
  if (date.getMonth() < 7) {
    // jan ~ july
    year = date.getFullYear() - REIGN_YEAR_BASE - 1;
  } else {
    year = date.getFullYear() - REIGN_YEAR_BASE;
  }
  if (date.getMonth() > 6 || date.getMonth() == 0) {
    // aug ~ jan
    return `${year}-1`;
  }
  return `${year}-2`;
}

export function getCurrentReign() {
  return getReign(new Date());
}
