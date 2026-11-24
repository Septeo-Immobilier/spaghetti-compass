#!/usr/bin/env node
// Next version of the published Claude Code plugin, from `plugin-v*` tags and
// Conventional Commits. Claude Code only offers an update when the plugin
// `version` string changes, so every publish must carry a new version.
//
// The `plugin-v` prefix keeps these tags apart from semantic-release's `v*` tags
// (which version the npm package and would otherwise be mistaken for plugin tags).
//
// Usage: node scripts/plugin/next-version.mjs [--ref HEAD]
// Prints the version (no prefix). The tag is created by CI after a successful publish.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TAG_PREFIX = 'plugin-v';
const SEMVER = /^\d+\.\d+\.\d+$/;
const ORDER = { none: 0, patch: 1, minor: 2, major: 3 };

/** Bump level implied by one commit message. */
export function commitBump(message) {
  const [subject = ''] = message.split('\n');
  if (/^BREAKING[ -]CHANGE:/m.test(message) || /^\w+(\([^)]*\))?!:/.test(subject)) return 'major';
  const type = subject.match(/^(\w+)(\([^)]*\))?:/)?.[1];
  if (type === 'feat') return 'minor';
  return 'none';
}

/** Next version after `base`. A publish changes the shipped content, so it is at least a patch. */
export function nextVersion(base, messages) {
  if (!SEMVER.test(base)) throw new Error(`invalid base version '${base}'`);
  let level = 'patch';
  for (const m of messages) if (ORDER[commitBump(m)] > ORDER[level]) level = commitBump(m);
  const [maj, min, pat] = base.split('.').map(Number);
  if (level === 'major') return `${maj + 1}.0.0`;
  if (level === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

/** Version to publish for `ref`: reuse a tag already on it, else bump from the latest plugin tag. */
export function versionForRef({ cwd, ref = 'HEAD', seed }) {
  const match = `${TAG_PREFIX}[0-9]*`;
  const valid = (t) => SEMVER.test(t.slice(TAG_PREFIX.length));
  const own = git(cwd, 'tag', '--points-at', ref, '--list', match).split('\n').filter(Boolean).filter(valid);
  if (own.length) return own.sort((a, b) => cmp(b, a))[0].slice(TAG_PREFIX.length);
  let base = seed;
  let range = ref;
  try {
    const tag = git(cwd, 'describe', '--tags', '--abbrev=0', '--match', match, ref);
    if (valid(tag)) {
      base = tag.slice(TAG_PREFIX.length);
      range = `${tag}..${ref}`;
    }
  } catch {
    // First publish: plain patch bump of the seed, pre-tag history is ignored on purpose.
    return nextVersion(base, []);
  }
  const raw = git(cwd, 'log', '--format=%B%x00', range);
  return nextVersion(base, raw.split('\0').map((s) => s.trim()).filter(Boolean));
}

function cmp(a, b) {
  const [x, y] = [a, b].map((t) => t.slice(TAG_PREFIX.length).split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const i = process.argv.indexOf('--ref');
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  console.log(versionForRef({ cwd: root, ref: i === -1 ? 'HEAD' : process.argv[i + 1], seed }));
}
