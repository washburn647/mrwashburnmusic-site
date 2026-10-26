/* The "Your data" page: back up, restore, and move in from the Sheets version. */
(function () {
  'use strict';

  var Host = window.SongBurnerHost;
  var $ = function (id) { return document.getElementById(id); };

  function show(el, cls, text) {
    el.className = 'msg ' + cls;
    el.textContent = text;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function paintStats() {
    return Host.summary().then(function (c) {
      var box = $('stats');
      box.innerHTML = '';
      [['Songs', 'songs'], ['Attempts', 'quiz and game runs'], ['Lists', 'lists']].forEach(function (p) {
        var d = document.createElement('div');
        d.className = 'stat';
        var b = document.createElement('b'); b.textContent = String(c[p[0]] || 0);
        var s = document.createElement('span'); s.textContent = p[1];
        d.appendChild(b); d.appendChild(s); box.appendChild(d);
      });
      return c;
    });
  }

  /* ---------------- download ---------------- */
  $('download').addEventListener('click', function () {
    Host.exportBackup().then(function (data) {
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      var a = document.createElement('a');
      var d = new Date();
      var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
                  String(d.getDate()).padStart(2, '0');
      a.href = URL.createObjectURL(blob);
      a.download = 'songburner-backup-' + stamp + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      show($('downloadMsg'), 'ok', 'Saved ' + a.download + '.');
    }).catch(function (e) { show($('downloadMsg'), 'bad', e.message || String(e)); });
  });

  /* ---------------- reading an .xlsx ----------------
     Just enough of the format to read what Google Sheets writes: unzip with the
     browser's own DecompressionStream, then read each sheet's cells as values. */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function unzip(buf) {
    var b = new Uint8Array(buf);
    var eocd = -1;
    for (var i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
      if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('That file is not an .xlsx (no zip directory found).');
    var count = u16(b, eocd + 10), at = u32(b, eocd + 16), files = {};
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (u32(b, at) !== 0x02014b50) throw new Error('That .xlsx is damaged.');
      var method = u16(b, at + 10), csize = u32(b, at + 20);
      var nlen = u16(b, at + 28), xlen = u16(b, at + 30), clen = u16(b, at + 32);
      var local = u32(b, at + 42);
      var name = dec.decode(b.subarray(at + 46, at + 46 + nlen));
      var start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
      files[name] = { method: method, data: b.subarray(start, start + csize) };
      at += 46 + nlen + xlen + clen;
    }
    return files;
  }

  function inflate(entry) {
    if (entry.method === 0) return Promise.resolve(new TextDecoder().decode(entry.data));
    if (entry.method !== 8) return Promise.reject(new Error('Unsupported compression in .xlsx.'));
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('This browser is too old to read .xlsx files. Try a current Chrome, Safari, Edge or Firefox.'));
    }
    var stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  function xml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  function kids(node, tag) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) if (c.localName === tag) out.push(c);
    return out;
  }
  function textOf(node) {
    // a shared string is either <t> or a run of <r><t> pieces; skip phonetic <rPh>
    var s = '';
    for (var c = node.firstChild; c; c = c.nextSibling) {
      if (c.localName === 't') s += c.textContent;
      else if (c.localName === 'r') s += textOf(c);
    }
    return s;
  }
  function colIndex(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var ch = ref.charCodeAt(i);
      if (ch < 65 || ch > 90) break;
      n = n * 26 + (ch - 64);
    }
    return n - 1;
  }
  function rowIndex(ref) { return parseInt(ref.replace(/^[A-Z]+/, ''), 10) - 1; }

  function readXlsx(buf) {
    var files = unzip(buf);
    function get(name) {
      if (!files[name]) return Promise.resolve(null);
      return inflate(files[name]);
    }
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'),
                        get('xl/sharedStrings.xml')]).then(function (r) {
      if (!r[0] || !r[1]) throw new Error('That .xlsx has no workbook inside it.');
      var wb = xml(r[0]), rels = xml(r[1]);
      var shared = r[2] ? kids(xml(r[2]).documentElement, 'si').map(textOf) : [];
      var target = {};
      kids(rels.documentElement, 'Relationship').forEach(function (x) {
        target[x.getAttribute('Id')] = x.getAttribute('Target');
      });
      var sheets = [];
      var all = wb.getElementsByTagNameNS('*', 'sheet');
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        var rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
                  s.getAttribute('r:id');
        var t = String(target[rid] || '').replace(/^\/?xl\//, '').replace(/^\//, '');
        sheets.push({ name: s.getAttribute('name'), path: 'xl/' + t });
      }
      return Promise.all(sheets.map(function (s) {
        return get(s.path).then(function (text) {
          var rows = [];
          if (!text) return { name: s.name, rows: rows };
          var cells = xml(text).getElementsByTagNameNS('*', 'c');
          for (var k = 0; k < cells.length; k++) {
            var c = cells[k], ref = c.getAttribute('r'), type = c.getAttribute('t') || 'n';
            var v = kids(c, 'v')[0], val = '';
            if (type === 's') val = v ? shared[parseInt(v.textContent, 10)] : '';
            else if (type === 'inlineStr') { var is = kids(c, 'is')[0]; val = is ? textOf(is) : ''; }
            else if (type === 'b') val = v ? v.textContent === '1' : '';
            else if (type === 'str' || type === 'e') val = v ? v.textContent : '';
            else val = v && v.textContent !== '' ? Number(v.textContent) : '';
            var ri = rowIndex(ref), ci = colIndex(ref);
            while (rows.length <= ri) rows.push([]);
            var row = rows[ri];
            while (row.length < ci) row.push('');
            row[ci] = val;
          }
          return { name: s.name, rows: rows };
        });
      }));
    }).then(function (list) {
      var tabs = {};
      list.forEach(function (s) { tabs[s.name] = s.rows; });
      return tabs;
    });
  }

  /* ---------------- restore ---------------- */
  var pending = null;

  function describe(tabs) {
    var songs = Math.max(0, (tabs.Songs || []).filter(function (r) { return r && r[0] !== '' && r[0] !== undefined; }).length - 1);
    var runs = Math.max(0, (tabs.Attempts || []).filter(function (r) { return r && r[0] !== '' && r[0] !== undefined; }).length - 1);
    return plural(songs, 'song', 'songs') + ' and ' + plural(runs, 'run', 'runs');
  }

  function doRestore(tabs) {
    var box = $('restoreMsg');
    show(box, 'ok', 'Restoring…');
    Host.restoreTabs(tabs).then(function () {
      return paintStats();
    }).then(function (c) {
      box.className = 'msg ok';
      box.textContent = 'Done. This device now has ' + plural(c.Songs || 0, 'song', 'songs') + '. ';
      var a = document.createElement('a');
      a.href = '../'; a.textContent = 'Open Song Burner';
      box.appendChild(a);
    }).catch(function (e) { show(box, 'bad', e.message || String(e)); });
  }

  $('file').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    var box = $('restoreMsg');
    show(box, 'ok', 'Reading ' + f.name + '…');
    var isXlsx = /\.xlsx$/i.test(f.name);
    f.arrayBuffer().then(function (buf) {
      if (isXlsx) return readXlsx(buf);
      var data;
      try { data = JSON.parse(new TextDecoder().decode(buf)); }
      catch (e) { throw new Error('That file is not a Song Burner backup.'); }
      if (!data || data.kind !== 'songburner-backup' || !data.tabs) {
        throw new Error('That file is not a Song Burner backup.');
      }
      return data.tabs;
    }).then(function (tabs) {
      ['Songs', 'Attempts', 'Lists', 'Meta'].forEach(function (t) {
        if (!tabs[t]) throw new Error('That file has no "' + t + '" tab, so it is not a Song Burner library.');
      });
      return Host.summary().then(function (now) {
        if (!(now.Songs > 0) && !(now.Attempts > 0)) return doRestore(tabs);
        // Something is already here: say what will be lost, and ask.
        pending = tabs;
        box.className = 'msg ask';
        box.textContent = f.name + ' has ' + describe(tabs) + '. Restoring it replaces everything on this device (' +
          plural(now.Songs || 0, 'song', 'songs') + ' and ' + plural(now.Attempts || 0, 'run', 'runs') +
          '). Download a backup first if you might want them.';
        var row = document.createElement('div'); row.className = 'row';
        var yes = document.createElement('button'); yes.className = 'danger'; yes.textContent = 'Replace everything';
        var no = document.createElement('button'); no.className = 'plain'; no.textContent = 'Cancel';
        yes.onclick = function () { var t = pending; pending = null; doRestore(t); };
        no.onclick = function () { pending = null; box.className = 'msg'; };
        row.appendChild(yes); row.appendChild(no); box.appendChild(row);
      });
    }).catch(function (e) { show(box, 'bad', e.message || String(e)); });
  });

  Host.ready.then(paintStats).catch(function (e) {
    show($('downloadMsg'), 'bad', 'Could not open storage on this device: ' + (e.message || e));
  });
})();
