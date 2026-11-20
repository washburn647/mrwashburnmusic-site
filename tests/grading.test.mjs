/* The quiz grader's word matching, run in Node straight from the built app.js: the
   apostrophe wildcard (movin' / moving, til' / till). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../songburner/app.js', import.meta.url), 'utf8');
const start = src.indexOf('  function normWord(w) {');
const common = src.indexOf('  var COMMON_WORDS = (function () {');
const end = src.indexOf('  })();', common) + '  })();'.length;
assert.ok(start > 0 && common > start && end > common, 'grader code found in app.js');
const ctx = {};
vm.runInNewContext(src.slice(start, end) + '\nthis.wordsMatch = wordsMatch;', ctx);
const { wordsMatch } = ctx;
const C = '’';

test("an apostrophe in the song is a wildcard: til' takes till, until, til", () => {
  for (const typed of ['till', 'until', 'til', "til'", 'Till,']) assert.ok(wordsMatch("til'", typed), typed);
  for (const typed of ['till', 'until']) assert.ok(wordsMatch("'til", typed), typed);
  assert.ok(wordsMatch('til' + C, 'till'), 'curly apostrophe');
  assert.ok(!wordsMatch("til'", 'tile'));
});

test("an apostrophe you type is a wildcard too: coming takes comin'", () => {
  assert.ok(wordsMatch('coming', "comin'"));
  assert.ok(wordsMatch('coming', 'comin' + C));
  assert.ok(wordsMatch('till', "til'"));
  assert.ok(wordsMatch('old', "ol'"));
  assert.ok(wordsMatch("comin'", 'coming'));
  assert.ok(!wordsMatch('coming', 'comin'), 'no apostrophe, no wildcard');
  assert.ok(!wordsMatch('coming', "comind'"));
  assert.ok(!wordsMatch("movin'", 'movind'));
});
