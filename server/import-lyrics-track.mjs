#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function parseLrcTimestamp(value) {
  const match = value.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const rawMs = match[3] ? Number(match[3].padEnd(3, '0')) : 0;
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(rawMs)) {
    return null;
  }

  return minutes * 60_000 + seconds * 1000 + rawMs;
}

function parseLrcFile(contents) {
  const lines = contents.split(/\r?\n/);
  const timestamps = [];

  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{1,3}:\d{2}(?:\.\d{1,3})?)\]/g)];
    if (matches.length === 0) {
      continue;
    }

    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) {
      continue;
    }

    for (const match of matches) {
      const ms = parseLrcTimestamp(match[1]);
      if (ms === null) {
        continue;
      }
      timestamps.push({ startMs: ms, text });
    }
  }

  timestamps.sort((a, b) => a.startMs - b.startMs);

  return timestamps.map((entry, index) => {
    const next = timestamps[index + 1];
    const defaultEndMs = entry.startMs + 2500;
    return {
      id: `line-${index + 1}`,
      startMs: entry.startMs,
      endMs: next ? Math.max(entry.startMs + 400, next.startMs - 50) : defaultEndMs,
      text: entry.text,
    };
  });
}

function ensureBinaryAvailable(binaryName) {
  const probe = spawnSync(binaryName, ['--version'], { stdio: 'ignore' });
  return probe.status === 0;
}

function escapeTsString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildTrackSnippet({ id, title, artist, youtubeUrl, instrumentalSrc, cues }) {
  const cueLines = cues
    .map(
      (cue) =>
        `      { id: '${escapeTsString(cue.id)}', startMs: ${cue.startMs}, endMs: ${cue.endMs}, text: '${escapeTsString(cue.text)}' },`,
    )
    .join('\n');

  return `  {\n    id: '${escapeTsString(id)}',\n    title: '${escapeTsString(title)}',\n    artist: '${escapeTsString(artist)}',\n    instrumentalSrc: '${escapeTsString(instrumentalSrc)}',\n    youtubeUrl: '${escapeTsString(youtubeUrl)}',\n    cues: [\n${cueLines}\n    ],\n  },\n`;
}

function insertSnippet(catalogText, snippet) {
  const startMarker = '// AUTO-INSERT TRACKS START';
  const endMarker = '// AUTO-INSERT TRACKS END';
  const startIndex = catalogText.indexOf(startMarker);
  const endIndex = catalogText.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Could not find track insertion markers in src/game/lyricsCatalog.generated.ts');
  }

  const before = catalogText.slice(0, startIndex + startMarker.length);
  const between = catalogText.slice(startIndex + startMarker.length, endIndex);
  const after = catalogText.slice(endIndex);

  if (between.includes(`id: '${snippet.match(/id: '([^']+)'/)?.[1] || ''}'`)) {
    throw new Error('Track id already exists in catalog. Use a different --id.');
  }

  return `${before}${between}${snippet}${after}`;
}

function run() {
  const args = parseArgs(process.argv);
  const youtube = String(args.youtube || '').trim();
  const title = String(args.title || '').trim();
  const artist = String(args.artist || 'Unknown Artist').trim();
  const lrcPath = String(args.lrc || '').trim();

  if (!youtube || !title || !lrcPath) {
    console.error(
      'Usage: node server/import-lyrics-track.mjs --youtube <url> --title "Song" --artist "Artist" --lrc ./lyrics.lrc [--id custom-id]',
    );
    process.exit(1);
  }

  if (!ensureBinaryAvailable('yt-dlp')) {
    console.error('Missing yt-dlp. Install it first, then rerun this command.');
    process.exit(1);
  }

  const absoluteLrcPath = resolve(cwd, lrcPath);
  if (!existsSync(absoluteLrcPath)) {
    console.error(`LRC file not found: ${absoluteLrcPath}`);
    process.exit(1);
  }

  const id = args.id ? slugify(String(args.id)) : slugify(`${artist}-${title}`);
  const audioDir = resolve(cwd, 'public/audio/lyrics');
  mkdirSync(audioDir, { recursive: true });

  const audioOutputPath = resolve(audioDir, `${id}.mp3`);
  const audioOutputTemplate = resolve(audioDir, `${id}.%(ext)s`);

  const download = spawnSync(
    'yt-dlp',
    ['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', audioOutputTemplate, youtube],
    { stdio: 'inherit' },
  );

  if (download.status !== 0) {
    process.exit(download.status || 1);
  }

  if (!existsSync(audioOutputPath)) {
    console.error(`Expected audio output missing: ${audioOutputPath}`);
    process.exit(1);
  }

  const lrcText = readFileSync(absoluteLrcPath, 'utf8');
  const cues = parseLrcFile(lrcText);

  if (cues.length === 0) {
    console.error('No [mm:ss.xx] lyric lines found in LRC file.');
    process.exit(1);
  }

  const catalogPath = resolve(cwd, 'src/game/lyricsCatalog.generated.ts');
  const catalogText = readFileSync(catalogPath, 'utf8');
  const snippet = buildTrackSnippet({
    id,
    title,
    artist,
    youtubeUrl: youtube,
    instrumentalSrc: `/audio/lyrics/${id}.mp3`,
    cues,
  });

  const updatedCatalog = insertSnippet(catalogText, snippet);
  writeFileSync(catalogPath, updatedCatalog);

  console.log('Imported lyrics track:');
  console.log(`- id: ${id}`);
  console.log(`- audio: ${audioOutputPath}`);
  console.log(`- cues: ${cues.length}`);
}

run();
