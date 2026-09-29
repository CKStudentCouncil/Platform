---
name: fix-sentry-issues
description: Triage every open Sentry issue on the CKSC platform project, fix the ones that are real defects in this repo, filter or document the ones that are not, and resolve them in Sentry. Use when asked to "fix the Sentry issues", "clear Sentry", "resolve Sentry errors", or to check what is currently failing in production.
---

# Fix Sentry issues

Work through every open issue on the platform project, fix what is genuinely a
code defect, and close each issue in Sentry once its fix is committed.

- Sentry org: `cksc`, region URL `https://us.sentry.io`
- Sentry project: `platform` (issue short IDs look like `PLATFORM-7`).
  The org also has a `legislation` project — ignore it unless the user asks.
- Frontend init: [src/boot/sentry.ts](../../../src/boot/sentry.ts). Cloud
  Functions live in `firebase/functions/`.

Tools are the `mcp__claude_ai_Sentry__*` set; if their schemas are not loaded,
load them with ToolSearch (`select:mcp__claude_ai_Sentry__search_issues,
mcp__claude_ai_Sentry__get_sentry_resource,mcp__claude_ai_Sentry__update_issue,
mcp__claude_ai_Sentry__search_events`). If Sentry is unavailable, stop and say
so — do not guess at issues.

## 1. Collect

1. `search_issues` with `organizationSlug: "cksc"`, `projectSlugOrId: "platform"`,
   `regionUrl: "https://us.sentry.io"`, `query: "is:unresolved"`, `limit: 100`,
   `period: "90d"`, `sort: "freq"`. Run it again with `is:regressed` and
   `is:for_review` if the first call looks short; de-duplicate by short ID.
2. Ignore `environment:development` issues — `src/boot/sentry.ts` disables
   Sentry in dev, so they mean something is misconfigured, not broken.
3. If there are none, report that and stop.

## 2. Understand each issue before touching code

For every issue, `get_sentry_resource` (resourceType `issue`) and read: the
title, the culprit, the stack trace, breadcrumbs, `firstSeen`/`lastSeen`, user
count, release, and browser/OS tags. Pull a few individual events with
`search_events` (dataset `errors`) when the tags or breadcrumbs vary. Then find
the code in the repo the stack points at. Stack traces are un-minified through
uploaded source maps; if a frame is still minified, say so and work from the
breadcrumbs and message instead of guessing.

Use `analyze_issue_with_seer` only when the root cause is not clear from the
event itself — it takes minutes and is a hint, not an answer. Verify anything it
suggests against the code.

Related issues often share one cause (one bad listener, one unguarded promise).
Group them and fix the cause once.

## 3. Classify

Decide which bucket each issue is in, and be honest about it — a fix that only
hides the error is worse than none.

| Bucket | Meaning | Action |
| --- | --- | --- |
| **Defect** | Our code is wrong (undefined access, unawaited promise, bad route param, missing guard, rules mismatch). | Fix the root cause. |
| **Handled condition** | The app can recover but reports it as a crash (offline phone, blocked popup, stale chunk after deploy, denied sign-in). | Handle it in the UI and mark it breadcrumb-only, or drop it in `beforeSend`. See [src/ts/autherrors.ts](../../../src/ts/autherrors.ts), [chunkerrors.ts](../../../src/ts/chunkerrors.ts), [networkerrors.ts](../../../src/ts/networkerrors.ts) for the existing pattern. |
| **Configuration / external** | A Firebase, Google, or browser-extension issue that no code change here can fix (e.g. Identity Platform sign-up restriction). | Do not change code. Explain in the resolve reason and in the final report what the user has to change. |
| **Unactionable** | No stack in our code, third-party script, one-off with no reproduction. | Leave open or ignore with a reason; never mark resolved as if fixed. |

Rules that came out of earlier rounds of this work:

- Fix causes, not symptoms. Swallowing an error to make the count drop, or
  filtering it in `beforeSend` without handling it, needs a written reason.
- Every filter must be narrow (match on a specific error code/message and
  context) so it cannot hide an unrelated real failure. Put the matcher in its
  own small module under `src/ts/` and keep the comment explaining why.
- Do not put student names, school numbers or class data into breadcrumbs,
  tags or messages — the project deliberately keeps that out of Sentry.
- A fix can trade one issue for another (a caught rejection re-surfacing
  through Vue's error handler). Trace where the error goes *after* your catch.
- Firestore listener denials usually mean a listener opened before auth
  resolved or against a rule that does not grant it: check
  `firebase/firestore.rules` and `src/ts/firestore.ts` before adding a catch.

## 4. Fix

- Work on a branch off `main` if the tree is on `main` and the changes are
  more than trivial, or when the user asked for a PR; otherwise follow the
  user's usual flow of committing to the current branch.
- Match surrounding code style (Prettier config in `.prettierrc`, 2-space).
- Keep changes scoped to the issues at hand; no drive-by refactors.
- If the change touches `firebase/functions/`, also run its build/lint from
  that directory.

## 5. Verify

Run from the repo root and fix anything you broke:

```bash
yarn lint
yarn build
```

For Cloud Functions changes: `cd firebase/functions && yarn lint && yarn build`.
There are no unit tests (`yarn test` is a no-op), so also re-read each fix
against the original stack trace and confirm the failing path can no longer
reach the throwing line. Use the `run` skill to exercise the affected page
in a browser when the bug is UI-driven and reproducible locally.

## 6. Commit

Commit only after verification passes, and only when the user has asked for
commits (they usually have for this skill; if unclear, ask once). One commit
per root cause, in the repo's existing style:

```
fix: <what was wrong, in plain terms>

<why it happened, what the change does, which trade-offs>
(Fixes PLATFORM-N, PLATFORM-M)
```

Use `fix(functions):` for Cloud Functions or `fix(rules):` for Firestore
rules. Append the attribution trailer from the session's system reminder.
Do not push unless the user asks.

## 7. Resolve in Sentry

Resolving is visible to the whole team, so only do it for issues whose fix is
actually committed, and only after step 5 passed.

- Defect fixed and committed → `update_issue` with `status: "resolved"` (or
  `"resolvedInNextRelease"` if the fix has not been deployed yet — this is
  usually the right choice, because plain `resolved` reopens as *regressed* if
  events from the old release keep arriving) and a `reason` naming the commit
  hash and one line of what changed.
- Handled condition now filtered/handled → `resolved` with a reason.
- Configuration / external → leave `unresolved` unless the user says the
  setting was changed; alternatively `ignored` with `ignoreMode:
  "untilEscalating"` and a reason, if the user agrees.
- Unactionable → leave open, or `ignored` with a reason if the user agrees.
- Never bulk-resolve to get to zero.

## 8. Report

End with a table: short ID, title, bucket, what was done (commit hash or "no
code change"), and Sentry status now. Call out anything left open and what the
user must do (deploy, change a Firebase setting, decide about an ignore).
If the project had regressed issues from an earlier round, say what the
earlier fix missed.
