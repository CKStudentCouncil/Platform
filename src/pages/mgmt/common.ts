import { Votable } from 'src/ts/models.ts';

export function exportVotingData(votables: Votable[]) {
  let r = '';
  let count = 1;
  for (const votable of votables) {
    if (!votable) {
      continue;
    }
    r += `<div style="font-size: medium"><b>(${count}) ${votable.question}</b> (${votable.type.translation})</div>`;
    let maxLen = 0;
    let maxChoice = '';
    for (const choice of votable.choices) {
      if (!votable.results[choice]) {
        r += `<div style="font-size: medium"><b>${choice}</b>: 無；共 0 人</div>`;
        continue;
      }
      const length = votable.results[choice].length;
      r += `<div style="font-size: medium"><b>${choice}</b>: ${votable.results[choice].join('、')}；共 ${length} 人</div>`;
      if (length > maxLen) {
        maxLen = length;
        maxChoice = choice;
      }
    }
    r += '<div style="font-size: medium">表決結果：<b>' + maxChoice + '</b></div><br>';
    count++;
  }
  return r;
}
