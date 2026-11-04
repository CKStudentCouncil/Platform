import type { Votable } from 'src/ts/models.ts';

// Votable fields are Firestore data that lower roles can write; the returned HTML is rendered via innerHTML.
function escapeHtml(value: string) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function exportVotingData(votables: Votable[]) {
  let r = '';
  let count = 1;
  for (const votable of votables) {
    if (!votable) {
      continue;
    }
    r += `<div style="font-size: medium"><b>(${count}) ${escapeHtml(votable.question)}</b> (${escapeHtml(votable.type.translation)})</div>`;
    let maxLen = 0;
    let maxChoice = '';
    for (const choice of votable.choices) {
      if (!votable.results[choice]) {
        r += `<div style="font-size: medium"><b>${escapeHtml(choice)}</b>: 無；共 0 人</div>`;
        continue;
      }
      const length = votable.results[choice].length;
      r += `<div style="font-size: medium"><b>${escapeHtml(choice)}</b>: ${escapeHtml(votable.results[choice].join('、'))}；共 ${length} 人</div>`;
      if (length > maxLen) {
        maxLen = length;
        maxChoice = choice;
      }
    }
    r += '<div style="font-size: medium">表決結果：<b>' + escapeHtml(maxChoice) + '</b></div><br>';
    count++;
  }
  return r;
}
