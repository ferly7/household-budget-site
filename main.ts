// HomeLedger — the hand-in program for the make.fun household-budget bounty.
//
// This repository is a plain static site: app/ holds the HTML, CSS and ES
// modules a browser opens directly, with no build step and no network
// dependency. Running this file gathers the entry: it copies app/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json, the summary the judge reads — screenshots, first-load
// files and bytes, and the site's source — using the vendored make.fun
// library. Keep vendor/makefun-frontend.ts untouched: the scorer rebuilds the
// dossier with its own identical copy and the two must match byte for byte.
//
// Local check (outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps (from its reference/gate.json): only text_max_bytes
// shapes the bytes; the rest refuse an entry the scorer would refuse anyway
// (more than 4 screenshots or one over 256 KiB; more than 993 entries or
// 16 MiB in app/ — app/ shares /output's own 1000-entry cap with
// screenshots/ and dossier.json, so the limits leave room).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
