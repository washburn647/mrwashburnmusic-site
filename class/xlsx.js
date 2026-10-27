/* Minimal .xlsx reader: every sheet's computed values, as rows of cells.
   Enough to read the planning workbook; formulas are not evaluated, the
   values Excel or Google Sheets saved with them are used. */

import { openZip } from './zip.js';

const parse = (text) => new DOMParser().parseFromString(text, 'application/xml');
const kids = (node, name) => [...node.getElementsByTagName(name)];

/** Returns Map of sheet name -> rows, where rows[r][c] is 0-based. */
export async function readWorkbook(buffer) {
  const zip = await openZip(buffer);
  if (!zip.has('xl/workbook.xml')) throw new Error('This file is not an Excel (.xlsx) workbook.');
  const book = parse(await zip.text('xl/workbook.xml'));
  const rels = parse(await zip.text('xl/_rels/workbook.xml.rels'));
  const targets = new Map(kids(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));

  const strings = [];
  if (zip.has('xl/sharedStrings.xml')) {
    for (const si of kids(parse(await zip.text('xl/sharedStrings.xml')), 'si')) {
      // Rich text keeps its words in several runs; phonetic hints are not words.
      strings.push(kids(si, 't').filter((t) => t.parentNode.nodeName !== 'rPh').map((t) => t.textContent).join(''));
    }
  }

  const sheets = new Map();
  for (const s of kids(book, 'sheet')) {
    const id = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = targets.get(id) || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target;
    const xml = await zip.text(target);
    if (xml) sheets.set(s.getAttribute('name'), readSheet(parse(xml), strings));
  }
  return sheets;
}

function readSheet(doc, strings) {
  const rows = [];
  for (const c of kids(doc, 'c')) {
    const ref = /^([A-Z]+)(\d+)$/.exec(c.getAttribute('r') || '');
    if (!ref) continue;
    const r = Number(ref[2]) - 1;
    const col = colIndex(ref[1]);
    const t = c.getAttribute('t');
    const v = c.getElementsByTagName('v')[0];
    let value;
    if (t === 's') value = v ? strings[Number(v.textContent)] : '';
    else if (t === 'inlineStr') value = kids(c, 't').map((x) => x.textContent).join('');
    else if (t === 'str') value = v ? v.textContent : '';
    else if (t === 'b') value = v ? v.textContent === '1' : false;
    else if (t === 'e') value = '';
    else value = v ? Number(v.textContent) : '';
    if (value === '' || value == null) continue;
    (rows[r] || (rows[r] = []))[col] = value;
  }
  return rows;
}

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}
