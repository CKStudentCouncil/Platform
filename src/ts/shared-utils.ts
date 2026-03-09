import { REIGN_YEAR_BASE } from '../../constants';

export function schoolEmailFromSchoolNumber(schoolNumber: string): string {
  return `dt${schoolNumber}@dtjh.ptc.edu.tw`;
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
