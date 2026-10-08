#!/usr/bin/env node
// Make a consistent copy of a live SQLite database, including committed WAL data.
// The source database is opened read-only. Copy this script to /tmp in a site pod
// if it is not yet part of the deployed image.
const fs = require('node:fs');
const path = require('node:path');

let sqlite3;
try { sqlite3 = require('sqlite3'); }
catch { sqlite3 = require('/app/node_modules/sqlite3'); }

const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) {
  console.error('Usage: node backup-sqlite.cjs SOURCE.sqlite DESTINATION.sqlite');
  process.exit(2);
}
const source = path.resolve(sourceArg);
const destination = path.resolve(destinationArg);
if (source === destination || !fs.existsSync(source) || fs.existsSync(destination)) {
  console.error('Source must exist, and destination must be a new, different file.');
  process.exit(2);
}

const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY, error => {
  if (error) fail(error);
});
let backup;
let retries = 0;

function fail(error) {
  console.error(`SQLite backup failed: ${error.message}`);
  process.exitCode = 1;
  setImmediate(() => db.close(() => {}));
}

backup = db.backup(destination, error => {
  if (error) return fail(error);
  step();
});

function step() {
  backup.step(256, (error, done) => {
    if (error) {
      if ((error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') && retries++ < 30) {
        return setTimeout(step, 100);
      }
      return fail(error);
    }
    if (!done) return setImmediate(step);
    // The native binding releases its backup handle after the callback returns.
    setImmediate(() => db.close(closeError => {
      if (closeError) return fail(closeError);
      console.log(`Backup complete: ${destination}`);
    }));
  });
}
