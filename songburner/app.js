/* GENERATED from src/Code.gs by tools/build_songburner.py. Do not edit. */
(function () {
  'use strict';

  var NL = String.fromCharCode(10);
  var TAB = String.fromCharCode(9);
  var NBSP = String.fromCharCode(160);

  /* ---------- tiny helpers, all regex-free on purpose ---------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .split('&').join('&amp;').split('<').join('&lt;')
      .split('>').join('&gt;').split('"').join('&quot;');
  }
  /* ============================================================
     The heatmap, page side
     ------------------------------------------------------------
     The server holds the standings and does all the arithmetic. What lives
     here is the ADDRESS SPACE - real sections, their non-empty lines, the
     words in them - and the reading of a standing as ink on the page.

     THE PAGE OWNS THE ADDRESSES. Every observation is {s, l, w, ok} against
     that space, and the server grows its blob to fit whatever arrives, so the
     two never have to agree in advance about how many words a line holds.
     ============================================================ */

  /** Which calendar day it is, counted exactly as the server counts it. */
  function todayIndex() {
    var d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  /**
   * How much a standing is still worth as a claim about you today. Halves
   * every fade days (a dial). Never observed at all is worth nothing - which
   * is why an untested song paints as blank paper.
   */
  function heatFreshness(lastDay) {
    if (!lastDay) return 0;
    var fade = (S.settings && S.settings.fade) ? Number(S.settings.fade) : 90;
    var days = todayIndex() - Number(lastDay);
    if (!(days > 0)) return 1;
    return Math.pow(0.5, days / Math.max(1, fade));
  }

  /**
   * Ink for one standing.
   *
   * THERE IS NO OBSERVATION-COUNT TERM, deliberately. The first draft scaled
   * the tint by how many times an item had been seen as well, and a word you
   * had just got wrong then painted at under four percent - invisible - so the
   * map stayed blank through two whole quizzes. It was double-counting: the
   * standing ALREADY carries how much evidence there is, because repeated
   * misses drive it down. And it was not what hid untested items either; they
   * sit at 100, and 100 has no weakness, so they paint nothing regardless.
   */
  function heatAlpha(cell, lastDay, maxAlpha) {
    if (!cell) return 0;
    var weak = (100 - Number(cell[0])) / 100;
    if (!(weak > 0)) return 0;
    var a = weak * heatFreshness(lastDay) * maxAlpha;
    return a > 0.005 ? a : 0;
  }

  /* One blue, at the weak end only. Solid material is clean paper - there is
     no strong end to paint, because a page that colours what you already know
     is a page you have to read past. */
  function heatInk(a) { return 'rgba(52,88,142,' + a.toFixed(3) + ')'; }
  var HEAT_MAX_VERSE = 0.08, HEAT_MAX_LINE = 0.16, HEAT_MAX_WORD = 0.32;

  /**
   * One lyric line as HTML, tinted word by word when the map is on.
   *
   * Plain escaped text when it is off, byte for byte as before - the default
   * view of a song should not be carrying a hundred spans it never uses. The
   * split goes through the same words() every grader and mask uses, so the
   * word the tint lands on is the word that was tested.
   */
  function heatLineHtml(text, lineCell, wordCells) {
    if (!wordCells || !wordCells.length) return esc(text);
    var ws = words(text), out = [];
    for (var i = 0; i < ws.length; i++) {
      var a = heatAlpha(wordCells[i], lineCell ? lineCell[2] : 0, HEAT_MAX_WORD);
      out.push(a
        ? '<span class="heat-word" style="background:' + heatInk(a) + '">' +
          esc(ws[i]) + '</span>'
        : esc(ws[i]));
    }
    return out.join(' ');
  }

  /** The standings for one real section, or null if there are none yet. */
  function heatSection(song, realIdx) {
    var h = song && song.heat;
    if (!h || !h.sections || realIdx < 0) return null;
    return h.sections[realIdx] || null;
  }

  /**
   * Raw index in song.sections -> index in the heat address space, which
   * counts only real sections. Mirrors realSections, and both of them must
   * keep mirroring typableLines or every address in the song shifts by one.
   */
  function heatIndexMap(song) {
    var map = {}, n = 0;
    for (var i = 0; i < (song.sections || []).length; i++) {
      var sec = song.sections[i];
      if (!sec || sec.type === 'marker') continue;
      if (!typableLines(sec).length) continue;
      map[i] = n++;
    }
    return map;
  }

  /**
   * What the line under the toggle says: how much of this song has actually
   * been tested, and which verse is weakest.
   *
   * The weakest verse is NAMED rather than shaded because a verse's standing
   * is a share of its words, and shares are rarely extreme - miss fifteen
   * words of twenty-eight and the verse still only reaches 61 after three
   * runs, which is about three percent of ink. Ranking works from the very
   * first quiz, because ranking is scale-free.
   */
  function heatSummary(song) {
    var map = heatIndexMap(song), labels = labelSections(song.sections);
    var total = 0, seen = 0, worst = null, worstAt = -1;
    for (var i = 0; i < (song.sections || []).length; i++) {
      if (map[i] === undefined) continue;
      var lines = typableLines(song.sections[i]);
      var hs = heatSection(song, map[i]);
      for (var j = 0; j < lines.length; j++) {
        var ws = words(lines[j].t);
        total += ws.length;
        var row = (hs && hs.words && hs.words[j]) ? hs.words[j] : null;
        for (var k = 0; k < ws.length; k++) {
          if (row && row[k] && Number(row[k][1]) > 0) seen++;
        }
      }
      if (hs && hs.verse && Number(hs.verse[1]) > 0) {
        if (worst === null || Number(hs.verse[0]) < worst) {
          worst = Number(hs.verse[0]);
          worstAt = i;
        }
      }
    }
    return { total: total, seen: seen,
             worst: (worstAt >= 0 && worst < 100) ? labels[worstAt] : '' };
  }

  /**
   * The words of a line, for masking, grading and the heatmap alike.
   *
   * A TOKEN WITH NO LETTERS IN IT IS NOT A WORD - 1.52. A songbook line can
   * carry a mark standing on its own: a dash between two thoughts, a stray
   * question mark, an ellipsis. Those were coming through as words, which meant
   * the quiz counted them in the total, waited for you to type them, and marked
   * the line short when you did not. You cannot type a word that is not one,
   * so it was an unanswerable question worth a real fraction of a verse.
   *
   * It is dropped HERE, in the one splitter every part of the app shares,
   * rather than in the grader - the mask, the grade and the heat address space
   * have to agree about how many words a line has, and three places filtering
   * separately is three places to forget to.
   */
  function words(line) {
    var parts = String(line || '').split(TAB).join(' ').split(' ');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      /* isLetterCode, NOT normWord. normWord keeps a-z and 0-9 only, so a word
         written entirely in accented letters would normalise to nothing and be
         thrown out as punctuation - which is a far worse bug than the one this
         filter is here to fix. isLetterCode is the app's actual reading of
         "this is a letter", accents included. */
      if (!hasLetter(parts[i])) continue;        // punctuation standing alone
      out.push(parts[i]);
    }
    return out;
  }
  /** Does this token carry a letter or a digit at all? */
  function hasLetter(w) {
    var t = String(w || '');
    for (var i = 0; i < t.length; i++) if (isLetterCode(t.charCodeAt(i))) return true;
    return false;
  }
  function normWord(w) {
    var s = String(w || '').toLowerCase(), out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if ((c >= 48 && c <= 57) || (c >= 97 && c <= 122)) out += s.charAt(i);
    }
    return out;
  }
  /* Everything above ASCII used to count as a letter, "to keep accented
     letters". It also kept every curly mark a word processor makes - and the
     songbook comes out of Google Docs, so nearly every apostrophe and quote in
     it is curly. That is where the punctuation was creeping into the quizzes:
     a straight apostrophe was dropped from the mask and a curly one drew an
     underscore, so the same word blanked out to two different shapes. The
     accented letters still pass; the marks are named and excluded. */
  var HIGH_PUNCT = {};
  (function () {
    var codes = [8216, 8217, 8218, 8219,        // curly single quotes
                 8220, 8221, 8222, 8223,        // curly double quotes
                 8208, 8209, 8210, 8211, 8212, 8213,   // hyphens and dashes
                 8226, 8230, 8231, 8242, 8243,  // bullet, ellipsis, primes
                 171, 187, 183, 8194, 8195, 8201, 8203];
    for (var i = 0; i < codes.length; i++) HIGH_PUNCT[codes[i]] = true;
  })();
  function isLetterCode(c) {
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return true;
    return c > 127 && !HIGH_PUNCT[c];            // keep accented letters
  }

  /* An apostrophe is part of the word - don't, walkin', 'em - and every other
     mark sits beside it. Both shapes of single quote count, because the
     songbook writes the same sound either way. */
  var APOS_S = String.fromCharCode(39), APOS_C = String.fromCharCode(8217),
      APOS_O = String.fromCharCode(8216);
  function isApos(ch) {
    return ch === APOS_S || ch === APOS_C || ch === APOS_O;
  }
  /**
   * A word split into the marks in front of it, the word itself, and the marks
   * behind it - ONE pass, so the three can never disagree about where the word
   * starts and the board can print what the chip does not carry.
   *
   * The whole difficulty is that an apostrophe is sometimes a mark and
   * sometimes a letter, and only its neighbour says which:
   *
   *   'em  'til  '79    a mark with a letter BEHIND it opens an elision, so it
   *                     stays on the word
   *   ol'  walkin'      a mark with a letter IN FRONT of it closes one, same
   *   "Hello,"          quotes and a comma, nothing next to a letter, all go
   *   'Hello,'          the closing quote has a comma in front, not a letter,
   *                     so it goes - and its partner goes with it
   *
   * Interior marks are never touched, so don't survives intact. Stripping
   * those was what handed you "dont" as an opening word.
   */
  function splitWord(w) {
    var s = String(w || ''), a = 0, b = s.length, ch;
    while (a < b) {
      if (isLetterCode(s.charCodeAt(a))) break;
      if (isApos(s.charAt(a)) && a + 1 < b && isLetterCode(s.charCodeAt(a + 1))) break;
      a++;
    }
    while (b > a) {
      ch = s.charAt(b - 1);
      if (isLetterCode(ch.charCodeAt(0))) break;
      if (isApos(ch) && b - 2 >= a && isLetterCode(s.charCodeAt(b - 2))) break;
      b--;
    }
    return { lead: s.slice(0, a), core: s.slice(a, b), trail: s.slice(b) };
  }
  function bareWord(w) { return splitWord(w).core; }
  function leadPunct(w) { return splitWord(w).lead; }
  function trailPunct(w) { return splitWord(w).trail; }

  /**
   * THE ELIDED-WORD WILDCARD.
   *
   * A songbook writes "ol' devil" and "walkin' home", and what you type back is
   * whatever you sing. Normalising both sides already makes ol and ol' the same
   * thing, since the apostrophe is stripped either way - but "old" is a
   * different string and used to be marked wrong, which is the one thing a
   * memory quiz must never do to a right answer.
   *
   * An apostrophe on the OUTSIDE of the song's word is a wildcard for the
   * letters it stands in for - left out, or filled in, and either is right:
   *   movin' -> movin, moving  |  ol' -> ol, old  |  'bout -> bout, about
   *
   * FILLED IN WITH THE RIGHT LETTERS, NOT ANY LETTERS - 1.64. Until then the
   * end apostrophe took any one letter, so movin' accepted movind and movinz,
   * which are not words anybody sings. What may go back is read off the word:
   *   ...in'  -> g          the whole of the dropped-g family
   *   ...n' ...l'  -> d     an' and, ol' old, roun' round, tol' told
   *   ...s' ...f' ...p' ...c' ...k'  -> t     jus' just, lef' left, kep' kept
   *   and a handful of whole words that follow none of that - o' of, th' the
   * The front apostrophe is a short table ('em them, 'til until, 'cause
   * because), plus a or be on the front when that makes a common word - 'live,
   * 'side, 'fore.
   *
   * INTERIOR MARKS ARE NEVER WILDCARDS. couldn't is couldn't or couldnt, and
   * couldnxt is wrong; splitWord keeps those apostrophes inside the core and
   * only the two ends are ever read here.
   *
   * It only ever loosens a word the song itself wrote with a letter dropped, so
   * nothing else in the library gets easier. It is deliberately one-way: the
   * song says ol', you may sing old. If the song says old, ol is still wrong,
   * because there the full word is what is written.
   */
  var ELIDE_TAIL_WORDS = {
    o: ['f', 'n'], th: ['e'], tha: ['t'], yo: ['u'], fo: ['r'], wit: ['h'],
    don: ['t'], an: ['d'], n: ['d']
  };
  var ELIDE_HEAD_WORDS = {
    em: ['th'], til: ['un'], cause: ['be'], cuz: ['be'], neath: ['be'],
    fore: ['be'], tween: ['be'], twixt: ['be'], cept: ['ex'], scuse: ['ex'],
    nuff: ['e'], specially: ['e'], kay: ['o'], n: ['a'],
    bout: ['a'], round: ['a'], gainst: ['a'], long: ['a'], way: ['a'],
    cross: ['a'], lone: ['a'], mongst: ['a'], mid: ['a'], gain: ['a']
  };
  function elideTail(a) {
    if (ELIDE_TAIL_WORDS[a]) return ELIDE_TAIL_WORDS[a];
    var e = a.charAt(a.length - 1);
    if (a.slice(-2) === 'in') return ['g'];
    if (e === 'n' || e === 'l') return ['d'];
    if ('sfpck'.indexOf(e) !== -1) return ['t'];
    return [];
  }
  function elideHead(a) {
    return ELIDE_HEAD_WORDS[a] || [];
  }
  function wordsMatch(actual, typed) {
    var a = normWord(actual), b = normWord(typed);
    if (a === b) return true;
    if (!a || !b) return false;
    var raw = bareWord(actual);
    var openA = isApos(raw.charAt(0));
    var closeA = raw.length > 1 && isApos(raw.charAt(raw.length - 1));
    if (!openA && !closeA) return false;
    var heads = [''].concat(openA ? elideHead(a) : []);
    var tails = [''].concat(closeA ? elideTail(a) : []);
    for (var h = 0; h < heads.length; h++) {
      for (var t = 0; t < tails.length; t++) {
        if (heads[h] + a + tails[t] === b) return true;
      }
    }
    if (openA && COMMON_WORDS[b] && (b === 'a' + a || b === 'be' + a)) return true;
    return false;
  }
  /* ============================================================
     The quiz spellchecker
     ============================================================

     WHY IT EXISTS. The grader compares words, and a word with one letter out of
     place is a word you got wrong. That is the right call for a memory test and
     the wrong one for a keyboard: 99.9% on a long song because a thumb landed
     between two keys is a measurement of the phone, not of the song. So there is
     a button on the grade bar that marks the typos BEFORE the run is scored, and
     you fix them yourself.

     WHAT MAKES A WORD A TYPO. Three tests, and a word has to fail all three:

       1. It is not a word this song uses. The song is the dictionary, so every
          odd spelling the songbook actually writes - a dialect form, a made-up
          word, a name, an elision - is correct by definition and can never be
          marked. Checked against the WHOLE song rather than the line, so a word
          borrowed from the wrong verse is a wrong answer and not a misspelling.

       2. It is not a common English word. This is the test that keeps the
          checker honest: writing "the" where the song says "she" is a wrong
          word, not a misspelled one, and marking it would turn the button into
          a hint. A real word stays unmarked however wrong it is.

       3. It is within a typo of a word on the line you typed it on. This is what
          makes the mark mean something rather than just "I do not know that
          word". Transpositions count as ONE edit, not two, because swapping two
          letters is the single most common way a typed word goes wrong - plain
          edit distance calls hse/she two mistakes and would have missed exactly
          the case this was built for.

     WHAT IT DELIBERATELY DOES NOT DO: name the word it thinks you meant. The
     mark says "this is not a word", which is all you need to find your own
     mistake, and it is the most the app can say without answering the question
     for you. A suggestion would make every near-miss a free letter-by-letter
     probe of the lyrics, and the ladder is the hint system.

     It runs entirely on the page. No dictionary is fetched and nothing is sent
     to the server - the song is already here and the common list is below. */

  /**
   * THE COMMON-WORD GUARD - rule 2 above, and the only part of this that is a
   * list rather than a rule.
   *
   * About fourteen hundred words: the frequent English vocabulary plus the
   * words lyrics actually lean on. It does not have to be a dictionary, because
   * the song supplies its own and this list only has to catch the REAL word
   * typed in the wrong place. Those are overwhelmingly short and common ones -
   * your/youre, hear/here, mine/mind - and a near-neighbour that is genuinely
   * rare is a wrong answer nobody would mistake for a slip of the thumb.
   *
   * Stored normWord-shaped - lowercase, no apostrophes - because that is the
   * form every lookup arrives in. dont, youre and aint are the words here; the
   * apostrophe is gone before the list is ever consulted.
   */
  var COMMON_WORDS = (function () {
    var raw =
      'a about above across afraid after afternoon again against age ages ah aint ' +
      'alive all almost alone along also although always am among an and angel ' +
      'angels anger angry another any anybody anyhow anymore anyone anything ' +
      'anyway apart are arm arms around as ask asked asking asks at ate awake ' +
      'babies baby back backs bad be beach bear bearing bears beat beating beats ' +
      'beautiful became because become becomes becoming bed beds been before ' +
      'began begin beginning begins begun behind being believe believed believes ' +
      'believing below bend bending bends bent beside besides best bet bets ' +
      'better between beyond big bigger bitter black bled bleed bleeding bleeds ' +
      'blew blind blood blow blowing blown blows blue boat boats bodies body bone ' +
      'bones bore born borne both bottle bottom bought boy boys brave break ' +
      'breaking breaks breath breathe breathed breathes breathing breaths bridge ' +
      'bright brighter bring bringing brings broke broken brother brothers ' +
      'brought brown build building builds built buried buries burn burned ' +
      'burning burns burnt bury burying bus but buy buying buys by bye call ' +
      'called calling calls came can candle cant car carried carries carry ' +
      'carrying cars catch catches catching caught certain chain chains chair ' +
      'change changed changes changing child children choose chooses choosing ' +
      'chose chosen cities city clean clear climb climbed climbing climbs close ' +
      'closed closer closes closing cloud clouds cloudy cold come comes coming ' +
      'cool corner cos cost costs could couldnt count counted counting country ' +
      'counts crawl crawling crawls crazy cried cries crooked cry crying cup cut ' +
      'cuts cutting cuz dad daddy dance danced dances dancing danger dangerous ' +
      'dark darker darkness daughter daughters day days dead deaf death deep ' +
      'deeper devil diamond diamonds did didnt die died dies different dirty do ' +
      'does doesnt doing dollar dollars done dont door doors down drank draw ' +
      'drawing drawn draws dream dreamed dreaming dreams dreamt drew drift ' +
      'drifted drifting drifts drink drinking drinks drive driven drives driving ' +
      'drop dropped dropping drops drove drunk dry dull during dying each early ' +
      'earth easier easy eat eaten eating eats edge edges eight either eleven ' +
      'else empty end ended ending ends enemies enemy enough even evening ever ' +
      'every everybody everyone everything eye eyes face faces fade faded fades ' +
      'fading fail failed failing fails faith fake fall fallen falling falls ' +
      'false families family far fast faster father fear fears feel feeling ' +
      'feelings feels feet fell felt few field fields fifty fight fighting fights ' +
      'final find finding finds finger fingers fire fires first five fix fixed ' +
      'fixes fixing flame flames flew flies float floating floats floor floors ' +
      'flower flowers flown fly flying folks follow followed following follows ' +
      'foot for forest forever forget forgets forgetting forgot forgotten forty ' +
      'fought found four free freedom friend friends from full gate gave get gets ' +
      'getting ghost ghosts gimme girl girls give given gives giving glad glass ' +
      'go god goes going gold golden gone gonna good goodbye got gotta gotten ' +
      'grass gray green grew grey grief ground grow growing grown grows had hadnt ' +
      'hair half hand hands handsome hang hanging hangs happen happened happening ' +
      'happens happy hard harder has hasnt hate hated hates hating have havent ' +
      'having he head heads heal healed healing heals hear heard hearing hears ' +
      'heart hearts heaven heavens heavy held hell hello help helped helping ' +
      'helps hence her hers herself hey hi hid hidden hide hides hiding high ' +
      'higher hill hills him himself his hit hits hitting hold holding holds home ' +
      'homes hope hoped hopes hoping hot hour hours house houses how however hug ' +
      'huge hugs huh hundred hung hunt hunts hurries hurry hurt hurting hurts i ' +
      'ice id if ill im in into is it its itself ive joy jump jumped jumping ' +
      'jumps just keep keeping keeps kept kid kids kill killed killing kills kind ' +
      'kinda king kings kiss kissed kisses kissing knee knees knew know knowing ' +
      'known knows laid lake lakes lamp land lands large last late later laugh ' +
      'laughed laughing laughs lay lead leading leads leaf learn learned learning ' +
      'learns least leave leaves leaving led left leg legs lemme less let lets ' +
      'letting lie lies life light lighter lightning lights like line lines lip ' +
      'lips listen listened listening listens little live lived lives living ' +
      'lonely lonesome long longer look looked looking looks lord lose loses ' +
      'losing lost lot lots loud love loved lovely lover lovers loves loving low ' +
      'lower lying mad made make makes making mama man many matter mattered ' +
      'matters may maybe me mean meaning means meant meet meeting meets melody ' +
      'melt melting melts memories memory men met middle midnight might million ' +
      'mind minds mine minute minutes mirror miss missed misses missing mom ' +
      'moment moments money month months moon moons more morning most mother ' +
      'mountain mountains mouth move moved moves moving much music must mustnt my ' +
      'myself nah name named names naming narrow near nearer nearly need needed ' +
      'needs neither never new newer next night nights nine no nobody noise none ' +
      'noon nope nor not nothing nowhere numb ocean oceans of off often oh ok ' +
      'okay old older on once one only onto oops open opened opening opens or ' +
      'orange other others our ours ourselves out over own paid pain papa part ' +
      'parts pass passed passes passing past path paths pay paying pays peace ' +
      'penny people perhaps person piece pieces pink place places plane play ' +
      'played playing plays please poor pray prayed praying prays pretty pride ' +
      'pull pulled pulling pulls purple push pushed pushes pushing put puts ' +
      'putting queen queens quick quiet quite rage rain rained raining rains ran ' +
      'rang rather reach reached reaches reaching read reading reads real really ' +
      'reason reasons receive receives red remain remains remember remembered ' +
      'remembering remembers rest rested resting rests return returned returns ' +
      'rhythm rich ridden ride rides riding right ring ringing rings rise risen ' +
      'rises rising river rivers road roads rock rocking rocks rode roof room ' +
      'rooms rose roses ruin ruined ruins run rung running runs sad safe said ' +
      'same sand sang sank sat save saved saves saving saw say saying says scared ' +
      'scream screamed screaming screams sea seas second seconds see seeing seem ' +
      'seemed seems seen sees sell selling sells send sending sends sent set sets ' +
      'setting seven shake shaken shakes shaking shall shallow shame sharp she ' +
      'shine shines shining ship ships shone shook shore short shorter should ' +
      'shoulder shoulders shouldnt shout shouted shouting shouts show showed ' +
      'showing shown shows shut shuts shutting side sides sigh sighs silence ' +
      'silver since sing singing sings sink sinking sinks sister sisters sit sits ' +
      'sitting six skies skin sky sleep sleeping sleeps sleepy slept slip slipped ' +
      'slipping slips slow slower small smaller smile smiled smiles smiling smoke ' +
      'snow snows so soft sold some somebody someone something sometimes son song ' +
      'songs sons soon sorrow sorry sort sorta soul souls sound sounded sounding ' +
      'sounds sour space speak speaking speaks spend spending spends spent spin ' +
      'spinning spins spoke spoken spun stand standing stands star stare stared ' +
      'stares staring stars start started starting starts stay stayed staying ' +
      'stays steal stealing steals still stole stolen stood stop stopped stopping ' +
      'stops stories storm storms story straight stranger strangers stream ' +
      'streams street streets strong stronger such sun sung suns sure swear ' +
      'swears sweet swing swinging swings swore sworn swung table take taken ' +
      'takes taking talk talked talking talks tall taught teach teaches teaching ' +
      'tear tearing tears tell telling tells ten than thank thanks that the their ' +
      'theirs them then there these they theyre thick thin thing things think ' +
      'thinking thinks third thirty this those though thought thousand three ' +
      'threw through throw throwing thrown throws thunder thus till time times ' +
      'tiny tired to today together told tomorrow tonight too took top tore torn ' +
      'touch touched touches touching toward towards town towns train trains tree ' +
      'trees tried tries true truth truths try trying tune turn turned turning ' +
      'turns twelve twenty twice two type ugly uh um under unless unlike until up ' +
      'upon us use used uses using valley very village voice voices wait waited ' +
      'waiting waits wake wakes waking walk walked walking walks wall walls ' +
      'wander wandered wandering wanders wanna want wanted wanting wants war warm ' +
      'wars was wash washed washes washing wasnt waste wasted wastes watch ' +
      'watched watches watching water waters wave waved waves waving way ways we ' +
      'weak weaker wear wearing wears wed week weeks well went were werent wet ' +
      'weve what whatever when whenever where wherever which while whisper ' +
      'whispered whispering whispers white who whoa whoever whole whom whose why ' +
      'wide wild will win wind window windows winds winning wins wish wished ' +
      'wishes wishing with within without woke woken woman women won wonder ' +
      'wondered wondering wonders wont woods word words wore work worked working ' +
      'works world worlds worn worse worst would wouldnt wow write writes writing ' +
      'written wrong wrote yall yea yeah year years yellow yep yes yesterday yet ' +
      'you youd youll young younger your youre yours yourself yourselves youve';
    var out = {}, list = raw.split(' ');
    for (var i = 0; i < list.length; i++) if (list[i]) out[list[i]] = true;
    return out;
  })();

  /**
   * EDIT DISTANCE WITH TRANSPOSITIONS, bounded.
   *
   * Optimal string alignment rather than plain Levenshtein, because the typo
   * this whole feature was built for is a transposition: hse for she, teh for
   * the, adn for and. Plain edit distance scores those as two substitutions,
   * which puts them outside any threshold tight enough to be trustworthy, and
   * the checker would have been blind to the commonest typo there is.
   *
   * Bounded because the answer is never wanted, only whether it is small. The
   * row minimum bails out the moment the whole row is past the cap, and a
   * length difference bigger than the cap needs no table at all - which matters
   * when this runs over every typed word against every word on its line.
   */
  function typoDistance(a, b, cap) {
    var la = a.length, lb = b.length, i, j;
    if (Math.abs(la - lb) > cap) return cap + 1;
    if (!la) return lb;
    if (!lb) return la;
    var prev2 = [], prev = [], cur;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= lb; j++) {
        var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        /* The transposition arm: two adjacent letters swapped, charged once. */
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) &&
            a.charAt(i - 2) === b.charAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > cap) return cap + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }

  /**
   * How far off a word is still allowed to be a typo, by length.
   *
   * One edit on a short word and two on a long one. A short word has too few
   * letters for two edits to mean anything - at three letters, two edits
   * reaches most of the alphabet, and the mark would be noise. A long word can
   * lose a doubled letter and gain a wrong vowel in the same breath and still
   * obviously be the word you meant.
   */
  function typoAllowance(n) { return n >= 7 ? 2 : 1; }

  /**
   * EVERY WORD THIS SONG USES, normalised, as a lookup - rule 1 above.
   *
   * The whole song, not the section and not the line. A word is correctly spelt
   * if the songbook spells it that way ANYWHERE, and a spellchecker that did
   * not know that would mark the songbook wrong - which is the one thing it has
   * no standing to do.
   *
   * Split through words() and normWord so it agrees with the grader about what
   * a word is. Built once per quiz and carried on the lines, because a song is
   * a few hundred words and this runs against every one of them.
   */
  function songVocab(song) {
    var v = {}, secs = (song && song.sections) || [];
    for (var i = 0; i < secs.length; i++) {
      var lines = secs[i].lines || [];
      for (var j = 0; j < lines.length; j++) {
        var ws = words(lines[j].t || '');
        for (var k = 0; k < ws.length; k++) {
          var n = normWord(ws[k]);
          if (n) v[n] = true;
        }
      }
    }
    return v;
  }

  /**
   * Which of the tokens on one typed line look like typos.
   *
   * Returns a flag per token of typed.split(SPACE) - positional, so the caller
   * can rebuild the line it was handed without having to agree with this
   * function about anything but the split. Punctuation is taken off with
   * bareWord before the tests and the token is still marked whole, because the
   * mark is there to be SEEN and half a word underlined reads as a smudge.
   *
   * Two-letter words are never marked. There is not enough of a word there to
   * tell a typo from a different word, and at that length the common list
   * cannot be complete enough to be trusted either.
   */
  function spellFlags(typed, actual, vocab) {
    var parts = String(typed || '').split(' '), flags = [];
    var aw = words(actual), targets = [];
    for (var t = 0; t < aw.length; t++) {
      var an = normWord(aw[t]);
      if (an) targets.push(an);
    }
    for (var i = 0; i < parts.length; i++) {
      flags.push(false);
      var tok = parts[i];
      if (!tok || !hasLetter(tok)) continue;
      var w = normWord(bareWord(tok));
      if (w.length < 3) continue;
      if (vocab[w]) continue;                 // the songbook writes it this way
      if (COMMON_WORDS[w]) continue;          // a real word, just the wrong one
      /* moving where the line says movin' is a right answer, and it is one
         letter from a word on the line - exactly what a typo looks like. */
      var filled = false;
      for (var f = 0; f < aw.length && !filled; f++) filled = wordsMatch(aw[f], tok);
      if (filled) continue;
      for (var g = 0; g < targets.length; g++) {
        var cap = typoAllowance(Math.max(w.length, targets[g].length));
        if (typoDistance(w, targets[g], cap) <= cap) {
          flags[flags.length - 1] = true;
          break;
        }
      }
    }
    return flags;
  }

  /**
   * Underline mask. Only letters and digits get an underscore - punctuation is
   * dropped entirely, so "and," is three blanks, not four. That matches the
   * grader, which already strips punctuation before comparing.
   */
  function maskOf(line) {
    var out = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === ' ' || ch === TAB) { out += ' '; continue; }
      if (isLetterCode(line.charCodeAt(i))) out += '_';
    }
    return out;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function fmtDate(ms) {
    if (!ms) return '';
    var d = new Date(Number(ms));
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- server bridge ----------
     HtmlService injects google.script.run AFTER this script runs, so never
     touch it at parse time - poll for it instead. */
  function whenReady(cb) {
    if (window.google && google.script && google.script.run) return cb();
    setTimeout(function () { whenReady(cb); }, 30);
  }
  function api(action, params) {
    return new Promise(function (resolve, reject) {
      whenReady(function () {
        google.script.run
          .withSuccessHandler(function (json) {
            var r;
            try { r = JSON.parse(json); }
            catch (e) { reject(new Error('Bad response from server')); return; }
            if (r.ok) resolve(r.data); else reject(new Error(r.error));
          })
          .withFailureHandler(function (e) {
            reject(new Error(e && e.message ? e.message : 'Server call failed'));
          })
          .apiCall(JSON.stringify({ action: action, params: params || {} }));
      });
    });
  }

  /* ---------- cache that outlives the session ----------
     S.cache is a plain object and dies on reload. This backs it with
     localStorage so a song you opened yesterday paints instantly today.
     Every call is best-effort: if storage is full, blocked, or the sandbox
     origin rotated between sessions, the read simply misses and the app
     behaves exactly as it did before. */
  var LS = 'sb1.';

  function lsGet(key) {
    try {
      var raw = window.localStorage.getItem(LS + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function lsDrop(key) {
    try { window.localStorage.removeItem(LS + key); } catch (e) {}
  }

  function lsDropSongs() {
    try {
      var kill = [];
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(LS + 'song.') === 0) kill.push(k);
      }
      for (var j = 0; j < kill.length; j++) window.localStorage.removeItem(kill[j]);
    } catch (e) {}
  }

  /* Bump when the shape of the stored index or song changes, so an old blob is
     ignored rather than half-read. */
  /* s3 for 1.31a: the cached blob carries the SETTINGS, and the settings grew
     dials the games now read - decoyPct everywhere, fakePct on Line Impostor.
     A 1.3c blob restored from storage would hand Line Impostor an undefined
     share, and shareOf(n, undefined) is NaN, so the board would come up empty
     and bounce you out. The stored settings are as much a shape to version as
     the stored songs are. */
  /* s9 - 1.63. The settings blob carries the medal multipliers now, and the
     page draws every "hot days x N" off them. A blob cached by 1.62 has no
     medalMult on it at all, so the panel would fall back to the shipped
     defaults and quietly contradict whatever had been tuned. */
  /* s10 - 1.64. A song carries playKey and capo now, and the header draws
     them. A song cached by 1.63 has neither, so it would show no key strip
     until something else happened to evict it. */
  /* s11 - 1.70. The index carries playKey and capo too (the set list shows
     every song's before any lyrics load), and a list carries its own order. */
  var CACHE_VERSION = 's11';

  /* Dropping a song has to clear BOTH caches. Clearing only the in-memory one
     left the stored copy behind, so the next open painted the old lyrics. */
  function dropSong(id) {
    delete S.cache[id];
    try { window.localStorage.removeItem(LS + 'song.' + id); } catch (e) {}
  }

  function dropAllSongs() {
    S.cache = {};
    lsDropSongs();
  }

  function lsSet(key, value) {
    try {
      window.localStorage.setItem(LS + key, JSON.stringify(value));
    } catch (e) {
      // out of room - throw away the song bodies and keep the index
      lsDropSongs();
      try { window.localStorage.setItem(LS + key, JSON.stringify(value)); } catch (e2) {}
    }
  }

  /* Repainting mid-quiz would wipe what you had typed, and mid-edit would wipe
     the form, so a background refresh only ever repaints a listing screen. */
  var REPAINTABLE = { front: 1, back: 1, library: 1, insights: 1, detail: 1 };
  function repaintIfSafe() {
    if (!REPAINTABLE[route().view]) return;
    /* NOBODY NAVIGATED, so nothing has stashed where you are - and render
       restores from the stash. Without this line a background refresh would
       drop you at whatever offset you last LEFT this screen on, which is a
       worse jump than the top of the page because it looks deliberate. */
    stashScroll();
    render();
  }

  /* ---------- which machine is this ----------
     Screen size lies: a desktop window can be any width at all. The primary
     pointer does not - a phone reports coarse, a mouse reports fine - and
     touch count plus the physical screen corroborate it. Stored in
     localStorage rather than the Sheet, because the answer belongs to the
     machine and not to the account.

     THREE ANSWERS SINCE 1.62, and the third one fixes a real fault rather than
     adding a feature. The old test was one threshold - a coarse touch screen
     whose SHORT side is under 820px is a phone, anything else is a PC - and
     820px runs straight through the middle of the iPad range. A 9.7 or 10.2
     inch iPad is 768 across and was being counted as a phone; an iPad Air or an
     11 inch Pro is 820 or 834 and was being counted as a PC. The same tablet
     family was landing in both buckets depending on which one you picked up.

     So the coarse-pointer test now decides touch device or not, and a SECOND
     threshold splits phone from tablet. 600px is the gap it sits in: phones top
     out around 430 across and tablets start at 768, so there is nothing near it
     to get wrong. Modern iPadOS lies in its user agent and claims to be a Mac -
     none of this reads the user agent, so it does not matter.

     WHAT THE THIRD ANSWER IS FOR is layout, and only layout. See
     timingDevice: a tablet is timed with the phone, because the thing a
     stopwatch is measuring is your thumbs, and they are the same thumbs. */
  function detectDevice() {
    try {
      var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      var touch = (navigator.maxTouchPoints || 0) > 1;
      if (!(coarse && touch)) return 'desktop';
      return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
    } catch (e) { return 'desktop'; }
  }
  var DEVICES = { phone: 1, tablet: 1, desktop: 1 };
  function deviceNow() {
    var forced = lsGet('device');
    return DEVICES[forced] ? forced : detectDevice();
  }
  /**
   * WHICH TIMING BUCKET THIS MACHINE COUNTS AS - two, not three.
   *
   * A tablet is timed with the phone. The reason times are never averaged
   * across devices is that a keyboard and a thumb are not the same
   * measurement; a tablet and a phone are the SAME measurement, taken on a
   * bigger pane of glass. Splitting them would have bought a distinction
   * nobody needs and paid for it by halving the evidence behind every median
   * on both - and by putting a third value into the Attempts sheet, which
   * every row already written would not have.
   *
   * So nothing new is ever stored. The sheet still only ever sees phone or
   * desktop, and the third answer lives entirely on this page.
   */
  function timingDevice() { return deviceNow() === 'desktop' ? 'desktop' : 'phone'; }
  function deviceLabel(d) {
    return d === 'phone' ? 'Phone'
         : d === 'tablet' ? 'Tablet'
         : (d === 'desktop' ? 'PC' : 'unknown');
  }
  /** What a timing bucket is called, which is not what a device is called. */
  function timingLabel(d) { return d === 'desktop' ? 'PC' : 'Phone or tablet'; }

  /* THE ONE THING THE FORM FACTOR CHANGES ON THE PAGE, as a class on the body
     so the CSS can do the rest. Only the phone is named, because only the
     phone is short of width - a tablet has the room a PC has and gets the PC
     layout, which is the whole reason the three-way split was needed. */
  function paintFormFactor() {
    var phone = deviceNow() === 'phone';
    if (phone) document.body.classList.add('is-phone');
    else document.body.classList.remove('is-phone');
  }

  /* ---------- the quiz clock ----------
     Wall clock, but it stops while the app is in the background. On a phone
     you get interrupted mid-verse constantly, and a single walk-away run
     would otherwise poison that song's median permanently.

     Deliberately never shown while you are quizzing. A visible clock changes
     how you answer, and then it is measuring itself rather than you. */
  var clock = { start: 0, banked: 0, running: false, active: false };
  function clockStart() {
    clock.start = Date.now(); clock.banked = 0;
    clock.running = true; clock.active = true;
  }
  function clockPause() {
    if (!clock.running) return;
    clock.banked += Date.now() - clock.start;
    clock.running = false;
  }
  function clockResume() {
    if (clock.running || !clock.active) return;
    clock.start = Date.now();
    clock.running = true;
  }
  function clockStop() {
    clockPause();
    clock.active = false;
    return Math.round(clock.banked / 1000);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clockPause(); else clockResume();
  });

  function fmtClock(secs) {
    var s = Math.max(0, Math.round(Number(secs) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  /* ---------- state ---------- */
  var S = {
    build: '', songs: [], lists: [], lastImport: '', docUrl: '', docTitle: '',
    cache: {},                 // songId -> full song
    settings: { decay: 1, floor: 75, hotPct: 10, games: {}, quizzes: {} },
    modes: [], sheetUrl: '',
    quizMode: 'medium',
    activeListId: null,
    /* Empty on purpose. A shelf takes defaultSortFor's answer the first time
       it is asked and keeps it from then on, which is the only way seven
       shelves get seven different defaults without seven entries here. */
    sortMode: {},
    sortDir: {},               // scope -> 1 as the menu reads it, -1 reversed
    hideChords: true,          // lyrics are the point; chords are reference
    // one filter box per screen, so typing in the Pantry does not silently
    // narrow the burners as well
    search: { library: '', front: '', back: '' },
    accFilter: 'all',          // which quiz level the burner accuracy stat counts
    timeFilter: { mode: null, device: null },   // null device means whatever you are on
    pickKind: null,            // 'game' | 'quiz' when the picker was opened for one shelf
    retired: {}, families: [], earned: {}, firstAttempt: null,
    gameEdit: '',              // which game the Settings dropdown is sitting on
    smartList: '',             // '' | plate | counter | fridge | freezer
    practiceRun: false,        // this run banks nothing and is never recorded
    creditRun: null,           // the for-credit run in progress, if any
    /* WHAT THIS SESSION HAS ALREADY SPENT, keyed songId|mode.
       The one-a-day is derived from the attempt history, which is the right
       design and has one hole: between writing a row and the index coming back
       with it, the index still says the day is open. Tap through fast enough -
       finish a run, More practice, straight back into the same game - and the
       picker would sell you a second credit run on a day you had already spent.
       This is the receipt in your hand while the shop updates its ledger:
       purely additive, never says a day is FREE that the server says is spent,
       and thrown away the moment a refresh lands with no writes outstanding. */
    spent: {},
    saving: 0,                 // writes in flight
    saveState: '',             // '' | 'saving' | 'saved' | 'failed'
    saveRetry: null,           // the attempt to send again, if one failed
    quizVariant: '',           // Blank Lines: which line goes missing
    timerWanted: {},           // mode id -> did you tick the stopwatch box
    logShown: 10,              // rows in the song's attempt log
    logKind: '',               // and which kind of run it is filtered to
    insightWindow: 30,         // days behind the Insights headline figures
    modeStats: [],             // one row per game-and-level and per quiz, whole library
    statMode: '',              // which one the Games and quizzes panel is showing
    pointsShown: 10,           // rows in the Insights points chart, 0 for all
    timing: [],                // per mode+device pace, library-wide
    outcome: null,             // what the last quiz did, once the server says
    stack: [{ view: 'front', params: {} }]
  };

  /* ---------- sorting, shared by the Pantry and the burners ---------- */
  /**
   * ONE ENTRY PER MEASUREMENT, AND A BUTTON FOR THE DIRECTION - 1.53.
   *
   * The menu used to carry both ends of three of these: Hottest and Coldest,
   * Strongest and Weakest, Most and Least practiced. Twelve options, half of
   * them the same sort read backwards, and the pair was never adjacent to its
   * own opposite in your head - you went looking for "coldest" under H.
   * Naming the measurement once and putting the direction on a button beside
   * the menu is six options and no lost pairs, and it gives the other five
   * sorts a reverse they never had: oldest-added, Z-A, fewest games left.
   *
   * Custom order is the exception and the button hides for it. A hand-made
   * order has no opposite worth offering - backwards is not a second opinion
   * about the same thing, it is just the list upside down.
   *
   * Ids are the old ones so nothing else in the file has to be told. weak,
   * cold and stale are gone from the menu but still understood by
   * sortSongs, because a stored preference from a build before this one is
   * the one thing that can still name them.
   */
  var SORTS = [
    ['recent',    'Recently added'],
    ['alpha',     'Song A-Z'],
    ['artist',    'Artist A-Z'],
    ['hot',       'Hottest'],
    ['strong',    'Strongest'],
    ['medals',    'Medals'],
    ['practiced', 'Most practiced'],
    ['gamesleft', 'Games left today'],
    ['quizleft',  'Quiz left today'],
    ['manual',    'Custom order']
  ];

  /* The three that used to be a pair in the menu. Reading one of them is the
     same as reading its survivor backwards, which is exactly what the button
     now does - so they collapse into a mode and a direction. */
  var SORT_ALIAS = { cold: ['hot', -1], weak: ['strong', -1], stale: ['practiced', -1] };

  /**
   * What a shelf sorts by before you have told it otherwise.
   *
   * These are not one default repeated - each shelf is a different question.
   * A burner is a to-do list, so the weakest song is the one you came for. The
   * Pantry is a trophy cabinet, so it opens on the strongest. Plate, Counter
   * and Fridge are all "what is closest to turning", which is coldest first.
   * The Freezer is already at zero, where heat says nothing at all and the
   * only thing left to rank on is how much work is in each song.
   */
  function defaultSortFor(scope) {
    if (scope === 'front' || scope === 'back') return ['strong', -1];
    if (scope === 'library') return ['strong', 1];
    if (scope === 'smart:plate' || scope === 'smart:counter' ||
        scope === 'smart:fridge') return ['hot', -1];
    if (scope === 'smart:freezer') return ['practiced', 1];
    return ['strong', 1];                       // custom lists, and anything new
  }

  /** The scope key for whatever the Pantry is showing, so each shelf remembers
      its own sort rather than sharing one with every other shelf. */
  function pantryScope() {
    if (S.smartList) return 'smart:' + S.smartList;
    if (S.activeListId !== null) {
      var l = listById(S.activeListId);
      // a burner reached through the Pantry is still a burner, and sorts like one
      if (l && (l.role === 'front' || l.role === 'back')) return l.role;
      return 'list:' + S.activeListId;
    }
    return 'library';
  }

  function listById(id) {
    for (var i = 0; i < S.lists.length; i++) if (S.lists[i].id === id) return S.lists[i];
    return null;
  }

  /** The sort in force for a scope, filling in that shelf's default once. */
  function sortFor(scope) {
    if (!S.sortMode[scope]) {
      var d = defaultSortFor(scope);
      S.sortMode[scope] = d[0];
      S.sortDir[scope] = d[1];
    }
    var mode = S.sortMode[scope];
    if (SORT_ALIAS[mode]) {                     // a preference from an older build
      S.sortMode[scope] = SORT_ALIAS[mode][0];
      S.sortDir[scope] = SORT_ALIAS[mode][1];
    }
    return { mode: S.sortMode[scope], dir: S.sortDir[scope] === -1 ? -1 : 1 };
  }

  /**
   * What is still on the table today, which is the one thing the progress
   * strip says that nothing could sort on. A song is worth opening in the
   * evening exactly as far as it still has credit runs in it.
   *
   * A never-opened song has every run available and honestly belongs at the
   * top of both.
   */
  /* A RUN YOU CANNOT TAKE IS NOT A RUN LEFT - 1.52.
   *
   * Both of these counted everything on the shelf, which was right until 1.50
   * put locks on it. After that, a song nobody had ever opened reported eight
   * games and a quiz still available - and since these two are SORT KEYS, that
   * floated exactly the songs with nothing playable on them to the top of the
   * list, above the ones actually waiting for you.
   *
   * The quiz one was the louder bug because it is one-or-nothing: every song
   * with the whole shelf locked scored the same 1 as a song sitting there
   * ready, and the tie-break sent the untouched ones first.
   */
  function gamesLeftToday(s) {
    var n = 0;
    for (var i = 0; i < S.modes.length; i++) {
      var m = S.modes[i];
      if (m.kind !== 'game') continue;
      if (gameShut(s, m.id)) continue;
      if ((m.id === 'verseSort' || m.id === 'verseOrder') &&
          (s.sectionCount || 0) < 3) continue;
      if (!gameUsed(s, m.id)) n++;
    }
    return n;
  }
  function quizLeftToday(s) {
    if (beginnerShut(s)) return 0;         // nothing on the shelf is open yet
    return quizUsed(s) ? 0 : 1;
  }

  // Ranking runs on mastery, not raw accuracy, so a song you aced months ago
  // ranks below one you aced last week. Never-quizzed songs use -1 so they sit
  // at the "needs work" end rather than being treated as a zero score.
  function accOf(s) { return s.attempts ? (s.score || 0) : -1; }

  /**
   * One number covering both states, so hot and cold sort as a single run:
   * hot 3 -> 4, hot 0 -> 1, cold 1 -> -1, cold 5 -> -5. Highest is hottest.
   * Never-quizzed songs return null - they are not hot OR cold, they are
   * unknown, and they sit at the bottom of both directions rather than
   * pretending to be ice cold.
   */
  function heatKey(s) {
    if (!s.attempts) return null;
    return s.hot ? (s.hotDays || 0) + 1 : -(s.coldRate || 0);
  }

  /**
   * The four shelves a song can be sitting on, worked out from its state rather
   * than stored anywhere. A song moves between them on its own, overnight, and
   * that is the point - they are a reading of the library, not a filing system.
   *
   *   Plate    hot with more than a week left
   *   Counter  hot, but a week or less
   *   Fridge   cold, still has points
   *   Freezer  cold and worn all the way to nothing
   */
  var SMART_LISTS = [
    { id: 'plate',   name: 'Plate',
      sub: 'Hot, with more than a week left. Nothing to do here.' },
    { id: 'counter', name: 'Counter',
      sub: 'Hot, but a week or less. These are the ones about to turn.' },
    { id: 'fridge',  name: 'Fridge',
      sub: 'Cold, still worth something, losing a little every night.' },
    { id: 'freezer', name: 'Freezer',
      sub: 'Worn all the way to zero. They owe nothing, so a single run restarts them.' }
  ];

  function onSmartList(s, which) {
    if (!which) return true;
    if (!s.attempts) return false;                 // never opened is not a state
    if (which === 'plate')   return !!s.hot && (s.hotDays || 0) > 7;
    if (which === 'counter') return !!s.hot && (s.hotDays || 0) <= 7;
    if (which === 'fridge')  return !s.hot && (s.score || 0) > 0;
    if (which === 'freezer') return !s.hot && (s.score || 0) <= 0;
    return true;
  }

  function smartCount(which) {
    var n = 0;
    for (var i = 0; i < S.songs.length; i++) if (onSmartList(S.songs[i], which)) n++;
    return n;
  }

  function smartById(which) {
    for (var i = 0; i < SMART_LISTS.length; i++) {
      if (SMART_LISTS[i].id === which) return SMART_LISTS[i];
    }
    return null;
  }

  /** What the Pantry is showing right now, as a name. */
  function currentListName() {
    if (S.smartList) {
      var sm = smartById(S.smartList);
      if (sm) return sm.name;
    }
    if (S.activeListId !== null) {
      for (var i = 0; i < S.lists.length; i++) {
        if (S.lists[i].id === S.activeListId) return S.lists[i].name;
      }
    }
    return 'Everything';
  }

  /**
   * The shelf menu. Reached by tapping Pantry while already on the Pantry -
   * which is invisible, so the same menu hangs off a bar at the top of the
   * page that says what you are looking at.
   */
  function openListSheet(after) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title', 'Show me'));

    function row(cls, name, sub, n, on, pick) {
      var b = el('button', 'smart-row' + (on ? ' on' : ''));
      b.type = 'button';
      b.innerHTML = '<span class="smart-dot' + (cls ? ' ' + cls : '') + '"></span>' +
        '<span class="smart-body"><span class="smart-name">' + esc(name) + '</span>' +
        (sub ? '<span class="smart-sub">' + esc(sub) + '</span>' : '') + '</span>' +
        '<span class="smart-n">' + n + '</span>';
      b.addEventListener('click', function () { back.remove(); pick(); });
      sheet.appendChild(b);
    }

    row('', 'Everything', 'The whole pantry.', S.songs.length,
        !S.smartList && S.activeListId === null,
        function () { S.smartList = ''; S.activeListId = null; after(); });

    sheet.appendChild(el('div', 'sheet-group', 'By how hot it is'));
    for (var i = 0; i < SMART_LISTS.length; i++) {
      (function (sm) {
        row('smart-' + sm.id, sm.name, sm.sub, smartCount(sm.id),
            S.smartList === sm.id,
            function () { S.smartList = sm.id; S.activeListId = null; after(); });
      })(SMART_LISTS[i]);
    }

    var burners = [], custom = [];
    for (var l = 0; l < S.lists.length; l++) {
      if (S.lists[l].role === 'front' || S.lists[l].role === 'back') burners.push(S.lists[l]);
      else custom.push(S.lists[l]);
    }
    if (burners.length) {
      sheet.appendChild(el('div', 'sheet-group', 'Burners'));
      for (var b2 = 0; b2 < burners.length; b2++) {
        (function (lst) {
          var n = 0;
          for (var k = 0; k < S.songs.length; k++) {
            if ((S.songs[k].listIds || []).indexOf(lst.id) !== -1) n++;
          }
          row('', lst.name, '', n, S.activeListId === lst.id,
              function () { S.smartList = ''; S.activeListId = lst.id; after(); });
        })(burners[b2]);
      }
    }
    if (custom.length) {
      sheet.appendChild(el('div', 'sheet-group', 'Your lists'));
      for (var c = 0; c < custom.length; c++) {
        (function (lst) {
          var n = 0;
          for (var k = 0; k < S.songs.length; k++) {
            if ((S.songs[k].listIds || []).indexOf(lst.id) !== -1) n++;
          }
          row('', lst.name, '', n, S.activeListId === lst.id,
              function () { S.smartList = ''; S.activeListId = lst.id; after(); });
        })(custom[c]);
      }
    }

    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  function matchesFilter(s, q) {
    if (!q) return true;
    return s.title.toLowerCase().indexOf(q) !== -1 ||
           String(s.artist || '').toLowerCase().indexOf(q) !== -1;
  }

  /**
   * Every comparator below is written the way its MENU LABEL reads, and d
   * flips the whole thing for the reverse button. The two exceptions are
   * deliberate:
   *
   *   Never-quizzed songs sink in BOTH directions on Hottest. They are not hot
   *   and they are not cold, they are unknown, and floating them to the top of
   *   "coldest" would be the list telling you a lie about songs it has no
   *   reading for. So the null tests sit outside the multiply.
   *
   *   Custom order has no reverse, so it ignores d entirely - see SORTS.
   */
  function sortSongs(list, mode, dir) {
    var d = dir === -1 ? -1 : 1;
    if (SORT_ALIAS[mode]) { d = d * SORT_ALIAS[mode][1]; mode = SORT_ALIAS[mode][0]; }
    if (mode === 'alpha') {
      list.sort(function (a, b) { return d * a.title.localeCompare(b.title); });
    } else if (mode === 'artist') {
      list.sort(function (a, b) {
        var c = String(a.artist || '~').localeCompare(String(b.artist || '~'));
        return d * (c !== 0 ? c : a.title.localeCompare(b.title));
      });
    } else if (mode === 'strong') {
      list.sort(function (a, b) { return d * (accOf(b) - accOf(a)); });
    } else if (mode === 'medals') {
      /* TWO KEYS, AND THE SECOND ONE IS THE POINT - 1.61.
         Platinum, gold, silver, bronze, nothing - and inside each of those
         five bands, whichever song has the least left to do before the next
         medal up. So the gold at the top of the golds is the one a single run
         would turn platinum, and the list reads as a queue rather than as a
         trophy cabinet sorted by size.
         Platinum has no next medal, so every platinum has a gap of zero and
         the whole band falls through to the alphabet - which is the only
         honest order for a set of songs that are all finished.
         The alphabet sits OUTSIDE d, like it does on Hottest: reversed, this
         is meant to say "least medals, most work left", and a tie inside that
         is still a tie, not a reason to run the alphabet backwards. */
      list.sort(function (a, b) {
        var n = medalTierRank(b) - medalTierRank(a);
        if (n !== 0) return d * n;
        var g = medalGap(a) - medalGap(b);
        if (g !== 0) return d * g;
        return a.title.localeCompare(b.title);
      });
    } else if (mode === 'practiced') {
      list.sort(function (a, b) { return d * ((b.attempts || 0) - (a.attempts || 0)); });
    } else if (mode === 'gamesleft' || mode === 'quizleft') {
      // most left first, and among equals the one that needs the work most
      var left = mode === 'gamesleft' ? gamesLeftToday : quizLeftToday;
      list.sort(function (a, b) {
        var n = left(b) - left(a);
        if (n !== 0) return d * n;
        return d * (accOf(a) - accOf(b));
      });
    } else if (mode === 'hot') {
      list.sort(function (a, b) {
        var ka = heatKey(a), kb = heatKey(b);
        if (ka === null && kb === null) return a.title.localeCompare(b.title);
        if (ka === null) return 1;
        if (kb === null) return -1;
        return d * (kb - ka);
      });
    } else if (mode === 'manual') {
      list.sort(function (a, b) { return (a.sortIndex || 0) - (b.sortIndex || 0); });
    } else {
      list.sort(function (a, b) { return d * ((b.createdAt || 0) - (a.createdAt || 0)); });
    }
    return list;
  }

  /** Custom order is the one sort with nothing to say backwards. */
  function reversible(mode) { return mode !== 'manual'; }

  /**
   * Sort menu on the left, filter box on the right.
   *
   * onChange must redraw ONLY the song list. Redrawing this bar as well would
   * rebuild the input and drop focus after every keystroke, which makes it
   * impossible to type more than one letter into.
   */
  function filterBar(scope, onChange) {
    var row = el('div', 'filter-row');
    var cur = sortFor(scope);

    var sel = el('select', 'sort-select');
    var opts = '';
    for (var i = 0; i < SORTS.length; i++) {
      opts += '<option value="' + SORTS[i][0] + '"' +
        (cur.mode === SORTS[i][0] ? ' selected' : '') + '>' +
        esc(SORTS[i][1]) + '</option>';
    }
    sel.innerHTML = opts;
    row.appendChild(sel);

    /* THE DIRECTION, as a button rather than a second half of every menu
       entry. It says which way the list currently runs - the arrow points the
       way the values go, down for the label as written and up for its reverse
       - and it disappears entirely on Custom order, where there is nothing to
       reverse. Paint is its own function because changing the menu changes the
       button: the reverse of Hottest is not the reverse of Song A-Z, and
       switching sorts has to re-read the direction for the new one. */
    var flip = el('button', 'sort-dir');
    flip.type = 'button';
    function paintFlip() {
      var st = sortFor(scope);
      var on = reversible(st.mode);
      flip.style.display = on ? '' : 'none';
      if (!on) return;
      var up = st.dir === -1;
      flip.innerHTML = up ? '&#8593;' : '&#8595;';
      flip.className = 'sort-dir' + (up ? ' is-up' : '');
      flip.title = up ? 'Reversed - tap to put it back' : 'Tap to reverse the order';
      flip.setAttribute('aria-label', flip.title);
    }
    sel.addEventListener('change', function () {
      S.sortMode[scope] = sel.value;
      /* A NEW SORT STARTS THE WAY ITS LABEL READS. Carrying the reversal over
         from the last one means picking "Strongest" off the menu and being
         handed the weakest, with only a small arrow to explain why. */
      S.sortDir[scope] = 1;
      paintFlip();
      onChange();
    });
    flip.addEventListener('click', function () {
      S.sortDir[scope] = sortFor(scope).dir === -1 ? 1 : -1;
      paintFlip();
      onChange();
    });
    paintFlip();
    row.appendChild(flip);

    var box = el('input', 'filter-input');
    box.type = 'search';
    box.placeholder = 'Filter by title or artist';
    box.value = S.search[scope] || '';
    box.addEventListener('input', function () {
      S.search[scope] = box.value;
      onChange();
    });
    row.appendChild(box);

    return row;
  }

  /**
   * Swap two songs in the displayed order and persist both. Only the two
   * touched rows are written, so a 242-song list does not get rewritten to
   * move one entry.
   */
  function moveSong(visible, index, dir, redraw) {
    var other = index + dir;
    if (other < 0 || other >= visible.length) return;
    var a = visible[index], b = visible[other];
    var tmp = a.sortIndex;
    a.sortIndex = b.sortIndex;
    b.sortIndex = tmp;
    redraw();
    api('reorder', { order: [
      { id: a.id, sortIndex: a.sortIndex },
      { id: b.id, sortIndex: b.sortIndex }
    ] }).catch(function (e) { toast('Order not saved: ' + e.message); });
  }

  /* A CUSTOM LIST HAS ITS OWN RUNNING ORDER - 1.70. "Custom order" used to be
     the songs' sortIndex, one order for the whole library, so the same song
     could not open one set and close another. A list now carries the ids in
     its own order; a song it does not name yet - added since it was last
     arranged - follows on, in library order. The burners keep sortIndex. */
  function listSongs(list) {
    var pos = {}, ord = (list && list.order) || [], out = [];
    for (var i = 0; i < ord.length; i++) pos[ord[i]] = i;
    for (var j = 0; j < S.songs.length; j++) if (onList(S.songs[j], list)) out.push(S.songs[j]);
    out.sort(function (a, b) {
      var pa = pos.hasOwnProperty(a.id) ? pos[a.id] : 1e9;
      var pb = pos.hasOwnProperty(b.id) ? pos[b.id] : 1e9;
      if (pa !== pb) return pa - pb;
      return (a.sortIndex || 0) - (b.sortIndex || 0);
    });
    return out;
  }
  function saveListOrder(list, songs) {
    var ids = [];
    for (var i = 0; i < songs.length; i++) ids.push(songs[i].id);
    list.order = ids;
    return api('setListOrder', { id: list.id, order: ids })
      .catch(function (e) { toast('Order not saved: ' + e.message); });
  }

  function listByRole(role) {
    for (var i = 0; i < S.lists.length; i++) if (S.lists[i].role === role) return S.lists[i];
    return null;
  }
  function customLists() {
    var out = [];
    for (var i = 0; i < S.lists.length; i++) if (!S.lists[i].role) out.push(S.lists[i]);
    return out;
  }
  function onList(song, list) {
    return !!(list && (song.listIds || []).indexOf(list.id) !== -1);
  }
  function customListCount(song) {
    var n = 0, cl = customLists();
    for (var i = 0; i < cl.length; i++) if (onList(song, cl[i])) n++;
    return n;
  }
  function songById(id) {
    for (var i = 0; i < S.songs.length; i++) if (S.songs[i].id === id) return S.songs[i];
    return null;
  }

  /* ---------- routing ---------- */
  var appEl = document.getElementById('app');
  var titleEl = document.getElementById('pageTitle');
  var backBtn = document.getElementById('backBtn');
  var tabbar = document.getElementById('tabbar');
  // Settings is reached by the gear in the header, not the tab bar.
  var TABS = ['front', 'back', 'library', 'add', 'insights'];

  /* ---------- burner + list icons ----------
     Two beamed eighth notes. The back burner is the same glyph rotated a
     half turn, so noteheads sit above the stem - the two are told apart by
     orientation, not just by colour. */
  var NOTE_INNER =
    '<ellipse cx="7.4" cy="17.2" rx="3.05" ry="2.3" transform="rotate(-18 7.4 17.2)"/>' +
    '<ellipse cx="16.5" cy="17.2" rx="3.05" ry="2.3" transform="rotate(-18 16.5 17.2)"/>' +
    '<rect x="9.7" y="6.2" width="1.5" height="11.3" rx="0.3"/>' +
    '<rect x="18.8" y="6.2" width="1.5" height="11.3" rx="0.3"/>' +
    '<rect x="9.7" y="4.9" width="10.6" height="2.5" rx="0.6"/>';

  function noteSvg(inverted, size) {
    var s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="currentColor">' +
      (inverted ? '<g transform="rotate(180 12 12)">' + NOTE_INNER + '</g>' : NOTE_INNER) +
      '</svg>';
  }
  function bookSvg() {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">' +
      '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5z"/>' +
      '<path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>' +
      '</svg>';
  }

  /** Bottom-sheet list of quiz modes. Used by the Random Quiz button. */
  function modesOfKind(kind) {
    var out = [];
    for (var i = 0; i < S.modes.length; i++) {
      if (!kind || (S.modes[i].kind || 'quiz') === kind) out.push(S.modes[i]);
    }
    return out;
  }

  /**
   * Pick a MODE and nothing else. Games are grouped by family so the sheet
   * reads the same way the picker does; the level comes later, once a song is
   * chosen, because which levels exist depends on what that song has unlocked.
   */
  function openModeSheet(onPick, kind) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title',
      kind === 'game' ? 'Which game?' : kind === 'quiz' ? 'Which quiz?' : 'Which one?'));

    function row(m) {
      var card = el('button', 'mode-card');
      card.type = 'button';
      card.innerHTML =
        '<div class="mode-body"><div class="mode-name">' + esc(m.label) + '</div>' +
        '<div class="mode-blurb">' + esc(m.blurb) + '</div></div>';
      card.addEventListener('click', function () {
        back.remove();
        onPick(m.id);
      });
      sheet.appendChild(card);
    }

    if (kind === 'game') {
      var fams = S.families || [];
      for (var f = 0; f < fams.length; f++) {
        var mine = [];
        for (var m2 = 0; m2 < S.modes.length; m2++) {
          if (S.modes[m2].family === fams[f].id) mine.push(S.modes[m2]);
        }
        if (!mine.length) continue;
        sheet.appendChild(el('div', 'sheet-group', esc(fams[f].label)));
        for (var v = 0; v < mine.length; v++) row(mine[v]);
      }
    } else {
      var list = modesOfKind(kind);
      for (var i2 = 0; i2 < list.length; i2++) row(list[i2]);
    }

    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /**
   * The song has been drawn - now which level, and does it count? Locked rungs
   * are shown but refused, so a random draw explains itself rather than quietly
   * offering less than it did last time.
   *
   * EVERY LEVEL CARRIES THE SAME PANEL THE PICKER GIVES IT: this song's time
   * limit, how many tries are behind it, best, average, last and how long ago.
   * You are being asked exactly the question the picker asks - which of these
   * three - and answering it off three bare buttons meant the shortest route
   * into a game was also the least informed one.
   *
   * The song is loaded before the sheet is drawn, because that history is what
   * the panels are made of. It is nearly always already in hand.
   */
  function openRandomLevelSheet(idx, modeId) {
    loadSong(idx.id).then(function (song) { levelSheet(song, idx, modeId); },
                          function (e) { toast(e.message); });
  }

  function levelSheet(song, idx, modeId) {
    var mode = modeById(modeId);
    var rec = songRecord(song);
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title', esc(idx.title)));
    sheet.appendChild(el('p', 'form-hint mt-0',
      esc(mode ? mode.label : modeId) +
      (gameUsed(idx, modeId) ? '  &middot;  taken for credit today, practice only'
                             : '  &middot;  today is still open')));

    for (var L = 0; L < LEVELS.length; L++) {
      (function (lv) {
        var locked = levelLocked(idx, modeId, lv);
        var used = gameUsed(idx, modeId);
        var clean = levelClean(idx, modeId, lv);
        var pts = modePoints(modeId, lv);
        var row = el('div', 'fam-row');
        var b = el('button', 'fam-lvl' +
          (locked ? ' is-locked' : '') + (used && !locked ? ' is-spent' : '') +
          (clean ? ' is-clean' : ''));
        b.type = 'button';
        b.innerHTML = locked
          ? '<span class="fam-lock">' + lockSvg(15) + '</span>' +
            '<span class="fam-lvl-name">' + esc(LEVEL_LABEL[lv]) + '</span>' +
            '<span class="fam-pts">locked</span>'
          : '<span class="fam-lvl-name">' + cleanWrap(LEVEL_LABEL[lv], clean) + '</span>' +
            '<span class="fam-pts">' + pts + ' pt' + (pts === 1 ? '' : 's') +
            (used ? '  &middot;  practice' : '') + '</span>';
        if (locked) {
          /* Same sentence the picker gives, from the same function - the level
             sheet is the picker's other door and the two cannot be allowed to
             disagree about why something is shut. */
          var why = lockReason(idx, mode || { id: modeId, label: modeId }, lv);
          b.title = why;
          b.addEventListener('click', function () { toast(why); });
        } else {
          b.addEventListener('click', function () {
            back.remove();
            openPlaySheet(song, mode, lv, used);
          });
        }
        row.appendChild(b);
        row.appendChild(statPanel(rec, modeId, lv, timeLimitFor(idx, modeId, lv)));
        sheet.appendChild(row);
      })(LEVELS[L]);
    }
    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.style.marginTop = '10px';
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  function listsSvg() {
    return '<svg viewBox="0 0 24 24" width="20" height="20">' +
      '<path d="M6 3h8l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7"/>' +
      '<path d="M13.5 3.2V7.5H18" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M7.5 11h6M7.5 14.5h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ---------- percentile colour scales ----------
     The way a Sheets colour scale works: worst value takes the low colour,
     the median takes the middle, the best takes the high. Untested songs stay
     grey and are excluded entirely - a zero you have never attempted is not a
     bad score, it is an absent one.

     The SCORE scale is built from the whole library, never from the list on
     screen. Filtering to a burner of eight strong songs used to re-spread the
     colours across just those eight, so the weakest of them showed up rust
     red - a colour that meant "worst of these eight" while looking like it
     meant "weak". Against the library it means the same thing everywhere. */
  /* Blue at the bottom, red at the top, so the score plate reads on the same
     axis as the flame and the snowflake underneath it. A cold song looks cold
     and a hot one looks hot, whichever half of the badge you glance at. */
  var SCALE_LOW = [52, 88, 142], SCALE_MID = [199, 154, 62], SCALE_HIGH = [178, 55, 42];
  var SCALE_NONE = '#B8AE97';
  // hot: pale grey at one day left, up through ember to red
  var HOT_LOW = [168, 162, 148], HOT_MID = [201, 126, 52], HOT_HIGH = [178, 55, 42];
  // cold: the same pale grey at a gentle rate, down into deep blue
  var COLD_LOW = [168, 162, 148], COLD_MID = [98, 130, 165], COLD_HIGH = [39, 68, 118];

  function spreadOf(vals) {
    vals.sort(function (a, b) { return a - b; });
    if (!vals.length) return null;
    var n = vals.length, mid;
    if (n % 2) mid = vals[(n - 1) / 2];
    else mid = (vals[n / 2 - 1] + vals[n / 2]) / 2;
    return { min: vals[0], mid: mid, max: vals[n - 1], n: n };
  }

  function buildScale(list) {
    var vals = [];
    for (var i = 0; i < list.length; i++) {
      // Spent songs are the floor of the scale, not part of its spread.
      // Leaving them in drags the median to zero once the decay has emptied
      // most of the library, and then every song with any points at all sits
      // in the upper half and reads gold-to-green - the rust end becomes
      // unreachable and the weakest song you own looks average.
      if (list[i].attempts && (list[i].score || 0) > 0) vals.push(list[i].score);
    }
    return spreadOf(vals);
  }

  /** The score scale, always against the whole library. */
  function libraryScale() { return buildScale(S.songs); }

  /** Hot days and cold rates each get their own spread, across the library. */
  function heatScales() {
    var hotVals = [], coldVals = [];
    for (var i = 0; i < S.songs.length; i++) {
      var s = S.songs[i];
      if (!s.attempts) continue;
      if (s.hot) hotVals.push(s.hotDays || 0);
      else coldVals.push(s.coldRate || 0);
    }
    return { hot: spreadOf(hotVals), cold: spreadOf(coldVals) };
  }

  function mixColor(a, b, t) {
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function rampColor(v, scale, lo, mid, hi) {
    if (!scale) return SCALE_NONE;
    // a flat scale (everything equal, or one song) has no spread to encode
    if (scale.max === scale.min) return mixColor(mid, mid, 0);
    if (v <= scale.mid) {
      var span = scale.mid - scale.min;
      return mixColor(lo, mid, span <= 0 ? 1 : (v - scale.min) / span);
    }
    var span2 = scale.max - scale.mid;
    return mixColor(mid, hi, span2 <= 0 ? 0 : (v - scale.mid) / span2);
  }

  function scoreColor(song, scale) {
    if (!song.attempts) return SCALE_NONE;
    // nothing left on the board is the low end by definition, scale or no scale
    if (!scale || (song.score || 0) <= 0) return 'rgb(52,88,142)';
    return rampColor(song.score, scale, SCALE_LOW, SCALE_MID, SCALE_HIGH);
  }

  /* ---------- hot / cold ---------- */
  function flameSvg(size) {
    var s = size || 12;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="currentColor">' +
      '<path d="M12.6 2c.5 2.6-.6 4.1-1.9 5.5-1.5 1.7-3.2 3.4-3.2 6.2a6.5 6.5 0 0 0 13 0c0-2.6-1.4-4.3-2.7-6-.8-1-1.4-2-1.4-3.2-1.4.8-2.2 2.1-2.4 3.6C13.4 6 13.3 3.9 12.6 2z"/>' +
      '<path d="M12 14.2c.9.8 1.5 1.6 1.5 2.6a1.6 1.6 0 0 1-3.2 0c0-1 .8-1.8 1.7-2.6z" fill="rgba(255,255,255,0.55)"/>' +
      '</svg>';
  }
  function snowSvg(size) {
    var s = size || 12;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" ' +
      'stroke="currentColor" stroke-width="2.1" stroke-linecap="round">' +
      '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8"/>' +
      '</svg>';
  }

  /** Cold rates can be fractional once the step is tuned below 1. */
  function medianOfPage(vals) {
    if (!vals || !vals.length) return 0;
    var v = vals.slice().sort(function (a, b) { return a - b; });
    var n = v.length;
    return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  }

  function rateText(v) {
    var n = Number(v) || 0;
    return n === Math.round(n) ? String(n) : n.toFixed(1);
  }

  /**
   * The lower half of a song's badge: a flame and the days it stays hot, or a
   * snowflake and what it loses tonight. Both numbers are coloured against
   * their own spread across the library, so "a lot" means a lot compared to
   * everything else you are carrying.
   */
  /* ============================================================
     Medals
     ============================================================ */

  var MEDAL_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
  var MEDAL_TEXT = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
  /* WHAT A TIER IS WORTH, ASKED RATHER THAN KNOWN - 1.63. This was a second
     copy of the server constant, which was harmless for exactly as long as
     neither could change. Both can now, so the page reads the dial and the
     numbers on the medal panel, the badge tooltip and the end-of-run card
     cannot come to disagree with the arithmetic that pays them. */
  var MEDAL_X_DEFAULT = { bronze: 2, silver: 3, gold: 4, platinum: 5 };
  function medalX(tier) {
    var m = S.settings && S.settings.medalMult;
    var v = m ? Number(m[tier]) : NaN;
    return (v >= 0) ? v : (MEDAL_X_DEFAULT[tier] || 1);
  }

  /**
   * The disc, at whatever size the line it sits on can spare.
   *
   * IT IS DRAWN, NOT COLOURED IN CSS. The four medals differ by two stops of a
   * gradient and by nothing else, and a class per medal would put those eight
   * colours somewhere other than the one place that decides what a medal looks
   * like. The ribbon is two triangles behind the disc rather than a separate
   * shape, so the whole thing stays square and drops into a line of text
   * without pushing the line height around.
   */
  /* PLATINUM IS THE ONE TIER THAT IS NOT JUST TWO STOPS - 1.61.
   *
   * It used to be, and at 15px beside a song title it was indistinguishable
   * from silver: both are a grey-white disc with a slightly darker grey rim,
   * and the only thing separating the top of the ladder from the middle of it
   * was about eight percent of lightness. The hardest thing in the app to earn
   * looked like the second-easiest.
   *
   * So platinum gets a COLD BLUE rim rather than a grey one, and two marks the
   * other three do not have: a halo outside the disc and a star where they
   * carry an inner ring. Shape, not just colour - the badge is drawn at 15px
   * on a phone and a hue is the first thing to disappear at that size, while a
   * silhouette survives. The other three are untouched, and the ribbon, the
   * disc and the geometry are still shared, so the tiers still read as one set.
   */
  /* Two stops and, on platinum only, a THIRD entry: the colour the disc fades
     to, held apart from the colour of the rim and the ribbon. Everywhere else
     those are the same and the pair is enough. Platinum needs them separated
     because the rim has to be dark enough to be unmistakable at 15px while the
     face has to stay near-white - a disc filled to the rim colour reads as a
     blue medal, which is a different thing from the coldest metal on the shelf.
     A tier with no third entry fades to its rim colour, as all four used to. */
  var MEDAL_INK = {
    bronze:   ['#C98B5B', '#8A5330'],
    silver:   ['#D8DDE3', '#95A1AE'],
    gold:     ['#E9C765', '#B78D22'],
    platinum: ['#FBFEFF', '#5E8CB8', '#A9CBE6']
  };

  function medalSvg(tier, size) {
    var ink = MEDAL_INK[tier];
    if (!ink) return '';
    var z = size || 15;
    var gid = 'mg-' + tier + '-' + z;
    /* The star is the inner ring for platinum and nothing is stacked on top of
       it, so the middle of the disc never carries two marks at once. */
    var middle = tier === 'platinum'
      ? '<circle cx="12" cy="15.2" r="7.9" fill="none" stroke="' + ink[1] + '" ' +
        'stroke-width="0.7" opacity="0.5"/>' +
        '<path d="M12 10.5l1.25 3.45 3.45 1.25-3.45 1.25L12 19.9l-1.25-3.45' +
        '-3.45-1.25 3.45-1.25z" fill="#FFFFFF" stroke="' + ink[1] + '" ' +
        'stroke-width="0.55" stroke-linejoin="round"/>'
      : '<circle cx="12" cy="15.2" r="4.3" fill="none" stroke="' + ink[0] + '" ' +
        'stroke-width="0.9" opacity="0.85"/>';
    return '<svg class="medal-svg medal-' + tier + '" viewBox="0 0 24 24" width="' + z +
      '" height="' + z + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + ink[0] + '"/>' +
      '<stop offset="1" stop-color="' + (ink[2] || ink[1]) + '"/></linearGradient></defs>' +
      '<path d="M7.4 1.5h3.1L8.2 8.1 5.1 6.6z" fill="' + ink[1] + '"/>' +
      '<path d="M16.6 1.5h-3.1l2.3 6.6 3.1-1.5z" fill="' + ink[1] + '"/>' +
      '<circle cx="12" cy="15.2" r="7.1" fill="url(#' + gid + ')" ' +
      'stroke="' + ink[1] + '" stroke-width="1"/>' +
      middle + '</svg>';
  }

  /**
   * HOW MANY MEDALS DEEP A SONG IS - 0 for none, 4 for platinum.
   *
   * A number rather than a name because the Medals sort has to subtract one
   * from another, and because the tiers are cumulative: the count and the
   * highest tier are the same fact said two ways.
   */
  function medalTierRank(s) {
    var m = s && s.medals;
    if (!m || !m.earned) return 0;
    var r = 0;
    for (var i = 0; i < MEDAL_ORDER.length; i++) if (m.earned[MEDAL_ORDER[i]]) r = i + 1;
    return r;
  }

  /**
   * HOW MUCH WORK IS LEFT BEFORE THE NEXT MEDAL, as one number. Lower is
   * closer; zero means there is nothing above this song to reach for.
   *
   * Summed from the checklist the server already ships for the expanded page,
   * with the weight of each line decided on the server too - see
   * MEDAL_COST_BAND. The page adds up the lines that are not ticked and does
   * not know or care what any one of them is worth, so the sort and the
   * checklist can never come to disagree about which song is nearer.
   *
   * A COUNTED LINE IS PRORATED. "Every game passed on Medium" at 7 of 8 is one
   * game from done and has to sort ahead of the same line at 1 of 8; scoring
   * both as the whole requirement would throw away the one number on the
   * checklist that says how far in you already are.
   *
   * A song whose checklist never arrived returns a number big enough to sink
   * it, rather than a zero that would float it to the front of its band
   * claiming to be finished. Unknown is not the same as done.
   */
  function medalGap(s) {
    var m = s && s.medals;
    if (!m) return 1e6;
    var rank = medalTierRank(s);
    if (rank >= MEDAL_ORDER.length) return 0;        // platinum, nothing above it
    var list = (m.checks || {})[MEDAL_ORDER[rank]] || [];
    if (!list.length) return 1e6;
    var left = 0;
    for (var c = 0; c < list.length; c++) {
      var it = list[c], cost = Number(it.cost) || 0;
      if (it.done) continue;
      if (it.of > 0) left += cost * Math.max(0, it.of - (it.at || 0)) / it.of;
      else left += cost;
    }
    return left;
  }

  /** What a song holds, highest first, or null. */
  function bestMedal(s) {
    var m = s && s.medals;
    if (!m) return null;
    if (m.best) return m.best;
    if (!m.earned) return null;
    var out = null;
    for (var i = 0; i < MEDAL_ORDER.length; i++) {
      if (m.earned[MEDAL_ORDER[i]]) out = MEDAL_ORDER[i];
    }
    return out;
  }

  /**
   * The badge that rides beside a song title.
   *
   * ONLY THE HIGHEST ONE. A row of four discs on a finished song would be four
   * times the ink for one fact - the tiers are cumulative, so a platinum
   * already says that the other three were earned. The expanded page is where
   * the full list belongs, because that is the screen with room to date them.
   */
  function medalBadge(s, size) {
    var tier = bestMedal(s);
    if (!tier) return '';
    return '<span class="medal-badge" title="' +
      esc(MEDAL_TEXT[tier] + ' medal - rest days on this song are worth ' +
          medalX(tier) + ' times the usual share') + '">' +
      medalSvg(tier, size || 15) + '</span>';
  }

  /**
   * The block on the expanded page: every tier, with the day it landed or what
   * is still standing between you and it.
   *
   * The unearned ones are LISTED RATHER THAN HIDDEN. A medal you cannot see is
   * not a goal, and the whole point of the tiers is that they describe a route
   * through a song - eight games across, then up, then the ladder - which only
   * reads as a route if you can see where it goes.
   */
  /**
   * The block on the expanded page: every tier, with the day it landed or a
   * live checklist of what is still standing between you and it.
   *
   * IT IS A CHECKLIST, NOT A SENTENCE - 1.52. It used to be one line of prose
   * per tier listing everything the tier wanted, which is a paragraph you have
   * to re-read and hold in your head every time you come back to it. The
   * requirements are a list of conditions, each independently true or not, and
   * a list of conditions with ticks against them is a thing you can read in a
   * glance and act on. The counted ones carry the count, because "3 of 8" is
   * the difference between nearly there and barely started.
   *
   * The unearned tiers are LISTED RATHER THAN HIDDEN. A medal you cannot see is
   * not a goal, and the whole point of the tiers is that they describe a route
   * through a song - which only reads as a route if you can see where it goes.
   */
  function medalPanel(song, idx) {
    var m = (song && song.medals) || (idx && idx.medals);
    var box = el('div', 'card-block medal-block');
    var head = el('div', 'flex-between');
    head.appendChild(el('div', 'card-title', 'Medals'));
    head.appendChild(infoDot(
      'A medal multiplies the hot share on this song - the slice of a quiz’s ' +
      'points that turns into rest days. Bronze doubles it, silver trebles it, ' +
      'gold is four times and platinum five, so a song you have finished holds ' +
      'its heat far longer off the same run. It never changes the points ' +
      'themselves: those are the record of what you did. Each tier needs every ' +
      'tier below it, so the list only ever fills from the top down.'));
    box.appendChild(head);

    var earned = (m && m.earned) || {};
    var checks = (m && m.checks) || {};
    for (var i = 0; i < MEDAL_ORDER.length; i++) {
      var tier = MEDAL_ORDER[i];
      var at = earned[tier];
      var row = el('div', 'medal-row' + (at ? ' is-earned' : ''));
      row.innerHTML =
        '<span class="medal-row-disc">' + medalSvg(tier, 26) + '</span>' +
        '<span class="medal-row-name">' + MEDAL_TEXT[tier] +
          '<span class="medal-row-mult">hot days &times;' + medalX(tier) + '</span></span>' +
        '<span class="medal-row-when">' +
          (at ? esc(fmtDate(at)) : '<span class="medal-row-todo">not yet</span>') +
        '</span>';
      box.appendChild(row);

      /* An earned tier keeps its date and drops its list. Every line on it is
         ticked by definition, and four columns of ticks under a medal you
         already hold is a lot of ink for "yes, still". */
      if (at) continue;
      var list = checks[tier] || [];
      if (!list.length) continue;
      var ul = el('div', 'medal-checks');
      for (var c = 0; c < list.length; c++) {
        var item = list[c];
        var counted = (item.of !== undefined && item.of > 0 && !item.done);
        ul.innerHTML +=
          '<div class="medal-check' + (item.done ? ' is-done' : '') + '">' +
            '<span class="medal-tick">' + (item.done ? '&#10003;' : '') + '</span>' +
            '<span class="medal-check-say">' + esc(item.label) + '</span>' +
            (counted ? '<span class="medal-check-n">' + item.at + '/' + item.of +
                       '</span>' : '') +
          '</div>';
      }
      box.appendChild(ul);
    }
    var best = bestMedal({ medals: m });
    box.appendChild(el('p', 'form-hint mt-0', best
      ? 'Holding ' + MEDAL_TEXT[best] + '. Rest days on this song are bought at ' +
        medalX(best) + ' times the usual share.'
      : 'No medal yet, so rest days here are bought at the plain rate.'));
    return box;
  }


  function heatChip(s, heat, size) {
    if (!s.attempts) return '<div class="heat-none">&middot;</div>';
    if (s.hot) {
      var d = s.hotDays || 0;
      var hc = rampColor(d, heat.hot, HOT_LOW, HOT_MID, HOT_HIGH);
      return '<div class="heat-chip" style="color:' + hc + '" title="Hot - ' +
        (d === 0 ? 'last day before it starts to cool' : d + ' more day' + (d === 1 ? '' : 's') + ' before it starts to cool') +
        '">' + flameSvg(size) + '<span>' + d + '</span></div>';
    }
    // FROZEN: nothing left to lose and no debt to clear, so there is no
    // number to show - just the flake, on its own.
    if ((s.score || 0) <= 0) {
      return '<div class="heat-chip heat-frozen" title="Frozen - worn all the way down. ' +
        'It owes nothing, so any quiz at all starts it moving again.">' +
        snowSvg(size) + '</div>';
    }
    var r = s.coldRate || 0;
    var cc = rampColor(r, heat.cold, COLD_LOW, COLD_MID, COLD_HIGH);
    return '<div class="heat-chip" style="color:' + cc + '" title="Cold - loses ' +
      rateText(r) + ' point' + (r === 1 ? '' : 's') + ' tonight, and more every night after' +
      '">' + snowSvg(size) + '<span>' + rateText(r) + '</span></div>';
  }

  function route() { return S.stack[S.stack.length - 1]; }

  /* ---------- where you were on the page ----------
   *
   * WHAT THE BACK ARROW OWES YOU IS THE PLACE YOU LEFT, not the top of the
   * list. Forty songs is several screens; opening the thirty-first, looking at
   * it and coming back used to put you at the top with the thirty-first
   * somewhere below the fold, so every song you opened cost a scroll back to
   * where you already were.
   *
   * The offset is written onto the STACK ENTRY rather than kept in one variable
   * per view, because the stack is already the thing that knows what you have
   * come through. Push a new screen and it starts at the top by construction -
   * a fresh entry has no offset on it - and pop back to one and its offset is
   * still sitting there. Two visits to the same list from different places
   * therefore keep their own places, which one variable per view could not.
   *
   * IT IS STASHED AT THE MOMENT OF NAVIGATION, not on a scroll listener. The
   * listener is the tidier-looking version and it was written first: record the
   * offset continuously and the restore needs nothing but a read. It is also
   * the version that cannot be checked here, because scroll events do not fire
   * in the harness browser at all - and the listener has a real failure mode
   * that needs checking, since emptying the container collapses the document,
   * the browser clamps the offset to zero, and the event for THAT clamp would
   * overwrite the position a moment before it was going to be restored. An
   * untestable guard against an invisible bug is not a thing to ship.
   *
   * Stashing at the two places that navigate is deterministic, needs no guard,
   * and is verifiable. It costs one thing - a repaint that nobody asked for
   * would restore a stale offset - so repaintIfSafe stashes for itself first.
   * Those are all the callers there are.
   */
  function scrollNow() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }
  function stashScroll() {
    var r = route();
    if (r) r.scrollY = scrollNow();
  }
  function go(view, params, replace) {
    stashScroll();                  // where this screen was, for the way back
    if (replace) S.stack[S.stack.length - 1] = { view: view, params: params || {} };
    else S.stack.push({ view: view, params: params || {} });
    render();
  }
  function back() {
    if (S.stack.length > 1) { S.stack.pop(); render(); }
    else go('front', {}, true);
  }
  function resetTo(view, params) { S.stack = [{ view: view, params: params || {} }]; render(); }

  backBtn.addEventListener('click', function () { guardCreditRun(back); });
  window.addEventListener('beforeunload', function (ev) {
    if (!S.creditRun && !S.settingsDirty) return;
    ev.preventDefault();
    ev.returnValue = '';
  });
  document.getElementById('settingsBtn').addEventListener('click', function () { go('settings'); });
  var tabBtns = document.querySelectorAll('.tab-btn');
  for (var ti = 0; ti < tabBtns.length; ti++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.getAttribute('data-view');
        guardCreditRun(function () {
          // tapping the shelf you are already standing at opens the shelf menu
          if (want === 'library' && route().view === 'library') {
            openListSheet(function () { render(); });
            return;
          }
          resetTo(want);
        });
      });
    })(tabBtns[ti]);
  }

  var TITLES = {
    front: 'Front Burner', back: 'Back Burner', library: 'Pantry',
    add: 'Add Song', edit: 'Edit Song', detail: 'Song Sheet',
    quiz: 'Quiz', results: 'Results', insights: 'Insights', settings: 'Settings'
  };
  /* One view serves both shelves, so its name has to come from what is on it
     rather than from the route. It said Quiz over every game in the app. */
  function titleFor(r) {
    if (r.view !== 'quiz') return TITLES[r.view] || 'Song Burner';
    var p = r.params || {};
    if (p.mode) return isGame(p.mode) ? 'Game' : 'Quiz';
    if (p.kind === 'game') return 'Game';
    if (p.kind === 'quiz') return 'Quiz';
    return 'Play';
  }

  var VIEWS = {};

  function render() {
    var r = route();
    var isTab = TABS.indexOf(r.view) !== -1;
    // Any non-tab screen gets a back arrow. Saving an edit resets the stack to
    // a single entry, which used to leave you on the song sheet with no tab bar
    // and no way out; back() falls through to the front burner in that case.
    backBtn.hidden = isTab;
    tabbar.style.display = isTab ? 'flex' : 'none';
    for (var i = 0; i < tabBtns.length; i++) {
      var on = tabBtns[i].getAttribute('data-view') === r.view;
      if (on) tabBtns[i].classList.add('active'); else tabBtns[i].classList.remove('active');
    }
    titleEl.textContent = titleFor(r);
    stopGameClock();              // never let a countdown outlive its screen
    appEl.innerHTML = '';
    (VIEWS[r.view] || VIEWS.front)(r.params);
    /* Back to where this screen was standing, or the top if it has never been
       stood on. A view that paints asynchronously - the song sheet waits on its
       lyrics - lands at the top either way, which is right: there is nothing
       below the fold yet to go back to. */
    window.scrollTo(0, r.scrollY || 0);
  }

  function buildFooter() {
    var f = el('div', 'footer-build', 'BUILD ' + esc(S.build));
    appEl.appendChild(f);
  }

  /* ---------- performance tiers ---------- */
  function agoText(days) {
    if (days === null || days === undefined) return '';
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    var mo = Math.round(days / 30);
    return mo + (mo === 1 ? ' month ago' : ' months ago');
  }
  var MODE_SHORT = {
    verseSort: 'v-sort', verseOrder: 'v-order', lineSort: 'l-sort',
    lineOrder: 'l-order', firstLine: '1st lines', wordScramble: 'scramble',
    wordImpostor: 'w-impostor', lineImpostor: 'l-impostor',
    firstLines: 'openings', easy: 'easy', medium: 'med', hard: 'hard', blind: 'blind'
  };
  /**
   * Move a song between the burners. The two are mutually exclusive: putting
   * a song on one takes it off the other, and tapping the burner it is
   * already on drops it back to being library-only.
   */
  function setBurner(song, role, after) {
    var target = listByRole(role);
    var other = listByRole(role === 'front' ? 'back' : 'front');
    if (!target) { toast('No ' + role + ' burner list'); return; }

    var ids = (song.listIds || []).slice();
    var wasOn = ids.indexOf(target.id) !== -1;
    var next = [];
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] === target.id) continue;
      if (other && ids[i] === other.id) continue;
      next.push(ids[i]);
    }
    if (!wasOn) next.push(target.id);

    var before = song.listIds;
    song.listIds = next;
    if (after) after();
    api('setSongLists', { id: song.id, listIds: next })
      .then(function () {
        toast(wasOn ? 'Off the ' + role + ' burner' : 'Moved to the ' + role + ' burner');
      })
      .catch(function (e) {
        song.listIds = before;
        if (after) after();
        toast('Not saved: ' + e.message);
      });
  }

  /** hot / cold / frozen / untouched, as one word. */
  function heatState(s) {
    if (!s.attempts) return '';
    if (s.hot) return 'hot';
    return (s.score || 0) <= 0 ? 'frozen' : 'cold';
  }

  /**
   * THE PROGRESS STRIP, in the space the old "80% openings - today" line held.
   *
   * Eight pips, in family pairs, one per game, then the quiz badge. Two things
   * are encoded on each, because two things matter and there is only room for
   * one row:
   *
   *   HEIGHT is how far you have unlocked - a third, two thirds, or full.
   *   FILL is today: solid means a scoring run is still there for the taking,
   *   hollow means you have already spent it.
   *
   * Reading it takes a second and tells you what a whole song sheet used to:
   * which games you have earned your way into, and where there is credit left
   * on the table today. The old line said your last percentage and when, which
   * the log now says properly and at length.
   */
  /**
   * The quiz ladder: FOUR rungs, one per rung of the quiz shelf, filling from
   * the bottom as far as you have earned and going hollow once the day's quiz
   * is spent. Four, not five - the two Beginner quizzes are one tier and unlock
   * together, so a fifth rung would be a step you can never be standing on.
   *
   * It gets a column of its own, the same height as the burner stack opposite,
   * because that space was empty and a ladder is the one thing on a song card
   * that is worth drawing tall.
   */
  /**
   * WHAT YOU HAVE EARNED ON THIS SONG, in one labelled block.
   *
   * Four rows, because there are four game families and four quiz rungs and
   * they line up.
   *
   * BOTH SIDES CLIMB THE SAME WAY: hardest at the top. The quiz ladder has
   * always run Hard down to Beginner, and the families used to run the other
   * way - Order first, because that is the order the picker lays them out in -
   * so the two halves of the same block disagreed about which direction was
   * up. They read Impostor / Scramble / Build / Order now, top to bottom,
   * which is roughly how much of the song each one asks you to know, and it
   * puts the two hardest things in the block on the same line.
   *
   *   |pips| H     Impostor  / Hard
   *   |pips| M     Scramble  / Medium
   *   |pips| E     Build     / Easy
   *   |pips| B     Order     / Beginner
   *
   * 1.43 labelled the rows with initials - O B S I down one side, H M E B down
   * the other - on the reasoning that eight anonymous pips have to be counted
   * before they can be read. Kyle looked at it and took them off again: eight
   * characters of scaffolding around a block small enough to learn in a day,
   * and the tooltips already name every one of them on hover. The shape is the
   * label.
   *
   * PIP HEIGHT AND COLOUR BOTH SAY THE LEVEL, blue-gold-red climbing, so it
   * survives being read in grey. Hollow means today is already spent on that
   * game. On the quiz side the earned rung is coloured and the rest are muted;
   * when the day is spent the colour goes but the height you reached stays
   * legible, because that is the one fact the ladder is for.
   */
  function progressStrip(s) {
    if (!s.attempts && !s.usedQuiz) {
      // never opened: nothing earned, everything available, and saying so with
      // eight empty pips would be noise
      return '<div class="prog-grid"><span class="prog-new">not started</span></div>';
    }
    var fams = S.families || [];
    var qt = quizTier(s);
    var spent = quizUsed(s);
    var rows = Math.max(fams.length, QUIZ_TIER_NAME.length);
    var html = '<div class="prog-grid' + (spent ? ' prog-used' : '') + '">';

    /* THE STRIP READS THE WAY THE MENUS DO - 1.52a.
     *
     * Order at the top and Impostor at the bottom, Beginner at the top and Hard
     * at the bottom - the order the game picker lays its four family cards out
     * in, and the order the quiz shelf stacks its rungs in.
     *
     * 1.43b had both halves climbing from the bottom instead, on the argument
     * that the two sides of the block should agree about which direction was
     * "up". They did agree - with each other, and with nothing else in the app.
     * The block is a miniature of two screens you look at every day, and a
     * miniature that runs the other way up from the thing it depicts costs a
     * mental flip every single time. Agreeing with the menus is worth more than
     * agreeing with an abstraction about difficulty.
     */
    for (var r = 0; r < rows; r++) {
      var fam = fams[r];
      html += '<span class="prog-row">';
      html += '<span class="prog-fam">';
      if (fam) {
        for (var m = 0; m < S.modes.length; m++) {
          var mo = S.modes[m];
          if (mo.family !== fam.id) continue;
          var lv = unlockedLevel(s, mo.id);
          var used = gameUsed(s, mo.id);
          /* A GAME NOT YET REACHED IS NOT AN EASY ONE. The ladder falls back
             to Easy when nothing has been banked, so without this the shut
             games on a brand new song would all paint as open at Easy - which
             is the one thing the strip is there to tell you apart. */
          var shut = gameShut(s, mo.id);
          /* ONE SEGMENT PER LEVEL UNLOCKED, TOP DOWN - 1.62b.
             Drawn hardest-first because the stack is a column and the bottom of
             it has to be Easy; read bottom-up it climbs the way the ladder does.
             Each segment asks levelClean about ITS OWN level rather than about
             the pip's, which is the whole change: the width used to describe
             the top rung and say nothing at all about the two under it. */
          var seg = '', cleanAt = [];
          if (shut) {
            seg = '<span class="prog-seg prog-shut"></span>';
          } else {
            for (var L = levelIdx(lv); L >= 0; L--) {
              var segLv = LEVELS[L];
              var segClean = levelClean(s, mo.id, segLv);
              if (segClean) cleanAt.unshift(LEVEL_LABEL[segLv]);
              seg += '<span class="prog-seg prog-' + lv +
                     (segClean ? ' seg-clean' : '') + '"></span>';
            }
          }
          html += '<span class="prog-pip' + (used ? ' prog-used' : '') +
            '" title="' + esc(mo.label + ' - ' + (shut
              ? 'not open yet'
              : LEVEL_LABEL[lv] + ' unlocked, ' +
                (cleanAt.length ? '100% at ' + cleanAt.join(' and ')
                                : 'nothing at 100% yet') +
                ', ' + (used ? 'taken today' : 'open today'))) +
            '">' + seg + '</span>';
        }
      }
      html += '</span>';

      /* Beginner first, descending - the same order as the families beside it
         and as the quiz picker itself. The COLOUR still belongs to the rung
         rather than to the position, so Beginner is blue and Hard is red on
         every card whichever way the stack is drawn, and two cards can still be
         compared without counting. */
      var t = r;
      if (t < QUIZ_TIER_NAME.length) {
        html += '<span class="prog-rung rung-' + t + (t <= qt ? ' on' : '') +
          '" title="' + esc(QUIZ_TIER_NAME[t] + ' quiz - ' +
            (t <= qt ? 'unlocked' : 'not yet earned') + ', ' +
            (spent ? 'today already taken' : 'today still open')) + '"></span>';
      } else {
        html += '<span class="prog-rung"></span>';
      }
      html += '</span>';
    }
    return html + '</div>';
  }

  function songCard(s, opts) {
    opts = opts || {};
    // The paper the card is printed on says hot or cold before you read
    // anything on it. Frozen counts as cold - it is the far end of cold, not a
    // third thing.
    var state = heatState(s);
    var card = el('div', 'tape-card' +
      (state === 'hot' ? ' is-hot' : state ? ' is-cold' : '') +
      (state === 'frozen' ? ' is-frozen' : ''));
    var color = scoreColor(s, opts.scale);
    // The days-left tail is gone: the flame or snowflake underneath the score
    // now says the same thing, and says it better.
    /* The strip moved OUT of the title block and alongside it. Under the title
       it was squeezing the one thing on the card you actually read - the song
       name - into a smaller and smaller band, and it never needed the width. */
    card.innerHTML =
      '<div class="heat-col">' +
        '<div class="score-plate" style="background:' + color + '">' +
          (s.attempts ? Math.round(s.score) : '&ndash;') + '</div>' +
        heatChip(s, opts.heat || {}) +
      '</div>' +
      '<div class="tape-card-info">' +
        /* THE MEDAL SITS IN THE TITLE LINE, not above it and not on its own
           row. It is a property of the song in the same way the name is, and
           at fifteen pixels it rides the cap height without taking a band of
           the card away from the one thing on it you actually read. */
        '<div class="tape-card-title">' + medalBadge(s, 15) + esc(s.title) +
        (s.needsChorusTag ? ' <span style="color:var(--gold)">&#9873;</span>' : '') + '</div>' +
        '<div class="tape-card-artist">' + esc(s.artist || 'Unknown artist') + '</div>' +
      '</div>' +
      progressStrip(s);

    if (opts.manual) {
      var nav = el('div', 'reorder-btns');
      var up = el('button', 'reorder-btn', '&#9650;');
      var down = el('button', 'reorder-btn', '&#9660;');
      up.disabled = opts.index === 0;
      down.disabled = opts.index === opts.total - 1;
      up.addEventListener('click', function (ev) { ev.stopPropagation(); opts.onMove(opts.index, -1); });
      down.addEventListener('click', function (ev) { ev.stopPropagation(); opts.onMove(opts.index, 1); });
      nav.appendChild(up);
      nav.appendChild(down);
      card.appendChild(nav);
    }

    var acts = el('div', 'card-actions');

    var frontBtn = el('button', 'act-btn');
    var backBtn = el('button', 'act-btn');
    function paintBurners() {
      var onF = onList(s, listByRole('front'));
      var onB = onList(s, listByRole('back'));
      frontBtn.className = 'act-btn act-front' + (onF ? ' on' : '');
      frontBtn.innerHTML = noteSvg(false, 17);
      frontBtn.title = onF ? 'Take off the front burner' : 'Move to the front burner';
      backBtn.className = 'act-btn act-back' + (onB ? ' on' : '');
      backBtn.innerHTML = noteSvg(true, 17);
      backBtn.title = onB ? 'Take off the back burner' : 'Move to the back burner';
    }
    paintBurners();
    frontBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      // repaint in place; a full render would scroll back to the top
      setBurner(s, 'front', function () { paintBurners(); if (opts.onChange) opts.onChange(); });
    });
    backBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setBurner(s, 'back', function () { paintBurners(); if (opts.onChange) opts.onChange(); });
    });
    /* ONE COLUMN OF THREE. Back on top, front below - the way you look down at
       a stove - and the lists button under both of them rather than off to the
       side, so the corner is a single stack instead of a stack with a
       passenger. It also costs one column instead of two, which is width the
       song title gets back on a phone. */
    var stack = el('div', 'burner-stack');
    stack.appendChild(backBtn);
    stack.appendChild(frontBtn);
    acts.appendChild(stack);

    var listBtn = el('button', 'act-btn act-lists');
    function paintLists() {
      var n = customListCount(s);
      listBtn.innerHTML = listsSvg() + (n ? '<span class="act-count">' + n + '</span>' : '');
      listBtn.className = 'act-btn act-lists' + (n ? ' on' : '');
      listBtn.title = n ? 'On ' + n + ' custom list' + (n === 1 ? '' : 's') : 'Add to a list';
    }
    paintLists();
    stack.appendChild(listBtn);
    listBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      openListPicker(s, function () { paintLists(); if (opts.onChange) opts.onChange(); });
    });

    card.appendChild(acts);
    card.addEventListener('click', function () { go('detail', { id: s.id }); });
    return card;
  }

  /* ---------- custom list picker ---------- */
  function openListPicker(song, after) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title', 'Lists for ' + esc(song.title)));
    var host = el('div');
    sheet.appendChild(host);

    function draw() {
      host.innerHTML = '';
      var cl = customLists();
      if (!cl.length) {
        host.appendChild(el('p', 'form-hint mt-0', 'No custom lists yet.'));
      }
      for (var i = 0; i < cl.length; i++) {
        (function (l) {
          var on = onList(song, l);
          var row = el('label', 'checkbox-row');
          row.innerHTML = '<input type="checkbox"' + (on ? ' checked' : '') + '><span>' +
            esc(l.name) + '</span>';
          row.querySelector('input').addEventListener('change', function (ev) {
            var want = ev.target.checked;
            var ids = (song.listIds || []).slice();
            var at = ids.indexOf(l.id);
            if (want && at === -1) ids.push(l.id);
            if (!want && at !== -1) ids.splice(at, 1);
            song.listIds = ids;
            if (after) after();
            api('toggleList', { songId: song.id, listId: l.id, on: want })
              .catch(function (e) { toast('Not saved: ' + e.message); });
          });
          host.appendChild(row);
        })(cl[i]);
      }
    }
    draw();

    var newBtn = el('button', 'btn btn-outline btn-sm btn-block', '+ New list');
    newBtn.style.marginTop = '10px';
    newBtn.addEventListener('click', function () {
      var name = prompt('Name this list');
      if (!name || !name.trim()) return;
      api('createList', { name: name.trim() }).then(function (l) {
        S.lists.push(l);
        var ids = (song.listIds || []).slice();
        ids.push(l.id);
        song.listIds = ids;
        draw();
        if (after) after();
        return api('toggleList', { songId: song.id, listId: l.id, on: true });
      }).catch(function (e) { toast(e.message); });
    });
    sheet.appendChild(newBtn);

    var done = el('button', 'btn btn-primary btn-sm btn-block', 'Done');
    done.style.marginTop = '8px';
    done.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(done);

    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /* ============================================================
     Dashboard
     ============================================================ */
  function burnerView(role) {
    var dl = listByRole(role);
    var mine = [];
    if (dl) {
      for (var i = 0; i < S.songs.length; i++) {
        if ((S.songs[i].listIds || []).indexOf(dl.id) !== -1) mine.push(S.songs[i]);
      }
    }

    var wrap = el('div');
    wrap.appendChild(el('p', 'section-eyebrow',
      role === 'front' ? 'Cooking now' : 'Simmering'));
    wrap.appendChild(el('h2', 'section-title',
      esc(dl ? dl.name : (role === 'front' ? 'Front Burner' : 'Back Burner')) +
      (mine.length ? '  &mdash;  ' + mine.length : '')));

    if (S.songs.length === 0) {
      // An import on record but zero songs back is a contradiction: it means the
      // read came up empty, not that the library is empty. Never dress that up
      // as a fresh-start screen.
      if (S.lastImport) {
        wrap.innerHTML +=
          '<div class="card-block"><div class="card-title">No songs came back</div>' +
          '<p class="form-hint mt-0">The Sheet says you imported on ' + esc(S.lastImport) +
          ', but this load returned nothing. That is a read failing, not your songbook ' +
          'disappearing - it lives in the Sheet, not on this device.</p></div>';
        var retry = el('button', 'btn btn-primary btn-block', 'Reload');
        retry.addEventListener('click', function () { boot(1); });
        wrap.appendChild(retry);
      } else {
        wrap.innerHTML += '<div class="empty-state"><span class="eyebrow-mark">Nothing here yet</span>' +
          'Import your songbook from Google Docs to get started.</div>';
        var imp = el('button', 'btn btn-gold btn-block', 'Import from Doc');
        imp.addEventListener('click', function () { go('settings'); });
        wrap.appendChild(imp);
      }
      appEl.appendChild(wrap);
      buildFooter();
      return;
    }

    var scoreSum = 0;
    for (var j = 0; j < mine.length; j++) scoreSum += (mine[j].score || 0);
    // averaged over everything on the burner, so parking dead weight here shows
    var avgPts = mine.length ? scoreSum / mine.length : 0;

    /**
     * Average accuracy across the burner, for one level or all of them.
     * Averaged per SONG rather than per attempt, so ten runs at one song
     * cannot drown out the other nine on the burner.
     */
    function avgAccuracy(mode) {
      var sum = 0, n = 0;
      for (var a = 0; a < mine.length; a++) {
        if (!mine[a].attempts) continue;
        var v = mode === 'all' ? mine[a].avgAccuracy : (mine[a].modeAcc || {})[mode];
        if (v === undefined || v === null) continue;
        sum += v; n++;
      }
      return n ? { pct: Math.round(sum / n), songs: n } : null;
    }

    function accLabel(id) {
      if (id === 'all') return 'Average accuracy';
      var m = modeById(id);
      return 'Avg on ' + (m ? (m.full || m.label) : id);
    }

    /* Every level's number is shown right in the picker - choosing one blind
       and then reading it off the card takes two steps to learn one thing. */
    function openAccSheet() {
      var back = el('div', 'sheet-backdrop');
      var sheet = el('div', 'sheet');
      sheet.appendChild(el('div', 'card-title', 'Average accuracy for'));
      var opts = [{ id: 'all', label: 'Overall' }];
      for (var o = 0; o < S.modes.length; o++) {
        opts.push({ id: S.modes[o].id, label: S.modes[o].full || S.modes[o].label });
      }
      for (var p2 = 0; p2 < opts.length; p2++) {
        (function (op) {
          var r = avgAccuracy(op.id);
          var b = el('button', 'mode-card' + (S.accFilter === op.id ? ' on' : ''));
          b.type = 'button';
          b.innerHTML =
            '<div class="mode-pts">' + (r ? r.pct + '%' : '&mdash;') + '</div>' +
            '<div class="mode-body"><div class="mode-name">' + esc(op.label) + '</div>' +
            '<div class="mode-blurb">' +
            (r ? 'across ' + r.songs + ' song' + (r.songs === 1 ? '' : 's') + ' on this burner'
               : 'never played at this level here') +
            '</div></div>';
          b.addEventListener('click', function () {
            S.accFilter = op.id;
            back.remove();
            paintAcc();
          });
          sheet.appendChild(b);
        })(opts[p2]);
      }
      var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
      cancel.addEventListener('click', function () { back.remove(); });
      sheet.appendChild(cancel);
      back.appendChild(sheet);
      back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
      document.body.appendChild(back);
    }

    var accCard = el('button', 'stat-card stat-card-btn');
    accCard.type = 'button';
    function paintAcc() {
      var r = avgAccuracy(S.accFilter);
      accCard.innerHTML =
        '<div class="stat-value">' + (r ? r.pct + '%' : '&mdash;') + '</div>' +
        '<div class="stat-label">' + esc(accLabel(S.accFilter)) +
        ' <span class="stat-caret">&#9660;</span></div>';
    }
    paintAcc();
    accCard.addEventListener('click', openAccSheet);

    /**
     * Median time across the burner for one level on one device.
     *
     * There is deliberately no "overall" here. A game is timed per verse and
     * a quiz per word, so averaging Blind against Line Sort would produce a
     * number with no unit at all. You pick a level or you get nothing.
     */
    function avgTime(mode, device) {
      var vals = [];
      for (var a = 0; a < mine.length; a++) {
        var v = (mine[a].timeMed || {})[mode + '|' + device];
        if (v) vals.push(v);
      }
      return vals.length ? { secs: Math.round(medianOfPage(vals)), songs: vals.length } : null;
    }

    function timeDevice() { return S.timeFilter.device || timingDevice(); }

    /** The level with the most songs behind it, so the card opens on something. */
    function bestTimeMode(device) {
      var best = null, bestN = 0;
      for (var m = 0; m < S.modes.length; m++) {
        var r = avgTime(S.modes[m].id, device);
        if (r && r.songs > bestN) { bestN = r.songs; best = S.modes[m].id; }
      }
      return best;
    }

    /* One sheet, two choices - which is the honest version of the double
       dropdown: device across the top, level underneath, both visible at once
       rather than nested inside each other. */
    function openTimeSheet() {
      var back = el('div', 'sheet-backdrop');
      var sheet = el('div', 'sheet');
      sheet.appendChild(el('div', 'card-title', 'Average time on'));

      var seg = el('div', 'seg-row');
      var devs = [['phone', 'Phone or tablet'], ['desktop', 'PC']];
      for (var d = 0; d < devs.length; d++) {
        (function (dv) {
          var b = el('button', 'seg-btn' + (timeDevice() === dv[0] ? ' on' : ''), dv[1]);
          b.type = 'button';
          b.addEventListener('click', function () {
            S.timeFilter.device = dv[0];
            back.remove();
            openTimeSheet();
          });
          seg.appendChild(b);
        })(devs[d]);
      }
      sheet.appendChild(seg);

      var dev = timeDevice();
      var any = false;
      for (var m2 = 0; m2 < S.modes.length; m2++) {
        (function (mo) {
          var r = avgTime(mo.id, dev);
          if (!r) return;
          any = true;
          var b = el('button', 'mode-card' + (S.timeFilter.mode === mo.id ? ' on' : ''));
          b.type = 'button';
          b.innerHTML =
            '<div class="mode-pts">' + fmtClock(r.secs) + '</div>' +
            '<div class="mode-body"><div class="mode-name">' + esc(mo.label) + '</div>' +
            '<div class="mode-blurb">across ' + r.songs + ' song' + (r.songs === 1 ? '' : 's') +
            ', per ' + (mo.unit || 'word') + '</div></div>';
          b.addEventListener('click', function () {
            S.timeFilter.mode = mo.id;
            back.remove();
            paintTime();
          });
          sheet.appendChild(b);
        })(S.modes[m2]);
      }
      if (!any) {
        sheet.appendChild(el('p', 'form-hint mt-0',
          'Nothing on this burner has been timed on ' + esc(timingLabel(dev)) + ' yet.'));
      }
      var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
      cancel.addEventListener('click', function () { back.remove(); });
      sheet.appendChild(cancel);
      back.appendChild(sheet);
      back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
      document.body.appendChild(back);
    }

    var timeCard = el('button', 'stat-card stat-card-btn');
    timeCard.type = 'button';
    function paintTime() {
      var dev = timeDevice();
      if (!S.timeFilter.mode) S.timeFilter.mode = bestTimeMode(dev);
      var r = S.timeFilter.mode ? avgTime(S.timeFilter.mode, dev) : null;
      var mo = S.timeFilter.mode ? modeById(S.timeFilter.mode) : null;
      timeCard.innerHTML =
        '<div class="stat-value">' + (r ? fmtClock(r.secs) : '&mdash;') + '</div>' +
        '<div class="stat-label">' +
        (mo ? esc(mo.label) + ' on ' + esc(timingLabel(dev)) : 'Average time') +
        ' <span class="stat-caret">&#9660;</span></div>';
    }
    paintTime();
    timeCard.addEventListener('click', openTimeSheet);

    var grid = el('div', 'stat-grid');
    grid.innerHTML =
      '<div class="stat-card"><div class="stat-value">' + scoreSum.toFixed(1) + '</div><div class="stat-label">Total points</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + avgPts.toFixed(1) + '</div><div class="stat-label">Average points</div></div>';
    grid.appendChild(timeCard);
    grid.appendChild(accCard);
    wrap.appendChild(grid);

    if (mine.length === 0) {
      wrap.innerHTML += '<div class="empty-state"><span class="eyebrow-mark">Nothing on this burner</span>' +
        'Open the Pantry and tap a note on any song to move it here.</div>';
      var toLib = el('button', 'btn btn-primary btn-block', 'Open the Pantry');
      toLib.addEventListener('click', function () { resetTo('library'); });
      wrap.appendChild(toLib);
      appEl.appendChild(wrap);
      buildFooter();
      return;
    }

    var randRow = el('div', 'random-row random-row-3');
    var randSong = el('button', 'btn btn-gold', 'Random Song');
    randSong.addEventListener('click', function () {
      var pick = mine[Math.floor(Math.random() * mine.length)];
      go('detail', { id: pick.id });
    });

    /* Pick the game first, then the song - a mode that needs three sections
       cannot be offered a two-section song, so the choice has to come first
       for the pool to be filtered against it. */
    /**
     * Pick the game, let the app pick the song, then choose the level and
     * whether it counts. The song has to be drawn AFTER the game because a
     * mode that needs three sections cannot be offered a two-section song -
     * and the levels have to come after the song because what is unlocked, and
     * what is already spent today, belong to that song.
     */
    function randomOfKind(kind) {
      openModeSheet(function (mode) {
        var needsThree = (mode === 'verseSort' || mode === 'verseOrder');
        var pool = [];
        for (var i = 0; i < mine.length; i++) {
          if (needsThree && (mine[i].sectionCount || 0) < 3) continue;
          pool.push(mine[i]);
        }
        if (!pool.length) { toast('Nothing on this burner can be played that way'); return; }
        var pick = pool[Math.floor(Math.random() * pool.length)];
        if (kind === 'quiz') { go('quiz', { id: pick.id, kind: 'quiz' }); return; }
        openRandomLevelSheet(pick, mode);
      }, kind);
    }

    var randGame = el('button', 'btn btn-primary', 'Random Game');
    randGame.addEventListener('click', function () { randomOfKind('game'); });
    var randQuiz = el('button', 'btn btn-primary', 'Random Quiz');
    randQuiz.addEventListener('click', function () { randomOfKind('quiz'); });

    randRow.appendChild(randSong);
    randRow.appendChild(randGame);
    randRow.appendChild(randQuiz);
    wrap.appendChild(randRow);

    var list = el('div', 'song-list');

    function drawMine() {
      var srt = sortFor(role), mode = srt.mode;
      var q = (S.search[role] || '').trim().toLowerCase();
      var shown = [];
      for (var f = 0; f < mine.length; f++) {
        if (matchesFilter(mine[f], q)) shown.push(mine[f]);
      }
      sortSongs(shown, mode, srt.dir);
      var scale = libraryScale();
      var heat = heatScales();
      list.innerHTML = '';
      if (!shown.length) {
        list.innerHTML = '<div class="empty-state">Nothing on this burner matches that.</div>';
        return;
      }
      for (var k = 0; k < shown.length; k++) {
        list.appendChild(songCard(shown[k], {
          scale: scale,
          heat: heat,
          manual: mode === 'manual',
          index: k,
          total: shown.length,
          onMove: function (i, dir) { moveSong(shown, i, dir, drawMine); },
          // moving a song off this burner means it leaves the list, so the
          // list redraws - but only the list, which keeps your scroll position
          onChange: function () {
            var next = [];
            var dl2 = listByRole(role);
            for (var q = 0; q < mine.length; q++) {
              if (dl2 && (mine[q].listIds || []).indexOf(dl2.id) !== -1) next.push(mine[q]);
            }
            mine = next;
            drawMine();
          }
        }));
      }
    }

    wrap.appendChild(filterBar(role, drawMine));
    wrap.appendChild(list);
    drawMine();

    appEl.appendChild(wrap);
    buildFooter();
  }

  VIEWS.front = function () { burnerView('front'); };
  VIEWS.back  = function () { burnerView('back'); };

  /* ============================================================
     Pantry
     ============================================================ */
  VIEWS.library = function () {
    var wrap = el('div');
    wrap.appendChild(el('p', 'section-eyebrow', S.songs.length + ' songs'));
    wrap.appendChild(el('h2', 'section-title', 'Pantry'));

    /* The shelf menu also opens by tapping Pantry while already on the Pantry,
       which nothing on screen could ever tell you - so it hangs off a bar that
       says what you are looking at and how much of it there is. */
    var listBar = el('button', 'list-bar');
    listBar.type = 'button';
    function paintListBar(n) {
      listBar.innerHTML =
        '<span class="list-bar-name">' + esc(currentListName()) + '</span>' +
        '<span class="list-bar-n">' + n + '</span>' +
        '<span class="list-bar-caret">&#9660;</span>';
    }
    listBar.addEventListener('click', function () {
      openListSheet(function () { render(); });
    });
    wrap.appendChild(listBar);

    var chips = el('div', 'chip-row');
    wrap.appendChild(chips);
    var manage = el('div', 'manage-row');
    wrap.appendChild(manage);
    var bar = el('div');
    wrap.appendChild(bar);
    var list = el('div', 'song-list');
    wrap.appendChild(list);
    appEl.appendChild(wrap);

    function drawChips() {
      chips.innerHTML = '';
      var all = el('button', 'chip' + (S.activeListId === null ? ' active' : ''), 'All Songs');
      all.addEventListener('click', function () { S.activeListId = null; drawChips(); drawManage(); drawBar(); drawList(); });
      chips.appendChild(all);
      for (var i = 0; i < S.lists.length; i++) {
        (function (l) {
          var c = el('button', 'chip' + (S.activeListId === l.id ? ' active' : ''),
                     esc(l.name) + (l.role ? ' <span class="chip-role">' + esc(l.role) + '</span>' : ''));
          c.addEventListener('click', function () { S.activeListId = l.id; drawChips(); drawManage(); drawBar(); drawList(); });
          chips.appendChild(c);
        })(S.lists[i]);
      }
      var add = el('button', 'chip chip-dashed', '+ New List');
      add.addEventListener('click', function () {
        var name = prompt('Name this list');
        if (!name || !name.trim()) return;
        api('createList', { name: name.trim() }).then(function (l) {
          S.lists.push(l); S.activeListId = l.id; drawChips(); drawManage(); drawBar(); drawList(); toast('List created');
        }).catch(function (e) { toast(e.message); });
      });
      chips.appendChild(add);
    }

    function promote(l, role) {
      api('setListRole', { id: l.id, role: role }).then(function () {
        return refreshIndex();
      }).then(function () {
        drawChips(); drawManage(); drawBar(); drawList();
        toast(l.name + ' is now the ' + role + ' burner');
      }).catch(function (e) { toast(e.message); });
    }

    function drawManage() {
      manage.innerHTML = '';
      if (S.activeListId === null) return;
      var l = null;
      for (var i = 0; i < S.lists.length; i++) if (S.lists[i].id === S.activeListId) l = S.lists[i];
      if (!l) return;

      if (!l.role) {
        var gig = el('button', 'btn btn-primary btn-sm gig-launch', 'Set List View');
        gig.addEventListener('click', function () { openSetList(l); });
        manage.appendChild(gig);
      }

      var ren = el('button', 'text-link-btn', 'Rename');
      ren.addEventListener('click', function () {
        var name = prompt('Rename list', l.name);
        if (!name || !name.trim()) return;
        api('renameList', { id: l.id, name: name.trim() }).then(function () {
          l.name = name.trim(); drawChips(); drawManage(); toast('Renamed');
        }).catch(function (e) { toast(e.message); });
      });
      manage.appendChild(ren);

      if (!l.role) {
        var mkF = el('button', 'text-link-btn', 'Make this the Front Burner');
        mkF.addEventListener('click', function () { promote(l, 'front'); });
        manage.appendChild(mkF);
        var mkB = el('button', 'text-link-btn', 'Make this the Back Burner');
        mkB.addEventListener('click', function () { promote(l, 'back'); });
        manage.appendChild(mkB);

        var del = el('button', 'text-link-btn text-link-danger', 'Delete list');
        del.addEventListener('click', function () {
          if (!confirm('Delete "' + l.name + '"? Songs stay in your library.')) return;
          api('deleteList', { id: l.id }).then(function () {
            var next = [];
            for (var i = 0; i < S.lists.length; i++) if (S.lists[i].id !== l.id) next.push(S.lists[i]);
            S.lists = next;
            for (var j = 0; j < S.songs.length; j++) {
              var ids = S.songs[j].listIds || [], keep = [];
              for (var k = 0; k < ids.length; k++) if (ids[k] !== l.id) keep.push(ids[k]);
              S.songs[j].listIds = keep;
            }
            S.activeListId = null; drawChips(); drawManage(); drawBar(); drawList(); toast('List deleted');
          }).catch(function (e) { toast(e.message); });
        });
        manage.appendChild(del);
      }
    }

    /* THE BAR IS BOUND TO A SHELF, NOT TO THE PANTRY. Each shelf keeps its own
       sort - the Freezer opens on most-practiced while Everything opens on
       strongest - so switching shelves has to rebuild this, not just redraw
       the list under it. drawBar is called wherever the shelf changes. */
    function drawBar() {
      bar.innerHTML = '';
      bar.appendChild(filterBar(pantryScope(), drawList));
    }

    function drawList() {
      var f = (S.search.library || '').trim().toLowerCase();
      var out = [];
      for (var i = 0; i < S.songs.length; i++) {
        var s = S.songs[i];
        if (S.activeListId !== null && (s.listIds || []).indexOf(S.activeListId) === -1) continue;
        if (!onSmartList(s, S.smartList)) continue;
        if (!matchesFilter(s, f)) continue;
        out.push(s);
      }
      var srt = sortFor(pantryScope()), mode = srt.mode;
      sortSongs(out, mode, srt.dir);
      var own = S.activeListId !== null ? listById(S.activeListId) : null;
      if (own && own.role) own = null;            // the burners keep sortIndex
      if (own && mode === 'manual') {
        var shownIds = {};
        for (var o = 0; o < out.length; o++) shownIds[out[o].id] = true;
        var ordered = listSongs(own);
        out = [];
        for (var o2 = 0; o2 < ordered.length; o2++) {
          if (shownIds[ordered[o2].id]) out.push(ordered[o2]);
        }
      }
      // against the whole library, so a colour means the same thing here as it
      // does on a burner or inside a filtered list
      var scale = libraryScale();
      var heat = heatScales();

      list.innerHTML = '';
      paintListBar(out.length);
      if (out.length === 0) {
        list.innerHTML = '<div class="empty-state">Nothing on this shelf matches that.</div>';
        return;
      }
      for (var j = 0; j < out.length; j++) {
        list.appendChild(songCard(out[j], {
          scale: scale,
          heat: heat,
          manual: mode === 'manual',
          index: j,
          total: out.length,
          onMove: function (i, dir) {
            if (!own) { moveSong(out, i, dir, drawList); return; }
            // moved within the WHOLE list, so a filter on screen cannot
            // reshuffle the songs it is hiding
            var all = listSongs(own), a = out[i], b = out[i + dir];
            if (!b) return;
            var ia = all.indexOf(a), ib = all.indexOf(b);
            all[ia] = b; all[ib] = a;
            saveListOrder(own, all);
            drawList();
          },
          onChange: function () { if (S.activeListId !== null) drawList(); }
        }));
      }
    }

    drawChips(); drawManage(); drawBar(); drawList();
    buildFooter();
  };

  /* ============================================================
     Set List View - 1.70
     ------------------------------------------------------------
     A screen for playing a gig off, not for practising. One song at a time,
     in the list's own order: the title, the capo and key as large as they can
     reasonably be, and the FIRST LINE of every section in song order - enough
     to find your way in, never the whole lyric, because a lyric sheet on a
     stand is exactly the crutch the rest of the app is weaning you off.

     It covers the app rather than being a route, so the header, the tab bar
     and the Apps Script chrome are all gone while it is up, and closing it
     drops you back on the list exactly where you were.

     Moving on: the two big buttons, a swipe, or the keyboard - arrows,
     Page Up / Page Down and the space bar, which is what a Bluetooth page-turn
     pedal sends. The running order opens over the stage; drag a song by its
     handle to move it, tap one to go straight to it. A reorder is saved to the
     list as soon as you let go, and the song on stage stays on stage.

     The capo pill lights up when it differs from the song before, because
     a capo change between songs is the thing most worth seeing coming.
     ============================================================ */
  var GIG_SIZES = [1, 1.2, 1.45];

  function gigShortLabel(label) {
    var s = String(label || '');
    if (s.indexOf('Verse') === 0) return 'V' + s.slice(5).replace(/ /g, '');
    if (s.indexOf('Chorus') === 0) return 'Ch' + s.slice(6).replace(/ /g, '');
    return s;
  }
  function firstLineOf(sec) {
    var ls = (sec && sec.lines) || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].t) return ls[i].t;
    return '';
  }
  /** The capo and key a song should show: the full song when it is here,
      else the index, which carries both since 1.70. */
  function gigKey(idx) {
    var full = S.cache[idx.id];
    var src = full && full.capo !== undefined ? full : idx;
    var c = src.capo;
    return { playKey: src.playKey || '', capo: (c === null || c === undefined || c === '') ? null : Number(c) };
  }

  function openSetList(list) {
    var songs = listSongs(list);
    if (!songs.length) { toast('Nothing on this list yet'); return; }
    var at = 0;
    var sizeAt = Number(lsGet('gigSize')) || 0;
    if (sizeAt < 0 || sizeAt >= GIG_SIZES.length) sizeAt = 0;

    var root = el('div', 'gig');
    root.setAttribute('role', 'dialog');
    root.innerHTML =
      '<div class="gig-top">' +
        '<button class="gig-btn gig-x" type="button" aria-label="Close">&#10005;</button>' +
        '<div class="gig-where"><div class="gig-list"></div><div class="gig-pos"></div></div>' +
        '<button class="gig-btn gig-size" type="button" aria-label="Text size">Aa</button>' +
        '<button class="gig-btn gig-order-btn" type="button">&#9776; Order</button>' +
      '</div>' +
      '<div class="gig-stage"></div>' +
      '<div class="gig-foot">' +
        '<button class="gig-nav gig-prev" type="button"></button>' +
        '<button class="gig-nav gig-next" type="button"></button>' +
      '</div>' +
      '<div class="gig-drawer">' +
        '<div class="gig-drawer-head"><span>Running order</span>' +
          '<button class="gig-btn gig-drawer-x" type="button">Done</button></div>' +
        '<div class="gig-rows"></div>' +
      '</div>';
    document.body.appendChild(root);
    document.documentElement.className += ' gig-lock';

    var stage = root.querySelector('.gig-stage');
    var prevBtn = root.querySelector('.gig-prev'), nextBtn = root.querySelector('.gig-next');
    var drawer = root.querySelector('.gig-drawer'), rowsEl = root.querySelector('.gig-rows');
    root.querySelector('.gig-list').innerHTML = esc(list.name);

    function applySize() { root.style.setProperty('--gig-scale', GIG_SIZES[sizeAt]); }
    applySize();

    function keyPills(i) {
      var k = gigKey(songs[i]);
      var c = k.capo || 0;
      var before = i > 0 ? (gigKey(songs[i - 1]).capo || 0) : 0;
      var change = i > 0 && c !== before;
      var h = '';
      if (c || k.capo === 0 || change) {
        h += '<span class="gig-pill gig-capo' + (change ? ' gig-change' : '') + '">' +
             (c ? 'Capo ' + ROMAN[c] : 'No capo') + '</span>';
      }
      if (k.playKey) {
        h += '<span class="gig-pill">' + (c ? 'Playing ' : 'Key ') + keyText(k.playKey) + '</span>';
        if (c) h += '<span class="gig-pill gig-sound">Sounds ' + keyText(soundingKey(k.playKey, c)) + '</span>';
      }
      return h ? '<div class="gig-keys">' + h + '</div>' : '';
    }
    function keyBrief(i) {
      var k = gigKey(songs[i]), c = k.capo || 0, bits = [];
      if (c) bits.push('Capo ' + ROMAN[c]);
      if (k.playKey) bits.push(keyText(k.playKey));
      return bits.join(' &middot; ');
    }

    function cuesHtml(song) {
      if (!song || !song.sections) return '<div class="gig-wait">&hellip;</div>';
      var secs = song.sections, labels = labelSections(secs), h = '';
      for (var i = 0; i < secs.length; i++) {
        var sec = secs[i];
        if (sec.type === 'marker') {
          /* A repeat is shown where it falls, and with its words when there is
             exactly one section it can mean. */
          var hit = null, n = 0;
          for (var j = 0; j < secs.length; j++) {
            if (secs[j].type !== 'marker' &&
                String(labels[j]).toLowerCase() === String(sec.ref || '').toLowerCase()) {
              hit = secs[j]; n++;
            }
          }
          if (n !== 1 && String(sec.ref || '').toLowerCase() === 'chorus') {
            hit = null; n = 0;
            for (var k = 0; k < secs.length; k++) if (secs[k].type === 'chorus') { hit = secs[k]; n++; }
          }
          h += '<div class="gig-cue gig-cue-repeat"><span class="gig-cue-label">&#8635;</span>' +
               '<span class="gig-cue-line">' + esc(sec.ref || 'Repeat') +
               (n === 1 && firstLineOf(hit) ? ' <span class="gig-cue-dim">' + esc(firstLineOf(hit)) + '</span>' : '') +
               '</span></div>';
          continue;
        }
        var line = firstLineOf(sec);
        if (!line) continue;
        h += '<div class="gig-cue' + (sec.type === 'chorus' ? ' gig-cue-chorus' : '') + '">' +
             '<span class="gig-cue-label">' + esc(gigShortLabel(labels[i])) + '</span>' +
             '<span class="gig-cue-line">' + esc(line) + '</span></div>';
      }
      return h;
    }

    function paint(dir) {
      var s = songs[at];
      root.querySelector('.gig-pos').innerHTML = (at + 1) + ' / ' + songs.length;
      stage.className = 'gig-stage' + (dir ? (dir > 0 ? ' gig-in-next' : ' gig-in-prev') : '');
      stage.innerHTML =
        '<div class="gig-num">' + (at + 1) + '</div>' +
        '<h1 class="gig-title">' + esc(s.title) + '</h1>' +
        (s.artist ? '<div class="gig-artist">' + esc(s.artist) + '</div>' : '') +
        keyPills(at) +
        '<div class="gig-cues">' + cuesHtml(S.cache[s.id]) + '</div>';
      stage.scrollTop = 0;
      prevBtn.disabled = at === 0;
      prevBtn.innerHTML = at > 0
        ? '<span class="gig-nav-dir">&#9664; Back</span><span class="gig-nav-name">' + esc(songs[at - 1].title) + '</span>'
        : '<span class="gig-nav-dir">Top of the set</span>';
      nextBtn.disabled = at === songs.length - 1;
      if (at < songs.length - 1) {
        var kb = keyBrief(at + 1);
        nextBtn.innerHTML = '<span class="gig-nav-dir">Next &#9654;</span>' +
          '<span class="gig-nav-name">' + esc(songs[at + 1].title) + '</span>' +
          (kb ? '<span class="gig-nav-key">' + kb + '</span>' : '');
      } else {
        nextBtn.innerHTML = '<span class="gig-nav-dir">End of the set</span>';
      }
      if (drawer.className.indexOf('open') !== -1) drawRows();
    }
    function go2(i) {
      if (i < 0 || i >= songs.length || i === at) return;
      var dir = i > at ? 1 : -1;
      at = i;
      paint(dir);
    }

    /* ---- the songs themselves: whatever is cached now, the rest in one
            round trip (two for a very long set), repainting as they land ---- */
    function fetchMissing() {
      var want = [];
      for (var i = 0; i < songs.length; i++) {
        var id = songs[i].id;
        if (S.cache[id]) continue;
        var stored = lsGet('song.' + id);
        if (stored && stored.sections) { S.cache[id] = stored; continue; }
        want.push(id);
      }
      for (var b = 0; b < want.length; b += 60) {
        api('getSongs', { ids: want.slice(b, b + 60) }).then(function (got) {
          for (var g = 0; g < got.length; g++) {
            S.cache[got[g].id] = got[g];
            lsSet('song.' + got[g].id, got[g]);
          }
          if (root.parentNode) paint(0);
        }).catch(function (e) { toast(e.message); });
      }
    }

    /* ---- running order: tap to jump, drag the handle to move ---- */
    function drawRows() {
      rowsEl.innerHTML = '';
      for (var i = 0; i < songs.length; i++) {
        (function (s, n) {
          var row = el('div', 'gig-row' + (n === at ? ' is-now' : n < at ? ' is-done' : ''));
          row.setAttribute('data-id', s.id);
          var kb = keyBrief(n);
          row.innerHTML =
            '<span class="gig-row-n">' + (n + 1) + '</span>' +
            '<span class="gig-row-body"><span class="gig-row-title">' + esc(s.title) + '</span>' +
            (kb ? '<span class="gig-row-key">' + kb + '</span>' : '') + '</span>' +
            '<span class="gig-handle" aria-label="Drag to move">&#8801;</span>';
          row.querySelector('.gig-row-body').addEventListener('click', function () {
            closeDrawer();
            go2(n);
          });
          dragHandle(row, row.querySelector('.gig-handle'));
          rowsEl.appendChild(row);
        })(songs[i], i);
      }
    }
    function dragHandle(row, handle) {
      handle.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
        var y0 = ev.clientY, scroll0 = rowsEl.scrollTop, base = row.offsetTop;
        row.className += ' is-drag';
        function move(e) {
          var box = rowsEl.getBoundingClientRect();
          if (e.clientY < box.top + 40) rowsEl.scrollTop -= 10;
          else if (e.clientY > box.bottom - 40) rowsEl.scrollTop += 10;
          var want = base + (e.clientY - y0) + (rowsEl.scrollTop - scroll0);
          var mid = want + row.offsetHeight / 2;
          // as many places as the finger has travelled, not one per event -
          // a quick flick crosses three rows between two pointermoves
          for (var guard = 0; guard < 200; guard++) {
            var prev = row.previousElementSibling, next = row.nextElementSibling;
            if (next && mid > next.offsetTop + next.offsetHeight / 2) rowsEl.insertBefore(next, row);
            else if (prev && mid < prev.offsetTop + prev.offsetHeight / 2) rowsEl.insertBefore(row, prev);
            else break;
          }
          row.style.transform = 'translateY(' + (want - row.offsetTop) + 'px)';
        }
        /* On the window, not the handle: a release that lands anywhere else -
           or a capture the browser declined - must still end the drag. */
        function up() {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          row.style.transform = '';
          var ids = [], byId = {}, nowId = songs[at].id, changed = false;
          for (var i = 0; i < songs.length; i++) byId[songs[i].id] = songs[i];
          var kids = rowsEl.children;
          for (var k = 0; k < kids.length; k++) ids.push(kids[k].getAttribute('data-id'));
          var next = [];
          for (var m = 0; m < ids.length; m++) {
            next.push(byId[ids[m]]);
            if (ids[m] !== songs[m].id) changed = true;
          }
          if (changed) {
            songs = next;
            at = songs.indexOf(byId[nowId]);
            saveListOrder(list, songs);
          }
          paint(0);
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }
    function openDrawer() { drawRows(); drawer.className = 'gig-drawer open'; }
    function closeDrawer() { drawer.className = 'gig-drawer'; }

    /* ---- moving on ---- */
    prevBtn.addEventListener('click', function () { go2(at - 1); });
    nextBtn.addEventListener('click', function () { go2(at + 1); });
    root.querySelector('.gig-order-btn').addEventListener('click', openDrawer);
    root.querySelector('.gig-drawer-x').addEventListener('click', closeDrawer);
    root.querySelector('.gig-size').addEventListener('click', function () {
      sizeAt = (sizeAt + 1) % GIG_SIZES.length;
      lsSet('gigSize', sizeAt);
      applySize();
    });
    var sx = null, sy = null;
    stage.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go2(at + (dx < 0 ? 1 : -1));
    });
    function onKey(e) {
      var k = e.key;
      if (k === 'Escape') {
        if (drawer.className.indexOf('open') !== -1) closeDrawer(); else close();
        return;
      }
      if (drawer.className.indexOf('open') !== -1) return;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') {
        e.preventDefault(); go2(at + 1);
      } else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') {
        e.preventDefault(); go2(at - 1);
      }
    }
    document.addEventListener('keydown', onKey);

    /* The screen staying on matters more on a stand than anywhere else in the
       app. Asked for, and quietly done without where the browser says no. */
    var wake = null;
    function holdScreen() {
      try {
        if (navigator.wakeLock && document.visibilityState === 'visible') {
          navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {});
        }
      } catch (e) {}
    }
    document.addEventListener('visibilitychange', holdScreen);
    holdScreen();

    function close() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', holdScreen);
      try { if (wake) wake.release(); } catch (e) {}
      document.documentElement.className =
        document.documentElement.className.replace(' gig-lock', '');
      root.remove();
      render();                // the list may have been reordered underneath
    }
    root.querySelector('.gig-x').addEventListener('click', close);

    paint(0);
    fetchMissing();
  }

  /* ============================================================
     Capo and key
     ------------------------------------------------------------
     Two things are entered - the shapes your hands make and the fret the capo
     sits on - and the third is worked out: the sounding key is the playing key
     moved up a semitone a fret. It is never stored, so it cannot disagree with
     the two it comes from. Sharps and flats are spelled the way a key is
     usually written (Eb, not D#), minor kept minor.
     ============================================================ */
  var KEY_PLAY_MAJOR = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var KEY_PLAY_MINOR = ['Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
  var KEY_SOUND_MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var KEY_SOUND_MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  function keyPitch(k) {
    var s = String(k || '');
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[s.charAt(0)];
    if (base === undefined) return null;
    var rest = s.slice(1);
    if (rest.charAt(0) === '#') { base++; rest = rest.slice(1); }
    else if (rest.charAt(0) === 'b') { base--; rest = rest.slice(1); }
    return { pc: (base + 12) % 12, minor: rest === 'm' };
  }
  function soundingKey(playKey, capo) {
    var k = keyPitch(playKey);
    if (!k) return '';
    var c = Number(capo) || 0;
    if (!c) return String(playKey);
    return (k.minor ? KEY_SOUND_MINOR : KEY_SOUND_MAJOR)[(k.pc + c) % 12];
  }
  /** A key as it should read: the real flat and sharp signs, escaped. */
  function keyText(k) {
    var s = String(k || ''), a = s.charAt(1);
    if (a === '#') s = s.charAt(0) + String.fromCharCode(9839) + s.slice(2);
    else if (a === 'b') s = s.charAt(0) + String.fromCharCode(9837) + s.slice(2);
    return esc(s);
  }
  /** The songbook's own capo line, which the key strip now speaks for. */
  function isCapoMeta(m) {
    return String(m || '').replace(/^ +/, '').toLowerCase().indexOf('capo') === 0;
  }
  /** One line for the song header, or '' when nothing has been set. */
  function keyLineHtml(song) {
    var pk = song.playKey || '', c = Number(song.capo) || 0;
    if (!pk && !c) return '';
    var parts = [];
    if (pk) parts.push((c ? 'Playing ' : 'Key ') + '<b>' + keyText(pk) + '</b>');
    if (c) parts.push('Capo <b>' + ROMAN[c] + '</b>');
    if (pk && c) parts.push('Sounding <b>' + keyText(soundingKey(pk, c)) + '</b>');
    return '<div class="detail-key">' + parts.join('<span class="key-dot">&middot;</span>') + '</div>';
  }

  /* ============================================================
     Song detail
     ============================================================ */
  VIEWS.detail = function (p) {
    var idx = songById(p.id);
    if (!idx) { go('library', {}, true); return; }
    appEl.innerHTML = '<div class="loading">Loading ' + esc(idx.title) + '...</div>';

    loadSong(p.id).then(function (song) {
      appEl.innerHTML = '';
      var wrap = el('div');
      var metaShown = [];
      for (var mi = 0; mi < (song.meta || []).length; mi++) {
        if (!isCapoMeta(song.meta[mi])) metaShown.push(song.meta[mi]);
      }
      /* THE HEADER SAYS WHAT THE CARD SAYS. Opening a song used to lose every
         fact the library row had been telling you about it - the score, whether
         it was hot or cold and by how much, how far up each ladder you had got -
         and left a black box with the title in it. Same plate, same heat chip,
         same earned-progress block, so the song reads the same way whichever
         screen you are looking at it on. */
      var hState = heatState(idx);
      var head = el('div', 'detail-header' +
        (hState === 'hot' ? ' is-hot' : hState ? ' is-cold' : '') +
        (hState === 'frozen' ? ' is-frozen' : ''));
      var top = el('div', 'detail-top');
      top.innerHTML =
        '<div class="heat-col">' +
          /* THE SAME SCALE THE CARD USES. scoreColor with no scale falls back
             to the frozen blue - the sensible answer for a song with nothing
             on the board, and quite wrong for one with 111 points on it. The
             header was the only plate in the app drawn without a scale, so a
             song that read hot orange on the burner turned blue the moment you
             opened it. Percentile colours mean nothing at all unless every
             screen spreads them across the same population - the whole
             pantry - which is what libraryScale is for. */
          '<div class="score-plate" style="background:' +
            scoreColor(idx, libraryScale()) + '">' +
            (idx.attempts ? Math.round(idx.score) : '&ndash;') + '</div>' +
          heatChip(idx, {}) +
        '</div>' +
        '<div class="detail-name">' +
          '<h2 class="detail-title">' + medalBadge(idx, 21) + esc(song.title) + '</h2>' +
          (song.artist ? '<div class="detail-artist">' + esc(song.artist) + '</div>' : '') +
          keyLineHtml(song) +
          (metaShown.length ? '<div class="detail-meta">' + esc(metaShown.join('  |  ')) + '</div>' : '') +
        '</div>' +
        progressStrip(idx);
      head.appendChild(top);
      if (song.youtube || song.spotify) {
        var links = '<div class="link-row">';
        if (song.youtube) links += '<a class="link-chip" href="' + esc(song.youtube) + '" target="_blank" rel="noopener">&#9654; YouTube</a>';
        if (song.spotify) links += '<a class="link-chip" href="' + esc(song.spotify) + '" target="_blank" rel="noopener">&#9834; Spotify</a>';
        links += '</div>';
        head.innerHTML += links;
      }

      /* The burners and the lists live on the bar, in the corner they occupy on
         a library row, rather than in a second tray underneath it. */
      var headActs = el('div', 'card-actions detail-card-actions');
      var backBtn = el('button', 'act-btn');
      var frontBtn = el('button', 'act-btn');
      function paintBurnerBtns() {
        var onF = onList(idx, listByRole('front'));
        var onB = onList(idx, listByRole('back'));
        frontBtn.className = 'act-btn act-front' + (onF ? ' on' : '');
        frontBtn.innerHTML = noteSvg(false, 17);
        frontBtn.title = onF ? 'Take off the front burner' : 'Move to the front burner';
        backBtn.className = 'act-btn act-back' + (onB ? ' on' : '');
        backBtn.innerHTML = noteSvg(true, 17);
        backBtn.title = onB ? 'Take off the back burner' : 'Move to the back burner';
      }
      paintBurnerBtns();
      frontBtn.addEventListener('click', function () { setBurner(idx, 'front', paintBurnerBtns); });
      backBtn.addEventListener('click', function () { setBurner(idx, 'back', paintBurnerBtns); });
      // back on top, front below - the way you look down at a stove
      var bstack = el('div', 'burner-stack');
      bstack.appendChild(backBtn);
      bstack.appendChild(frontBtn);
      headActs.appendChild(bstack);

      var listsBtn = el('button', 'act-btn act-lists');
      function paintListsBtn() {
        var n = customListCount(idx);
        listsBtn.className = 'act-btn act-lists' + (n ? ' on' : '');
        listsBtn.innerHTML = listsSvg() + (n ? '<span class="act-count">' + n + '</span>' : '');
        listsBtn.title = n ? 'On ' + n + ' custom list' + (n === 1 ? '' : 's') : 'Add to a list';
      }
      paintListsBtn();
      listsBtn.addEventListener('click', function () { openListPicker(idx, paintListsBtn); });
      bstack.appendChild(listsBtn);
      top.appendChild(headActs);
      wrap.appendChild(head);

      /* ONE ROW OF FOUR. The two things you came here to do are wide and equal;
         the two you occasionally reach for are narrower and equal. They used to
         be two separate trays stacked on each other, which cost a whole band of
         the first screen before any lyric appeared. */
      var acts = el('div', 'detail-acts');
      var gameBtn = el('button', 'btn btn-primary act-wide', 'Start Game');
      gameBtn.addEventListener('click', function () {
        go('quiz', { id: song.id, kind: 'game' });
      });
      var quizBtn = el('button', 'btn btn-gold act-wide', 'Start Quiz');
      quizBtn.addEventListener('click', function () {
        go('quiz', { id: song.id, kind: 'quiz' });
      });
      acts.appendChild(gameBtn);
      acts.appendChild(quizBtn);

      if (S.docUrl) {
        var docBtn = el('a', 'btn btn-outline act-narrow');
        docBtn.href = S.docUrl + (idx.headingId ? '#heading=' + idx.headingId : '');
        docBtn.target = '_blank';
        docBtn.rel = 'noopener';
        docBtn.innerHTML = bookSvg() + '<span>Songbook</span>';
        docBtn.title = idx.headingId
          ? 'Open the songbook at this song'
          : 'Open the songbook (no anchor for this song yet - re-import to add one)';
        acts.appendChild(docBtn);
      }

      var editBtn = el('button', 'btn btn-outline act-narrow', 'Edit');
      editBtn.title = 'Edit this song';
      editBtn.addEventListener('click', function () { go('edit', { id: song.id }); });
      acts.appendChild(editBtn);
      wrap.appendChild(acts);

      // No songbook set means nowhere to write it, so the button is not offered
      // rather than offered and failing.
      if (idx.source !== 'doc' && S.docUrl) {
        var toDoc = el('button', 'btn btn-outline btn-block', 'Add this to the songbook doc');
        toDoc.style.marginBottom = '16px';
        toDoc.addEventListener('click', function () {
          if (!confirm('Write "' + song.title + '" into the songbook doc?' + NL + NL +
                       'It gets appended at the end, formatted the way the doc does it - ' +
                       'bold heading, artist underneath, choruses indented.')) return;
          toDoc.disabled = true;
          toDoc.textContent = 'Writing...';
          api('appendToDoc', { id: song.id }).then(function (r) {
            idx.source = 'doc';
            dropSong(song.id);
            toDoc.replaceWith(el('div', 'import-done',
              '<div class="import-done-head">Added to the songbook</div>' +
              '<p class="form-hint mt-0">' + esc(r.title) + ' is now at the end of the doc, ' +
              r.lines + ' lines, set in ' + esc(String(r.font)) + ' at ' + r.size + 'pt' +
              (r.shrunk ? ', shrunk to hold one page' : '') +
              '. Re-importing will match it by title and skip it.</p>'));
            toast('Written to the songbook');
          }).catch(function (e) {
            toDoc.disabled = false;
            toDoc.textContent = 'Add this to the songbook doc';
            toast(e.message);
          });
        });
        wrap.appendChild(toDoc);
      }

      if (song.needsChorusTag) {
        var banner = el('div', 'tag-chorus-banner');
        banner.innerHTML = '<strong>Which block is the chorus?</strong><br>' +
          'This song says "Chorus" further down but the chorus was never indented in the doc, ' +
          'so it came in as an ordinary verse. Tap the right one and it will be remembered.';
        wrap.appendChild(banner);
      }

      var hasChords = false;
      for (var hc = 0; hc < song.sections.length; hc++) {
        var ls = song.sections[hc].lines || [];
        for (var hl = 0; hl < ls.length; hl++) if (ls[hl].c) hasChords = true;
      }

      var sheetHead = el('div', 'flex-between');
      sheetHead.appendChild(el('p', 'section-eyebrow', 'Lyric sheet'));
      var headBtns = el('div', 'sheet-head-btns');
      if (hasChords) {
        var chordBtn = el('button', 'text-link-btn', S.hideChords ? 'Show chords' : 'Hide chords');
        chordBtn.addEventListener('click', function () {
          S.hideChords = !S.hideChords;
          chordBtn.textContent = S.hideChords ? 'Show chords' : 'Hide chords';
          var cs = wrap.querySelectorAll('.chord-line');
          for (var q = 0; q < cs.length; q++) cs[q].style.display = S.hideChords ? 'none' : 'block';
        });
        headBtns.appendChild(chordBtn);
      }
      var heatBtn = el('button', 'text-link-btn',
                       S.heatOn ? 'Hide heatmap' : 'Show heatmap');
      heatBtn.addEventListener('click', function () {
        S.heatOn = !S.heatOn;
        render();               // the lines are built differently either way
      });
      headBtns.appendChild(heatBtn);
      sheetHead.appendChild(headBtns);
      wrap.appendChild(sheetHead);

      /* WHAT THE MAP KNOWS, SAID IN WORDS. Untested has to read as untested
         rather than as fine, and the weakest verse is NAMED rather than shaded
         because a verse standing is a share of its words and shares are rarely
         extreme - it would be a tint you could not see for weeks. Naming it
         points without aggregating, which is the rule this screen keeps: it
         may show you where to look, never give you a figure to clear. */
      if (S.heatOn) {
        var hsum = heatSummary(song);
        wrap.appendChild(el('p', 'form-hint mt-0 heat-note', hsum.seen
          ? 'Painted from ' + hsum.seen + ' of ' + hsum.total + ' words' +
            (hsum.worst ? '  &middot;  weakest: ' + esc(hsum.worst) : '')
          : 'Nothing tested yet. Take a quiz on this song and the shading fills in.'));
      }
      var heatMap = S.heatOn ? heatIndexMap(song) : null;

      var labels = labelSections(song.sections);
      for (var i = 0; i < song.sections.length; i++) {
        (function (sec, n) {
          if (sec.type === 'marker') {
            var chip = el('div', 'marker-chip', esc(sec.ref) + '  &#8635;');
            wrap.appendChild(chip);
            return;
          }
          var box = el('div', 'lyric-sheet' + (sec.type === 'chorus' ? ' lyric-sheet-chorus' : ''));
          box.appendChild(el('div', 'lyric-sheet-label', labels[n]));

          /* THE THREE LAYERS STACK, deliberately. A weak word in a solid verse
             gets a light tint; a weak word, in a line you keep misplacing, in a
             verse you have never got through cleanly, gets all three and
             becomes the darkest thing on the page - which is exactly where the
             eye should be pulled. The finest grain is also the most confident,
             so it earns the most ink. */
          var hs = heatMap ? heatSection(song, heatMap[n]) : null;
          if (hs && hs.verse) {
            var va = heatAlpha(hs.verse, hs.verse[2], HEAT_MAX_VERSE);
            if (va) box.style.background = heatInk(va);
          }
          // heat addresses non-empty lines only, so it counts them separately
          var tAt = 0;
          for (var j = 0; j < sec.lines.length; j++) {
            var ln = sec.lines[j];
            var row = el('div', 'lyric-row');
            if (ln.c) {
              var cl = el('div', 'chord-line', esc(ln.c));
              if (S.hideChords) cl.style.display = 'none';
              row.appendChild(cl);
            }
            if (ln.t) {
              var hLine = (hs && hs.lines) ? hs.lines[tAt] : null;
              var hWords = (hs && hs.words) ? hs.words[tAt] : null;
              row.appendChild(el('div', 'lyric-line', heatLineHtml(ln.t, hLine, hWords)));
              if (hLine) {
                var la = heatAlpha(hLine, hLine[2], HEAT_MAX_LINE);
                if (la) row.style.background = heatInk(la);
              }
              tAt++;
            }
            box.appendChild(row);
          }
          if (song.needsChorusTag && sec.type === 'verse') {
            var pick = el('button', 'tag-pick-btn', 'This is the chorus');
            pick.addEventListener('click', function () {
              api('tagChorus', { id: song.id, index: n }).then(function () {
                dropSong(song.id);
                idx.needsChorusTag = false;
                toast('Chorus tagged');
                render();
              }).catch(function (e) { toast(e.message); });
            });
            box.appendChild(pick);
          }
          wrap.appendChild(box);
        })(song.sections[i], i);
      }

      /* BELOW THE LYRICS, with the Score card and the attempt log rather than
         above them. Kyle's call, and the right one: the top of this screen is
         what you came here to do - play, quiz, read the words - and the medals
         are a record of what you have already done. They belong with the rest
         of the record, not between you and the song. */
      wrap.appendChild(medalPanel(song, idx));

      if (song.history && song.history.length) {
        var cfg = song.scoring || S.settings;
        var card = el('div', 'card-block');
        var head2 = el('div', 'flex-between');
        head2.appendChild(el('div', 'card-title', 'Score'));
        // the explanation lives behind this rather than sprawling on the page
        head2.appendChild(infoDot(
          'Each quiz banks points for the mode you picked, but only above ' +
          cfg.floor + '% accuracy - at or below that a run is worth nothing, and ' +
          'from there it climbs straight to the full value at 100%. ' +
          'A quiz also makes the song HOT, for ' + (cfg.hotPct || 10) + '% of the points ' +
          'banked, in days. Hot songs lose nothing. When the flame runs out the song ' +
          'goes COLD and starts losing ' + cfg.decay + ' a night, then twice that, then ' +
          'three times - neglect compounds. Practising a cold song pays that rate ' +
          'down before it buys any hot days back. You have banked ' +
          song.totalEarned + ' points on this song all told.'));
        card.appendChild(head2);

        // the card badge again, at reading size
        var hv = {
          attempts: (song.history || []).length, score: song.score,
          hot: song.hot, hotDays: song.hotDays, coldRate: song.coldRate
        };
        var stateWord;
        if (song.hot) {
          stateWord = song.hotDays > 0
            ? 'hot for ' + song.hotDays + ' more day' + (song.hotDays === 1 ? '' : 's')
            : 'hot, but only for today';
        } else if (song.score > 0) {
          stateWord = 'cold, losing ' + rateText(song.coldRate) + ' tonight';
        } else {
          stateWord = 'frozen - any quiz at all restarts it';
        }

        var srow = el('div', 'mastery-head');
        srow.innerHTML =
          '<div class="heat-col heat-col-lg">' +
            '<div class="score-plate" style="background:' + scoreColor(hv, libraryScale()) + '">' +
              Math.round(song.score) + '</div>' +
            heatChip(hv, heatScales(), 15) +
          '</div>' +
          '<div><div class="mastery-word">' + esc(stateWord) + '</div>' +
          '<div class="insight-song-sub">last quizzed ' + esc(agoText(song.daysSince)) +
          '  &middot;  ' + song.totalEarned + ' earned all time</div></div>';
        card.appendChild(srow);

        card.appendChild(el('div', 'card-title', 'Score over time'));
        card.appendChild(scoreChart(song.curve || []));
        wrap.appendChild(card);
      }

      if (song.times && song.times.length) {
        var scfg = song.scoring || S.settings;
        // one prior run is all the timer box needs to unlock, so the dot marks
        // every bucket that has one
        var tbl = paceTable(song.times, scfg.speedMod ? 1 : 0, 'median');
        if (tbl) {
          var tc = el('div', 'card-block');
          var thd = el('div', 'flex-between');
          thd.appendChild(el('div', 'card-title', 'Pace on this song'));
          thd.appendChild(infoDot(
            'Your median time at each quiz level, phone and PC kept apart ' +
            'because they are not the same measurement. The small number is ' +
            'how many runs are behind it. Games are not timed.' +
            (scfg.speedMod
              ? ' A dot means the timer box is unlocked for that level here, so ' +
                'you can choose to let your pace move what a run banks.'
              : ' Pace is set to information only, so none of it is touching your score.')));
          tc.appendChild(thd);
          tc.appendChild(tbl);
          wrap.appendChild(tc);
        }
      }

      /* THE LOG, NOT A CHART.
         This used to be a sparkline per mode behind a dropdown, which meant
         three taps to answer "how did that go last Tuesday". Twelve modes never
         belonged on one line anyway - 100% on Sort Verses and 88% on Medium are
         not the same measurement - so plotting them was always a bit of a lie.
         A plain reverse-chronological log tells you more and hides nothing. */
      if (song.history && song.history.length) {
        var hist = el('div', 'card-block');
        var hHead = el('div', 'flex-between');
        hHead.appendChild(el('div', 'card-title',
          'Attempts  (' + song.history.length + ' total)'));
        hist.appendChild(hHead);

        var filterRow = el('div', 'log-filters');

        /* Which kinds are actually in this song's history - offering "Order
           Lines" on a song you have only ever quizzed is a menu full of empty
           choices. */
        var seen = {};
        for (var sm = 0; sm < song.history.length; sm++) seen[song.history[sm].mode] = true;
        var kindSel = el('select', 'set-select');
        var kOpts = '<option value="">Everything</option>' +
                    '<option value="_games">Games only</option>' +
                    '<option value="_quizzes">Quizzes only</option>';
        for (var km = 0; km < S.modes.length; km++) {
          if (!seen[S.modes[km].id]) continue;
          kOpts += '<option value="' + esc(S.modes[km].id) + '">' +
            esc(S.modes[km].full || S.modes[km].label) + '</option>';
        }
        for (var rk in seen) {
          if (!seen.hasOwnProperty(rk) || modeById(rk)) continue;
          kOpts += '<option value="' + esc(rk) + '">' + esc(modeName(rk)) + '</option>';
        }
        kindSel.innerHTML = kOpts;
        kindSel.value = S.logKind || '';
        if (kindSel.selectedIndex < 0) kindSel.value = '';

        var counts = [5, 10, 20, 50, 0];
        var logSel = el('select', 'set-select');
        var lOpts = '';
        for (var lc = 0; lc < counts.length; lc++) {
          var v = counts[lc];
          lOpts += '<option value="' + v + '"' + (S.logShown === v ? ' selected' : '') + '>' +
            (v ? 'Last ' + v : 'All') + '</option>';
        }
        logSel.innerHTML = lOpts;
        logSel.value = String(S.logShown);
        if (logSel.selectedIndex < 0) { logSel.value = '0'; }
        filterRow.appendChild(kindSel);
        filterRow.appendChild(logSel);
        hist.appendChild(filterRow);

        var logBody = el('div');
        hist.appendChild(logBody);

        function drawLog() {
          logBody.innerHTML = '';
          var n = Number(logSel.value) || 0;
          var want = kindSel.value;
          var rows = [];
          for (var f = 0; f < song.history.length; f++) {
            var at0 = song.history[f];
            if (want === '_games' && !isGame(at0.mode)) continue;
            if (want === '_quizzes' && isGame(at0.mode)) continue;
            if (want && want.charAt(0) !== '_' && at0.mode !== want) continue;
            rows.push(at0);
          }
          rows.sort(function (a, b) { return b.date - a.date; });   // newest first
          if (!rows.length) {
            logBody.appendChild(el('p', 'form-hint mt-0', 'Nothing of that kind here yet.'));
            return;
          }
          if (n) rows = rows.slice(0, n);
          for (var r = 0; r < rows.length; r++) {
            var at = rows[r];
            var cls = at.accuracy >= 80 ? 'log-good' : at.accuracy >= 50 ? 'log-mid' : 'log-bad';
            var lvl = at.level ? LEVEL_LABEL[at.level] || at.level : '';
            var bits = '';
            if (lvl) bits += ' <span class="log-lvl">' + esc(lvl) + '</span>';
            if (at.variant) {
              bits += ' <span class="log-lvl">' +
                (at.variant === 'r' ? 'random' : 'line ' + esc(at.variant.slice(1))) + '</span>';
            }
            /* WHAT THE RUN WAS WORTH, which the log has never said. A
               percentage is how well you did; points are what it bought, and
               the two come apart badly - 90% on a game is worth less than 78%
               on a Hard quiz, and a run against arrears can be worth 3 and add
               1. So the figure shown is what the score actually MOVED by, with
               the award itself in the tooltip when the two differ. Older
               attempts predate the net figure and fall back to the award. */
            var gross = at.points || 0;
            var net = at.pointsNet === undefined || at.pointsNet === null
                    ? gross : at.pointsNet;
            var owed = at.pointsPaid || 0;
            var ptsTitle = owed > 0
              ? 'worth ' + gross.toFixed(1) + ', and ' + owed.toFixed(1) +
                ' of it cleared what the song owed'
              : 'points banked';
            var row = el('div', 'log-row');
            row.innerHTML =
              '<span class="log-date">' + esc(fmtDate(at.date)) + '</span>' +
              '<span class="log-mode">' + esc(modeName(at.mode)) + bits + '</span>' +
              '<span class="log-time">' + (at.seconds > 0 ? fmtClock(at.seconds) : '&ndash;') +
              '</span>' +
              '<span class="log-pts' + (net > 0 ? '' : ' log-pts-none') +
              '" title="' + esc(ptsTitle) + '">' +
              (net > 0 ? '+' + net.toFixed(1) : '&ndash;') +
              (owed > 0 ? '<i class="log-owed">&#8722;' + owed.toFixed(1) + '</i>' : '') +
              '</span>' +
              '<span class="log-pct ' + cls + '">' + Math.round(at.accuracy) + '%</span>';
            logBody.appendChild(row);
          }
        }
        logSel.addEventListener('change', function () {
          S.logShown = Number(logSel.value) || 0;
          lsSet('logShown', S.logShown);
          drawLog();
        });
        kindSel.addEventListener('change', function () {
          S.logKind = kindSel.value;
          lsSet('logKind', S.logKind);
          drawLog();
        });
        drawLog();
        wrap.appendChild(hist);
      }

      appEl.appendChild(wrap);
      buildFooter();
    }).catch(function (e) {
      appEl.innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    });
  };

  function loadSong(id) {
    if (S.cache[id]) return Promise.resolve(S.cache[id]);
    var stored = lsGet('song.' + id);
    if (stored && stored.sections) {
      S.cache[id] = stored;
      // Scores decay by the day, so a stored copy is always a little stale.
      // Paint it now, correct it a beat later.
      api('getSong', { id: id }).then(function (fresh) {
        S.cache[id] = fresh;
        lsSet('song.' + id, fresh);
        var r = route();
        if (r.view === 'detail' && r.params.id === id) render();
      }).catch(function () {});
      return Promise.resolve(stored);
    }
    return api('getSong', { id: id }).then(function (song) {
      S.cache[id] = song;
      lsSet('song.' + id, song);
      return song;
    });
  }

  /**
   * Warm the cache for both burners in a single round trip, quietly, after the
   * first paint. Cross-session storage only helps songs you have opened before;
   * this is what makes the FIRST open of a burner song quick.
   */
  function prefetchBurners() {
    var want = [];
    var roles = ['front', 'back'];
    for (var r = 0; r < roles.length; r++) {
      var list = listByRole(roles[r]);
      if (!list) continue;
      for (var i = 0; i < S.songs.length; i++) {
        var s = S.songs[i];
        if ((s.listIds || []).indexOf(list.id) === -1) continue;
        if (S.cache[s.id]) continue;
        if (want.indexOf(s.id) === -1) want.push(s.id);
      }
    }
    if (!want.length) return;
    api('getSongs', { ids: want.slice(0, 60) }).then(function (songs) {
      for (var i = 0; i < songs.length; i++) {
        S.cache[songs[i].id] = songs[i];
        lsSet('song.' + songs[i].id, songs[i]);
      }
    }).catch(function () {});
  }

  function labelSections(sections) {
    var vTotal = 0, cTotal = 0, i;
    for (i = 0; i < sections.length; i++) {
      if (sections[i].type === 'verse') vTotal++;
      if (sections[i].type === 'chorus') cTotal++;
    }
    var v = 0, c = 0, out = [];
    for (i = 0; i < sections.length; i++) {
      if (sections[i].type === 'chorus') { c++; out.push(cTotal > 1 ? 'Chorus ' + c : 'Chorus'); }
      else if (sections[i].type === 'marker') { out.push(sections[i].ref); }
      else { v++; out.push(vTotal > 1 ? 'Verse ' + v : 'Verse'); }
    }
    return out;
  }

  /**
   * A small "i" that reveals explanatory text. Hover alone would be
   * unreachable on a phone, so it toggles on tap as well.
   */
  function infoDot(text) {
    var wrapEl = el('span', 'info-wrap');
    var dot = el('button', 'info-dot', 'i');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'What is this?');
    var tip = el('span', 'info-tip', esc(text));
    dot.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var open = wrapEl.className.indexOf('open') !== -1;
      wrapEl.className = 'info-wrap' + (open ? '' : ' open');
    });
    document.addEventListener('click', function () { wrapEl.className = 'info-wrap'; });
    wrapEl.appendChild(dot);
    wrapEl.appendChild(tip);
    return wrapEl;
  }

  /**
   * The score's own history: a sawtooth that jumps on every quiz and slides
   * down one point per day in between. The server hands over the corners, so
   * the straight segments between them are drawn as-is.
   */
  function scoreChart(curve) {
    var box = el('div', 'chart-box');
    if (!curve || curve.length < 2) return box;
    var w = 320, h = 120, padL = 32, padR = 12, padT = 12, padB = 22;
    var minD = curve[0].d, maxD = curve[curve.length - 1].d;
    if (maxD <= minD) maxD = minD + 86400000;
    var maxS = 0;
    for (var i = 0; i < curve.length; i++) if (curve[i].s > maxS) maxS = curve[i].s;
    if (maxS <= 0) maxS = 1;
    var top = Math.ceil(maxS / 10) * 10;
    if (top < 10) top = 10;

    var xOf = function (d) { return padL + ((d - minD) / (maxD - minD)) * (w - padL - padR); };
    var yOf = function (s) { return padT + (1 - s / top) * (h - padT - padB); };

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;display:block">';
    var marks = [0, Math.round(top / 2), top];
    for (var g = 0; g < marks.length; g++) {
      var gy = yOf(marks[g]);
      svg += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) +
             '" y2="' + gy.toFixed(1) + '" stroke="#D8D0BC" stroke-width="1"' +
             (marks[g] === 0 ? '' : ' stroke-dasharray="3 4"') + '/>' +
             '<text x="' + (padL - 5) + '" y="' + (gy + 3.5).toFixed(1) +
             '" text-anchor="end" font-size="9" font-family="monospace" fill="#6C6656">' +
             marks[g] + '</text>';
    }

    var d = '';
    for (var j = 0; j < curve.length; j++) {
      d += (j === 0 ? 'M' : 'L') + xOf(curve[j].d).toFixed(1) + ',' + yOf(curve[j].s).toFixed(1) + ' ';
    }
    // area under the curve, closed along the baseline
    var area = d + 'L' + xOf(curve[curve.length - 1].d).toFixed(1) + ',' + yOf(0).toFixed(1) +
               ' L' + xOf(curve[0].d).toFixed(1) + ',' + yOf(0).toFixed(1) + ' Z';
    svg += '<path d="' + area + '" fill="rgba(47,110,98,0.13)"/>';
    svg += '<path d="' + d + '" fill="none" stroke="#2F6E62" stroke-width="2" ' +
           'stroke-linejoin="round" stroke-linecap="round"/>';

    var lastX = xOf(curve[curve.length - 1].d), lastY = yOf(curve[curve.length - 1].s);
    svg += '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) +
           '" r="4" fill="#C79A3E" stroke="#1F2A24" stroke-width="1"/>';

    svg += '<text x="' + padL + '" y="' + (h - 6) + '" font-size="9" font-family="monospace" ' +
           'fill="#6C6656">' + esc(fmtDate(minD)) + '</text>';
    svg += '<text x="' + (w - padR) + '" y="' + (h - 6) + '" text-anchor="end" font-size="9" ' +
           'font-family="monospace" fill="#6C6656">today</text>';
    svg += '</svg>';
    box.innerHTML = svg;
    return box;
  }

  /**
   * Accuracy over the last few attempts. Always drawn against a fixed 0-100
   * frame with gridlines, so a single dot still says where it sits - an
   * unlabelled point floating in white space reads as a rendering bug.
   */
  function sparkline(vals) {
    var w = 300, h = 84, padL = 30, padR = 10, padT = 10, padB = 16;
    var plotW = w - padL - padR;
    var yOf = function (v) { return padT + (1 - v / 100) * (h - padT - padB); };

    // uniform scaling only: stretching x without y would distort every glyph
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:auto;display:block">';

    var marks = [0, 50, 100];
    for (var g = 0; g < marks.length; g++) {
      var gy = yOf(marks[g]);
      svg += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) +
             '" y2="' + gy.toFixed(1) + '" stroke="#D8D0BC" stroke-width="1"' +
             (marks[g] === 0 ? '' : ' stroke-dasharray="3 4"') + '/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (gy + 3.5).toFixed(1) +
             '" text-anchor="end" font-size="9" font-family="monospace" fill="#6C6656">' +
             marks[g] + '</text>';
    }

    if (vals.length) {
      var stepX = vals.length > 1 ? plotW / (vals.length - 1) : 0;
      var xOf = function (i) {
        return vals.length > 1 ? padL + i * stepX : padL + plotW / 2;
      };
      if (vals.length > 1) {
        var d = '';
        for (var i = 0; i < vals.length; i++) {
          d += (i === 0 ? 'M' : 'L') + xOf(i).toFixed(1) + ',' + yOf(vals[i]).toFixed(1) + ' ';
        }
        svg += '<path d="' + d + '" fill="none" stroke="#2F6E62" stroke-width="2.5" ' +
               'stroke-linecap="round" stroke-linejoin="round"/>';
      }
      for (var j = 0; j < vals.length; j++) {
        svg += '<circle cx="' + xOf(j).toFixed(1) + '" cy="' + yOf(vals[j]).toFixed(1) +
               '" r="4" fill="#C79A3E" stroke="#1F2A24" stroke-width="1"/>';
      }
      // Label the newest score so a single attempt is still readable. Both
      // placements have to be clamped: at 100% the point sits on the top
      // gridline, and the last point sits hard against the right edge, so the
      // naive above-and-right placement falls outside the viewBox and clips.
      var lastX = xOf(vals.length - 1), lastY = yOf(vals[vals.length - 1]);
      var labelY = lastY - 8;
      if (labelY < padT + 2) labelY = lastY + 15;      // too high: drop below
      var labelX = lastX + 8, anchor = 'start';
      if (labelX > w - 34) { labelX = lastX - 8; anchor = 'end'; }
      svg += '<text x="' + labelX.toFixed(1) + '" y="' + labelY.toFixed(1) +
             '" text-anchor="' + anchor + '" font-size="11" font-family="monospace" ' +
             'font-weight="600" fill="#1F2A24">' +
             Math.round(vals[vals.length - 1]) + '%</text>';
    }

    svg += '</svg>';
    var box = el('div');
    box.innerHTML = svg;
    return box;
  }

  /* ============================================================
     Quiz
     ============================================================ */
  /* ============================================================
     Quiz
     ------------------------------------------------------------
     A mode is chosen once, up front, and locked in for that run - the picker
     replaces itself with the quiz, so there is no switching halfway through
     and then claiming the harder tier's points.
     ============================================================ */

  function clipLine(t, n) {
    var s = String(t || '');
    if (s.length <= n) return s;
    var cut = s.slice(0, n - 1);
    while (cut.length && cut.charAt(cut.length - 1) === ' ') cut = cut.slice(0, cut.length - 1);
    return cut + String.fromCharCode(8230);
  }

  /** Enough of a section to recognise it, and no more. */
  function sectionPeek(sec, max) {
    var n = max || 46;
    if (sec.type === 'marker') return String(sec.ref || 'Chorus');
    var tl = typableLines(sec);
    if (!tl.length) return '(instrumental)';
    var t = tl[0].t;
    if (t.length <= n) return t;
    // no regex and no escapes in here - see the note on the PAGE literal
    var cut = t.slice(0, n - 1);
    while (cut.length && cut.charAt(cut.length - 1) === ' ') cut = cut.slice(0, cut.length - 1);
    return cut + String.fromCharCode(8230);
  }

  function sectionKey(sec) {
    if (sec.type === 'marker') return 'M:' + String(sec.ref || '').toLowerCase();
    var first = '';
    for (var i = 0; i < (sec.lines || []).length; i++) {
      if (sec.lines[i].t) { first = sec.lines[i].t; break; }
    }
    return sec.type + ':' + normWord(first).slice(0, 24);
  }

  function typableLines(sec) {
    var out = [];
    for (var i = 0; i < (sec.lines || []).length; i++) {
      if (sec.lines[i].t) out.push(sec.lines[i]);
    }
    return out;
  }

  function modeById(id) {
    for (var i = 0; i < S.modes.length; i++) if (S.modes[i].id === id) return S.modes[i];
    return null;
  }
  var LEVELS = ['easy', 'medium', 'hard'];
  var LEVEL_LABEL = { easy: 'Easy', medium: 'Med', hard: 'Hard' };

  function isGame(id) {
    var m = modeById(id);
    return !!m && m.kind === 'game';
  }

  /** The dials for one game at one level, straight off the server's blob. */
  function gameDials(id, level) {
    var g = (S.settings && S.settings.games) ? S.settings.games[id] : null;
    if (!g) return {};
    return g[level] || g.easy || {};
  }

  /** The dials for one quiz - one set, because a quiz has no levels. */
  function quizDials(id) {
    var q = (S.settings && S.settings.quizzes) ? S.settings.quizzes[id] : null;
    return q || {};
  }
  /** Games and quizzes through one door, so the Settings screen can be one screen. */
  function dialsFor(id, level) {
    return isGame(id) ? gameDials(id, level || 'easy') : quizDials(id);
  }
  function modePoints(id, level) {
    var d = dialsFor(id, level);
    return d.pts === undefined ? 0 : d.pts;
  }
  /** What this rung banks nothing at or below. */
  function floorOf(id, level) {
    var d = dialsFor(id, level);
    if (d.floor !== undefined) return d.floor;
    return (S.settings && S.settings.floor !== undefined) ? S.settings.floor : 75;
  }

  /** A name for any mode, including ones that no longer exist. */
  function modeName(id) {
    var m = modeById(id);
    if (m) return m.full || m.label;
    return (S.retired && S.retired[id]) || id;
  }

  /**
   * How many of the thing a game walks you through this song actually holds.
   * The time limits are rates per unit, so a two-verse song and a nine-verse
   * one never share a stopwatch.
   */
  function unitCountFor(idx, mode) {
    var m = modeById(mode);
    if (!idx || !m) return 0;
    if (m.unit === 'word') return idx.wordCount || 0;
    if (m.unit === 'line') return idx.lineCount || 0;
    return idx.sectionCount || 0;
  }

  /** The whole time limit for this game, at this level, on this song. */
  function timeLimitFor(idx, mode, level) {
    var d = gameDials(mode, level || 'easy');
    var per = Number(d.secsPer) || 0;
    var n = unitCountFor(idx, mode);
    if (!per || !n) return 0;
    return Math.max(5, Math.round(per * n));
  }

  /** m:ss, or plain seconds under a minute - matching the picker badges. */
  function fmtLimit(secs) {
    var t = Math.max(0, Math.round(secs || 0));
    if (t < 60) return t + 's';
    var m = Math.floor(t / 60), r = t % 60;
    return r ? m + 'm ' + r + 's' : m + 'm';
  }

  var QUIZ_TIER_NAME = ['Beginner', 'Easy', 'Medium', 'Hard'];

  /** The highest level of this game unlocked on this song. */
  function unlockedLevel(idx, mode) {
    var u = idx && idx.unlocks ? idx.unlocks[mode] : null;
    return u || 'easy';
  }
  function levelIdx(level) {
    var i = LEVELS.indexOf(level);
    return i < 0 ? 0 : i;
  }
  /**
   * THE WHOLE GAME, not one of its levels - 1.50.
   *
   * A game you have not reached along the chain is shut at every level, so
   * this has to be asked BEFORE the ladder is: without it a locked game would
   * show Easy open, because Easy is what the ladder falls back to when nothing
   * has been banked.
   */
  function gameShut(idx, mode) {
    return !!(idx && idx.gameLocked && idx.gameLocked[mode]);
  }
  /** The game that opens this one, or null for the head of the chain. */
  function opensThis(idx, mode) {
    var chain = chainFor(idx);
    for (var i = 1; i < chain.length; i++) if (chain[i] === mode) return chain[i - 1];
    return null;
  }
  /** GAME_CHAIN as it applies to this song, with what it cannot play left out. */
  function chainFor(idx) {
    var out = [];
    for (var i = 0; i < GAME_CHAIN.length; i++) {
      var id = GAME_CHAIN[i];
      if ((id === 'verseSort' || id === 'verseOrder') &&
          (idx && (idx.sectionCount || 0) < 3)) continue;
      out.push(id);
    }
    return out;
  }
  function levelLocked(idx, mode, level) {
    if (gameShut(idx, mode)) return true;
    return levelIdx(level) > levelIdx(unlockedLevel(idx, mode));
  }
  /** Has this level been cleared without dropping a mark, for credit? */
  function levelClean(idx, mode, level) {
    return !!(idx && idx.perfect && idx.perfect[mode + '|' + level]);
  }
  function quizClean(idx, mode) {
    return !!(idx && idx.perfect && idx.perfect[mode]);
  }

  /* The order the eight open in. It has to be known on the page as well as on
     the server, because the page is what has to SAY which game opens which -
     "bank points on Order Verses first" is the whole of the lock's usefulness,
     and the server only ships the answer, not the reason. Kept identical to
     GAME_CHAIN in the server half by inspection; there is no third copy. */
  var GAME_CHAIN = ['verseSort', 'verseOrder', 'lineScramble', 'lineImpostor',
                    'lineSort', 'lineOrder', 'wordScramble', 'wordImpostor'];
  /** Has a row already been written for this song and game today? */
  function gameUsed(idx, mode) {
    if (!idx) return false;
    if (spentHere(idx.id, mode)) return true;
    return !!(idx.usedGames && idx.usedGames[mode]);
  }
  function spentHere(songId, mode) {
    return !!S.spent[String(songId) + '|' + mode];
  }
  function markSpent(songId, mode) {
    S.spent[String(songId) + '|' + mode] = true;
  }
  function quizTier(idx) { return idx && idx.quizTier !== undefined ? idx.quizTier : 0; }
  /* Every playable game passed on Easy, or the quiz shelf does not open at
     all. quizTier comes back as -1 while that is outstanding, so the ordinary
     comparison already covers it - this flag is only for saying WHY. */
  function beginnerShut(idx) { return !!(idx && idx.beginnerLocked); }
  function quizLocked(idx, m) {
    return (m.tier === undefined ? 0 : m.tier) > quizTier(idx);
  }
  /** How many playable games are still to be passed on Easy. */
  function easyLeft(idx) {
    var chain = chainFor(idx), left = 0;
    for (var i = 0; i < chain.length; i++) {
      var u = idx && idx.unlocks ? idx.unlocks[chain[i]] : null;
      // 'easy' still showing as the ceiling means nothing has been banked here
      if (gameShut(idx, chain[i]) || !u || u === 'easy') left++;
    }
    return left;
  }
  /* Any quiz spends the song's one quiz for the day, whichever rung it was,
     so the overlay key is the shelf rather than the mode. */
  function quizUsed(idx) {
    if (!idx) return false;
    if (spentHere(idx.id, '_quiz')) return true;
    return !!idx.usedQuiz;
  }

  /**
   * A for-credit run is a commitment. Leaving one part-way through spends the
   * day for that game or quiz, so the way out asks first - and if you take it,
   * a forfeit is written so the slot is genuinely gone. Without the written row
   * there would be no cost, and the credit run would be re-rollable until the
   * board looked friendly.
   */
  /**
   * The one door out of a screen that has something to lose. It guards two
   * things now: a credit run in progress, and settings you have typed and not
   * saved. Both are silent losses otherwise, and the settings one arrived the
   * moment the screen stopped writing on every keystroke - the safety net has
   * to go in with the change that creates the need for it, not after.
   */
  function guardCreditRun(after) {
    if (S.settingsDirty) {
      if (!confirm('You have unsaved settings changes.' + NL + NL +
                   'Leave now and they are thrown away.')) return false;
      S.settingsDirty = false;
    }
    var run = S.creditRun;
    if (!run) { after(); return true; }
    if (!confirm('Leave now and this counts as a forfeit.' + NL + NL +
                 'That spends today only for ' + run.label + ' on this song. ' +
                 'Practice runs stay open.')) return false;
    S.creditRun = null;
    stopGameClock();
    dropSong(run.songId);
    bankAttempt({
      songId: run.songId, date: Date.now(), accuracy: 0,
      totalWords: 0, correctWords: 0, mode: run.mode,
      seconds: 0, device: timingDevice(), level: run.level || '',
      timed: false, variant: 'forfeit', practice: false,
      detail: { forfeit: true }
    });
    toast('Forfeited - that is today spent for ' + run.label);
    after();
    return true;
  }

  function timerSvg(size) {
    var z = size || 15;
    return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="none" ' +
      'stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
      '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.8M9.5 2.5h5M12 2.5v3"/>' +
      '</svg>';
  }

  function meanOf(vals) {
    if (!vals || !vals.length) return 0;
    var t = 0;
    for (var i = 0; i < vals.length; i++) t += vals[i];
    return t / vals.length;
  }

  VIEWS.quiz = function (p) {
    var idx = songById(p.id);
    if (!idx) { go('library', {}, true); return; }
    appEl.innerHTML = '<div class="loading">Loading...</div>';
    loadSong(p.id).then(function (song) {
      appEl.innerHTML = '';
      S.pickKind = p.kind || null;
      S.practiceRun = !!p.practice;
      if (p.variant !== undefined) S.quizVariant = p.variant;
      if (!p.mode) {
        S.practiceRun = false;
        S.creditRun = null;
        renderModePicker(song, idx);
      } else {
        var md = modeById(p.mode);
        S.creditRun = p.practice ? null : {
          songId: song.id, mode: p.mode, level: p.level || '',
          label: md ? md.label : p.mode
        };
        renderQuiz(song, idx, p.mode, p.level || 'easy', !!p.timed);
      }
    }).catch(function (e) {
      appEl.innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>';
    });
  };

  /**
   * ONE SONG'S RECORD, keyed by mode and level, out of its loaded history.
   * Times are this device only - a phone run and a keyboard run are not the
   * same measurement. Practice runs are not in here at all; they are never
   * written.
   *
   * This and the two below used to live inside the picker. They are out here
   * because the level sheet - what you get when a game is drawn for you, or
   * when Next game walks you on to the following one - was showing a bare
   * three buttons, and being asked to choose a difficulty with none of the
   * history the picker would have shown you is a worse question for no reason.
   */
  function songRecord(song) {
    var dev = timingDevice(), rec = {};
    var hist = (song && song.history) || [];
    for (var h = 0; h < hist.length; h++) {
      var e = hist[h];
      var key = e.mode + (e.level ? '|' + e.level : '');
      if (!rec[key]) rec[key] = { accs: [], secs: [], last: null, lastDate: 0 };
      rec[key].accs.push(Number(e.accuracy) || 0);
      if ((Number(e.seconds) || 0) > 0 && e.device === dev) rec[key].secs.push(e.seconds);
      if (e.date >= rec[key].lastDate) { rec[key].lastDate = e.date; rec[key].last = e.accuracy; }
    }
    return rec;
  }

  function statsIn(rec, mode, level) {
    var r = rec ? rec[mode + (level ? '|' + level : '')] : null;
    if (!r || !r.accs.length) return null;
    var sum = 0, best = 0;
    for (var i = 0; i < r.accs.length; i++) {
      sum += r.accs[i];
      if (r.accs[i] > best) best = r.accs[i];
    }
    return {
      n: r.accs.length, best: Math.round(best), last: Math.round(r.last),
      avg: Math.round(sum / r.accs.length), secs: r.secs,
      ago: agoText(Math.max(0, Math.round((Date.now() - r.lastDate) / 86400000)))
    };
  }

  /**
   * The four-quadrant panel beside every level button: clock and this song's
   * limit top left, tries top right, best and average bottom left, last and
   * when bottom right.
   *
   * EVERY PANEL HAS THE SAME SHAPE whether or not it has any history - two
   * lines in each of the bottom cells, with a dash where a number would go.
   * Collapsing the empty ones made a column of three rows ragged, and the
   * button beside each row stretches to match its panel, so ragged panels
   * meant ragged buttons. An em dash costs one character and keeps the grid.
   */
  function statPanel(rec, mode, level, limit) {
    var st = statsIn(rec, mode, level);
    var DASH = '&ndash;';
    function pair(k, v) {
      return '<span class="q-line"><span class="q-k">' + k +
             '</span><span class="q-v">' + v + '</span></span>';
    }
    var box = el('div', 'q-panel');
    box.innerHTML =
      '<div class="q-cell q-tl">' + timerSvg(12) +
        '<span class="q-lim">' + esc(fmtLimit(limit)) + '</span></div>' +
      '<div class="q-cell q-tr"><span class="q-k">tries</span>' +
        '<span class="q-big">' + (st ? st.n : 0) + '</span></div>' +
      '<div class="q-cell q-bl">' +
        pair('best', st ? st.best + '%' : DASH) +
        pair('avg', st ? st.avg + '%' : DASH) + '</div>' +
      '<div class="q-cell q-br">' +
        pair('last', st ? st.last + '%' : DASH) +
        '<span class="q-ago">' + (st ? esc(st.ago) : DASH) + '</span></div>';
    return box;
  }

  /**
   * The picker for one song.
   *
   * GAMES are four family cards - Order, Build, Scramble, Impostor - each
   * holding its two variants side by side, and each variant showing its three
   * levels. A level is a button beside a four-quadrant panel: the clock and
   * this song's limit top left, tries top right, best and average bottom left,
   * last and when bottom right. The button is exactly as tall as the panel, so
   * a column reads as three even rows however much history is behind it.
   *
   * Three states a level can be in, and the picker has to show all three at a
   * glance: LOCKED until you bank points a rung below, SPENT once you have
   * taken it for credit today, or open. Spent still plays - as practice.
   *
   * QUIZZES share one ladder, and the two Beginner rungs sit side by side
   * because they are alternatives at the same height rather than steps.
   */
  /**
   * THE WHOLE GAMES SHELF FOR ONE SONG, as its own element.
   *
   * It was inlined in the picker until 1.50, when the results screen stopped
   * offering three shortcuts and started offering the menu itself. Two copies
   * of twenty-four buttons, each with its own reading of what is locked, is
   * exactly the kind of duplication that ends with one screen letting you into
   * a game the other one is refusing.
   *
   * Three states a level can be in and the block has to show all three at a
   * glance: LOCKED - either the game has not been reached along the chain, or
   * the rung below it has not been banked - SPENT once today's credit run has
   * been taken, or open. Spent still plays, as practice.
   */
  function gamesMenu(song, idx, opened) {
    var wrap = el('div', 'games-menu');
    opened = opened || {};
    var sections = song.sections.length;
    var rec = songRecord(song);

    /* Eight games times three levels is twenty-four buttons, and most days the
       question is not "which one" but "give me one I have not done". Same draw
       as Next game used to make - see drawGameFor. */
    var randBtn = el('button', 'btn btn-gold btn-block pick-random', 'Random Game');
    randBtn.addEventListener('click', function () {
      var pick = drawGameFor(idx, '');
      if (!pick) { toast('Nothing here is open on this song yet'); return; }
      levelSheet(song, idx, pick.id);
    });
    wrap.appendChild(randBtn);

    var fams = S.families || [];
    for (var f = 0; f < fams.length; f++) {
      (function (fam) {
        var variants = [];
        for (var m = 0; m < S.modes.length; m++) {
          if (S.modes[m].family === fam.id) variants.push(S.modes[m]);
        }
        if (!variants.length) return;

        var card = el('div', 'fam-card');
        var head = el('div', 'fam-head');
        head.innerHTML = '<div class="fam-name">' + esc(fam.label) + '</div>' +
          '<div class="fam-blurb">' + esc(fam.blurb) + '</div>';
        card.appendChild(head);

        var cols = el('div', 'fam-cols');
        for (var v = 0; v < variants.length; v++) {
          (function (mode) {
            var used = gameUsed(idx, mode.id);
            /* A GAME THIS SONG CANNOT PLAY IS NOT A LOCKED ONE. The two verse
               games need three sections, and the chain leaves them out
               entirely on a shorter song - so they come back from the server
               marked locked, which is true but is not the reason. Tagging them
               "locked" as well as saying they need three sections would offer
               two explanations for one absence, one of which suggests there is
               something you could do about it. */
            var blocked = ((idx.sectionCount || sections) < 3 &&
                           (mode.id === 'verseSort' || mode.id === 'verseOrder'));
            var shut = !blocked && gameShut(idx, mode.id);
            // the box itself says whether there is credit on the table
            // the whole game just became reachable, rather than one of its rungs
            var newGame = !!opened[mode.id];
            var col = el('div', 'fam-col' + (used || shut || blocked ? '' : ' fam-col-open') +
                                (shut ? ' fam-col-shut' : '') +
                                (newGame ? ' fam-col-new' : ''));
            var colHead = el('div', 'fam-col-head' +
                              (used && !shut ? ' fam-col-spent' : ''));
            colHead.innerHTML = esc(mode.variant) +
              (newGame ? '<span class="fam-new-tag">just opened</span>'
                 : shut ? '<span class="fam-shut-tag">' + lockSvg(11) + 'locked</span>'
                    : (used && !blocked) ? '<span class="fam-spent-tag">today spent</span>' : '');
            col.appendChild(colHead);

            if (blocked) {
              col.appendChild(el('p', 'fam-blocked',
                'Needs three sections; this song has ' + sections + '.'));
              cols.appendChild(col);
              return;
            }
            /* WHY IT IS SHUT, ONCE, above the three rungs rather than repeated
               on each of them. All three carry the same reason, and printing
               it three times would say the game was locked three ways. */
            if (shut) {
              var opener = opensThis(idx, mode.id);
              var om = opener ? modeById(opener) : null;
              col.appendChild(el('p', 'fam-blocked',
                om ? 'Opens when you bank points on ' + esc(om.label) + '.'
                   : 'Not open on this song yet.'));
            }
            for (var L = 0; L < LEVELS.length; L++) {
              (function (lv) {
                var locked = levelLocked(idx, mode.id, lv);
                var clean = levelClean(idx, mode.id, lv);
                var isNew = !!opened[mode.id + '|' + lv];
                var row = el('div', 'fam-row');
                var pts = modePoints(mode.id, lv);
                var btn = el('button', 'fam-lvl' +
                  (locked ? ' is-locked' : '') + (used && !locked ? ' is-spent' : '') +
                  (clean ? ' is-clean' : '') + (isNew ? ' is-new' : ''));
                btn.type = 'button';
                /* WHAT THE RUN JUST BOUGHT YOU, said on the thing it bought.
                   The points line is where a level says what it is worth, and
                   a rung you could not reach two minutes ago is the more
                   interesting fact about it for exactly one screen. */
                btn.innerHTML = locked
                  ? '<span class="fam-lock">' + lockSvg(15) + '</span>' +
                    '<span class="fam-lvl-name">' + esc(LEVEL_LABEL[lv]) + '</span>' +
                    '<span class="fam-pts">locked</span>'
                  : '<span class="fam-lvl-name">' + cleanWrap(LEVEL_LABEL[lv], clean) +
                      '</span>' +
                    (isNew
                      ? '<span class="fam-pts fam-pts-new">just unlocked</span>'
                      : '<span class="fam-pts">' + pts + ' pt' + (pts === 1 ? '' : 's') +
                        (used ? '  &middot;  practice' : '') + '</span>');
                if (locked) {
                  var why = lockReason(idx, mode, lv);
                  btn.title = why;
                  btn.addEventListener('click', function () { toast(why); });
                } else {
                  if (clean) {
                    btn.title = LEVEL_LABEL[lv] + ' cleared at 100% - nothing dropped.';
                  }
                  btn.addEventListener('click', function () {
                    openPlaySheet(song, mode, lv, used);
                  });
                }
                row.appendChild(btn);
                row.appendChild(statPanel(rec, mode.id, lv,
                                          timeLimitFor(idx, mode.id, lv)));
                col.appendChild(row);
              })(LEVELS[L]);
            }
            cols.appendChild(col);
          })(variants[v]);
        }
        card.appendChild(cols);
        wrap.appendChild(card);
      })(fams[f]);
    }
    return wrap;
  }

  /**
   * THE MARK FOR A LEVEL CLEARED WITHOUT DROPPING ANYTHING.
   *
   * A star rather than a tick: a tick already means "done" everywhere else on
   * this screen - the spent tag, the save receipt - and a second meaning for
   * it here would make both of them ambiguous. 100% is not "done", it is done
   * perfectly, which is a different claim and deserves a different glyph.
   *
   * ONE EACH SIDE, so the name stays centred. The level names are centred in
   * their buttons and a single trailing star pushed EASY a few pixels left of
   * where MED and HARD were sitting - three buttons in a column, each with its
   * label at a slightly different offset depending on history. A pair of stars
   * is symmetric, so the name does not move.
   */
  function cleanWrap(label, clean) {
    if (!clean) return esc(label);
    var star = '<span class="lvl-clean" title="cleared at 100%">&#9733;</span>';
    return star + esc(label) + star;
  }

  /** Why a level will not open, in the words that say what to do about it. */
  function lockReason(idx, mode, lv) {
    if (gameShut(idx, mode.id)) {
      var opener = opensThis(idx, mode.id);
      var om = opener ? modeById(opener) : null;
      return om ? 'Bank points on ' + om.label + ' to open ' + mode.label + '.'
                : mode.label + ' is not open on this song yet.';
    }
    var below = LEVELS[Math.max(0, levelIdx(lv) - 1)];
    return 'Bank points on ' + LEVEL_LABEL[below] + ' to open this.';
  }

  function renderModePicker(song, idx) {
    var wrap = el('div');
    var isGameShelf = S.pickKind !== 'quiz';
    var intro = el('div', 'quiz-intro');
    intro.innerHTML =
      '<p class="section-eyebrow">' + (isGameShelf ? 'Games' : 'Quiz') + '</p>' +
      '<h2 class="section-title mt-0">' + esc(song.title) + '</h2>' +
      '<p class="text-muted">' + (S.pickKind === 'game'
        ? 'One scoring run per game per day. Practice as much as you like.'
        : S.pickKind === 'quiz'
          ? 'One scoring quiz per song per day - you choose which. Practice is unlimited.'
          : 'Pick how hard you want it. You are locked in once you start.') + '</p>';
    wrap.appendChild(intro);

    if (isGameShelf) wrap.appendChild(gamesMenu(song, idx));

    /* The floor is per level now, so there is no one number to print. Where
       they all agree, say it; where they do not, say the range. */
    var floors = [];
    for (var fm = 0; fm < S.modes.length; fm++) {
      var fmo = S.modes[fm];
      if (fmo.kind === 'game') {
        for (var fl2 = 0; fl2 < LEVELS.length; fl2++) floors.push(floorOf(fmo.id, LEVELS[fl2]));
      } else floors.push(floorOf(fmo.id));
    }
    var floorLo = floors.length ? Math.min.apply(null, floors) : 75;
    var floorHi = floors.length ? Math.max.apply(null, floors) : 75;
    var floorPct = floorLo === floorHi ? String(floorLo) : (floorLo + '-' + floorHi);

    var dev = timingDevice();
    var rec = songRecord(song);
    function statsFor(mode, level) { return statsIn(rec, mode, level); }


    /* ---------------- quizzes ---------------- */
    if (S.pickKind !== 'game') {
      var minRuns = (S.settings && S.settings.timerMin) || 5;
      var spent = quizUsed(idx);
      /* THE WHOLE SHELF IS BEHIND THE GAMES - 1.50. Said once, at the top,
         rather than on each of the five cards: it is one condition and it
         shuts all of them at the same moment. */
      if (beginnerShut(idx)) {
        var nLeft = easyLeft(idx);
        wrap.appendChild(el('p', 'day-spent quiz-gate',
          'The quizzes open once you have passed every game on Easy - ' +
          nLeft + ' still to go. Typing a song back from memory is a long way ' +
          'from tapping cards into order, and the games are how you get there.'));
      }
      if (spent) {
        wrap.appendChild(el('p', 'day-spent',
          'Today is already spent on this song. Anything below can still be practised.'));
      }

      function timerCell(m) {
        var r = rec[m.id];
        var runs = (r && r.secs) ? r.secs.length : 0;
        var swing = (S.settings && S.settings.speedSwing !== undefined)
          ? S.settings.speedSwing : 20;
        var on = !!(S.settings && S.settings.speedMod);
        var open = on && runs >= minRuns;
        var cell = el('div', 'mode-timer' + (open ? '' : ' locked'));
        var icon = el('div', '', timerSvg(15));
        icon.style.color = open ? 'var(--teal)' : 'var(--text-muted)';
        cell.appendChild(icon);
        var box = el('input');
        box.type = 'checkbox';
        box.disabled = !open;
        box.setAttribute('aria-label', 'Let the clock move the points');
        box.addEventListener('click', function (ev) { ev.stopPropagation(); });
        box.addEventListener('change', function () { S.timerWanted[m.id] = box.checked; });
        cell.appendChild(box);
        var note = el('div', 'mode-timer-avg');
        if (!on) note.textContent = 'off in settings';
        else if (runs < minRuns) note.textContent = runs + ' of ' + minRuns + ' runs';
        else note.textContent = fmtClock(Math.round(meanOf(r.secs))) + ' avg';
        cell.appendChild(note);
        cell.title = open
          ? 'Tick to let your pace move this run by up to ' + swing + '%, either way.'
          : on
            ? 'The time challenge opens after ' + minRuns + ' scoring runs at this level on ' +
              timingLabel(dev) + '. You have ' + runs + '.'
            : 'The pace modifier is switched off in Settings.';
        return cell;
      }

      S.timerWanted = {};

      /** Why a quiz rung will not open, in the words that say what to do. */
      function quizWhy(m) {
        if (beginnerShut(idx)) {
          var n = easyLeft(idx);
          return 'Pass every game on Easy first - ' + n + ' to go.';
        }
        return 'Bank points on ' + QUIZ_TIER_NAME[Math.max(0, (m.tier || 0) - 1)] +
               ' to open this.';
      }

      function quizCard(m, paired) {
        var locked = quizLocked(idx, m);
        var clean = quizClean(idx, m.id);
        var card = el('div', 'mode-card' + (locked ? ' is-locked' : '') +
                              (clean ? ' is-clean' : ''));
        var body = el('div', 'mode-body');
        var st2 = statsFor(m.id, '');
        body.innerHTML =
          '<div class="mode-name">' + cleanWrap(m.label, clean) + '</div>' +
          '<div class="mode-blurb">' + esc(locked ? quizWhy(m) : m.blurb) + '</div>' +
          (st2 ? '<div class="mode-record">' + st2.avg + '% avg  &middot;  ' +
                 st2.best + '% best  &middot;  ' +
                 '<span class="mode-record-n">' + st2.n + ' run' +
                 (st2.n === 1 ? '' : 's') + '</span></div>' : '');
        var plate = el('div', 'mode-pts', locked ? lockSvg(17) : String(modePoints(m.id)));
        if (paired) {
          // plate and stopwatch share a line, body beneath
          var top = el('div', 'mode-top');
          top.appendChild(plate);
          if (!locked) top.appendChild(timerCell(m));
          card.appendChild(top);
          card.appendChild(body);
        } else {
          card.appendChild(plate);
          card.appendChild(body);
          if (!locked) card.appendChild(timerCell(m));
        }
        if (locked) {
          card.title = quizWhy(m);
          card.addEventListener('click', function () { toast(quizWhy(m)); });
        } else {
          card.style.cursor = 'pointer';
          card.addEventListener('click', function () {
            S.quizMode = m.id;
            if (m.id === 'firstLines') { openBlankLineSheet(song, idx, spent); return; }
            S.quizVariant = '';
            openQuizSheet(song, m, '', spent);
          });
        }
        return card;
      }

      // the two Beginner rungs are alternatives, not steps, so they sit level
      var beginners = [], rest = [];
      for (var q = 0; q < S.modes.length; q++) {
        if (S.modes[q].kind !== 'quiz') continue;
        if ((S.modes[q].tier || 0) === 0) beginners.push(S.modes[q]); else rest.push(S.modes[q]);
      }
      if (beginners.length) {
        var pair = el('div', 'quiz-pair');
        for (var b = 0; b < beginners.length; b++) pair.appendChild(quizCard(beginners[b], true));
        wrap.appendChild(pair);
      }
      for (var r2 = 0; r2 < rest.length; r2++) wrap.appendChild(quizCard(rest[r2]));
    }

    wrap.appendChild(el('p', 'form-hint',
      'Anything at or below ' + floorPct + '% banks nothing. Bank points to open the ' +
      'next rung. Times are your ' + esc(timingLabel(dev)) + ' runs only.'));
    appEl.appendChild(wrap);
    buildFooter();
  }

  function lockSvg(size) {
    var z = size || 14;
    return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/>' +
      '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  }

  /**
   * For points, or for practice? Practice is untimed and leaves no trace at
   * all - no row, no points, no unlock, no effect on any average. If the day is
   * already spent, practice is the only thing on offer.
   */
  function openPlaySheet(song, mode, level, spent) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    var idx = songById(song.id);
    var lim = timeLimitFor(idx, mode.id, level);
    var pts = modePoints(mode.id, level);
    sheet.appendChild(el('div', 'card-title',
      esc(mode.label) + '  &middot;  ' + esc(LEVEL_LABEL[level])));

    if (!spent) {
      var b1 = el('button', 'mode-card');
      b1.type = 'button';
      b1.innerHTML = '<div class="mode-body"><div class="mode-name">Play for points</div>' +
        '<div class="mode-blurb">Timed: ' + esc(fmtLimit(lim)) + ' for this song. Worth ' +
        pts + ' point' + (pts === 1 ? '' : 's') + ' at a flawless run. This is today, ' +
        'and backing out forfeits it.</div></div>';
      b1.addEventListener('click', function () {
        back.remove();
        S.quizMode = mode.id;
        go('quiz', { id: song.id, mode: mode.id, level: level, practice: false }, true);
      });
      sheet.appendChild(b1);
    } else {
      sheet.appendChild(el('p', 'form-hint mt-0',
        'You have already taken ' + esc(mode.label) + ' for credit today. It comes ' +
        'back tomorrow.'));
    }

    var b2 = el('button', 'mode-card');
    b2.type = 'button';
    b2.innerHTML = '<div class="mode-body"><div class="mode-name">Practice</div>' +
      '<div class="mode-blurb">No clock and no pressure. Nothing is banked, nothing ' +
      'is recorded, and it opens no new levels.</div></div>';
    b2.addEventListener('click', function () {
      back.remove();
      S.quizMode = mode.id;
      go('quiz', { id: song.id, mode: mode.id, level: level, practice: true }, true);
    });
    sheet.appendChild(b2);

    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /** The same choice, for a quiz. */
  function openQuizSheet(song, m, variant, spent) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title', esc(m.label)));
    var timed = !!S.timerWanted[m.id];

    if (!spent) {
      var b1 = el('button', 'mode-card');
      b1.type = 'button';
      b1.innerHTML = '<div class="mode-body"><div class="mode-name">Take it for credit</div>' +
        '<div class="mode-blurb">Worth up to ' + modePoints(m.id) + ' points. This is your ' +
        'one scoring quiz on this song today, and backing out forfeits it.</div></div>';
      b1.addEventListener('click', function () {
        back.remove();
        S.quizVariant = variant;
        go('quiz', { id: song.id, mode: m.id, timed: timed,
                     variant: variant, practice: false }, true);
      });
      sheet.appendChild(b1);
    } else {
      sheet.appendChild(el('p', 'form-hint mt-0',
        'Today is already spent on this song. Practice is still open.'));
    }

    var b2 = el('button', 'mode-card');
    b2.type = 'button';
    b2.innerHTML = '<div class="mode-body"><div class="mode-name">Practice</div>' +
      '<div class="mode-blurb">Nothing banked, nothing recorded, no new levels opened.' +
      '</div></div>';
    b2.addEventListener('click', function () {
      back.remove();
      S.quizVariant = variant;
      go('quiz', { id: song.id, mode: m.id, timed: false,
                   variant: variant, practice: true }, true);
    });
    sheet.appendChild(b2);

    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /**
   * Which line goes missing on Blank Lines: the same one out of every section,
   * or a different one each time. Only offers line numbers the song has.
   */
  function openBlankLineSheet(song, idx, spent) {
    var deepest = 0;
    for (var i = 0; i < song.sections.length; i++) {
      if (song.sections[i].type === 'marker') continue;
      var n = typableLines(song.sections[i]).length;
      if (n > deepest) deepest = n;
    }
    if (deepest < 1) { toast('Nothing to blank out here'); return; }

    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'card-title', 'Which line goes missing?'));
    sheet.appendChild(el('p', 'form-hint mt-0',
      'One line is taken out of every verse and chorus and you type it back, ' +
      'with the rest of the section around it and a blank for every letter of ' +
      'the line that is gone.'));

    var opts = [['r', 'A different one each time',
                 'Random within every section. The one to play when you know the song.']];
    var ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
    for (var k = 0; k < deepest && k < ordinals.length; k++) {
      opts.push(['n' + (k + 1), 'The ' + ordinals[k] + ' line of every section',
                 k === 0 ? 'The openings - the hooks a whole verse hangs off.'
                         : 'A section shorter than that gives up its last line instead.']);
    }
    for (var o = 0; o < opts.length; o++) {
      (function (op) {
        var b = el('button', 'mode-card');
        b.type = 'button';
        b.innerHTML = '<div class="mode-body"><div class="mode-name">' + esc(op[1]) +
          '</div><div class="mode-blurb">' + esc(op[2]) + '</div></div>';
        b.addEventListener('click', function () {
          back.remove();
          var m = modeById('firstLines');
          openQuizSheet(song, m, op[0], spent);
        });
        sheet.appendChild(b);
      })(opts[o]);
    }
    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);
    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /* ============================================================
     Games
     ------------------------------------------------------------
     Eight of them, built on four shared engines:

       SORT    lay everything out and put it in order, throwing away what does
               not belong    -> Verse Sort, Line Sort
       ORDER   one question at a time, which comes next
               -> Verse Order, Line Order, First Lines
       STEP    walk a section at a time and commit each one
               -> Word Scramble, Word Impostor, Line Impostor
       TYPING  the quizzes, unchanged

     Every game has three levels, and every level is a set of dials on the
     server. Two things are planted at every level, in numbers you set:

       BORROWED  a verse or a line lifted whole out of another song. Shape is
                 matched where it can be - a ten-line verse dropped into a song
                 where everything runs four lines is spotted without reading a
                 word of it, which turns a memory game into a shape-matching one.
       TAMPERED  this song's own words, with a share of them swapped for
                 plausible fakes. HIGH percentage is EASY: a third of the words
                 wrong reads as wrong at a glance; a tenth has to be checked
                 against what you actually remember.

     None of them are timed. The stopwatch belongs to the quizzes, where the
     thing being measured - how fast you can produce the words - is the thing
     the app is for. How fast you can tap a card is not.

     They all finish through finishQuiz, so scoring and the hot/cold machinery
     know nothing about which one you played.
     ============================================================ */

  /* ---------- the game clock ----------
     A COUNTDOWN, not a stopwatch. Quizzes are timed to measure you; games are
     timed to press you. Every game charges a rate per unit of the song - so
     many seconds per verse, per line or per word - and the limit for a given
     song is that rate times what the song actually holds. A two-verse song and
     a nine-verse one can then share a difficulty without sharing a stopwatch.

     It pauses with the app in the background, the same as the quiz clock: a
     phone call should not cost you the run.

     Practice mode passes no limit and no clock is built at all. */
  var gclock = { timer: null, left: 0, limit: 0, running: false, onExpire: null,
                 lastLeft: null, lastLimit: null };

  /* WHAT WAS LEFT ON IT WHEN IT STOPPED. Every finish path stops the clock
     before it grades, so the figure has to be kept here on the way past rather
     than read afterwards - by then the countdown is already torn down. Null
     means there was no clock: practice runs never build one, and a practice run
     that reported "0s left" would be inventing a defeat. */
  function stopGameClock() {
    if (gclock.timer) clearInterval(gclock.timer);
    if (gclock.running) {
      gclock.lastLeft = Math.max(0, Math.round(gclock.left));
      /* WHAT IT STARTED AT, kept beside what was left of it. The limit is a
         rate times the length of this song, so "40s left" is not a fact about
         a level until you know whether the clock began at 45 or at 400 - and
         the Insights panel that tunes the rates can only compare the share. */
      gclock.lastLimit = gclock.limit;
    }
    gclock.timer = null;
    gclock.running = false;
    gclock.onExpire = null;
  }

  function startGameClock(limit, onExpire) {
    stopGameClock();
    gclock.lastLeft = null;          // a new board carries nothing over
    gclock.lastLimit = null;
    if (!limit || limit <= 0) return null;
    var wrap = el('div', 'gclock');
    var num = el('div', 'gclock-num');
    var bar = el('div', 'gclock-bar');
    var fill = el('div', 'gclock-fill');
    bar.appendChild(fill);
    wrap.appendChild(num);
    wrap.appendChild(bar);

    gclock.left = limit;
    gclock.limit = limit;
    gclock.running = true;
    gclock.onExpire = onExpire;

    function paint() {
      var left = Math.max(0, gclock.left);
      num.textContent = fmtClock(Math.ceil(left));
      fill.style.width = Math.max(0, Math.min(100, (left / limit) * 100)) + '%';
      wrap.className = 'gclock' + (left <= 10 ? ' gclock-low' : '');
    }
    paint();

    gclock.timer = setInterval(function () {
      if (!gclock.running || document.hidden) return;
      gclock.left -= 0.25;
      paint();
      if (gclock.left <= 0) {
        var fn = gclock.onExpire;
        stopGameClock();
        if (fn) fn();
      }
    }, 250);
    return wrap;
  }

  /**
   * The top of every game: the heading, then the countdown if this run is for
   * points. expire is called with nothing on screen changed - each engine
   * grades whatever state it is in and finishes, which is the honest reading of
   * "the time ran out".
   */
  function gameShell(song, mode, level, note, expire) {
    var wrap = el('div');
    wrap.appendChild(gameHead(song, mode, level, note));
    if (S.practiceRun) {
      wrap.appendChild(el('p', 'practice-note',
        'Practice run - no clock, and nothing is banked.'));
      return wrap;
    }
    var clock = startGameClock(timeLimitFor(songById(song.id), mode, level), expire);
    if (clock) wrap.appendChild(clock);
    return wrap;
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * Ringers, FETCHED FRESH FOR EVERY GAME.
   *
   * They used to be pulled once and kept for the session, which is invisible
   * until you do the thing this app is for: play four games on one song in a
   * row. Every one of them then cribbed off the same handful of other songs,
   * and by the third you were not recognising your own lyrics any more, you
   * were recognising the intruder from last time. The server shuffles the
   * library and reads twenty rows - it is the "Setting the board" beat and it
   * is over in well under a second, which is a fair price for a new set of
   * strangers each time.
   */
  function loadDecoys(songId) {
    return api('getDecoys', { excludeId: songId, want: 20 })
      .catch(function () { return { verses: [], lines: [] }; });
  }

  /**
   * The cache was fetched while some OTHER song was open, so it can easily
   * contain lines from the one being played now. A "wrong" option that is
   * actually in this song would be marked wrong when you picked it, which is
   * the worst thing a memory game can do - so anything the song already says
   * is filtered out here rather than trusted from the server.
   */
  function usableDecoys(song, d) {
    var mine = {};
    for (var i = 0; i < song.sections.length; i++) {
      var ls = song.sections[i].lines || [];
      for (var j = 0; j < ls.length; j++) {
        if (ls[j].t) mine[normWord(ls[j].t)] = true;
      }
    }
    var verses = [], lines = [];
    for (var v = 0; v < (d.verses || []).length; v++) {
      var vs = d.verses[v], clash = false;
      for (var k = 0; k < vs.lines.length; k++) if (mine[normWord(vs.lines[k])]) clash = true;
      if (!clash) verses.push(vs);
    }
    for (var l = 0; l < (d.lines || []).length; l++) {
      if (!mine[normWord(d.lines[l].t)]) lines.push(d.lines[l]);
    }
    return { verses: verses, lines: lines };
  }

  /**
   * THE THREE KINDS OF PLANTED MATERIAL.
   *
   *   BORROWED  a line or verse lifted whole out of a DIFFERENT song. Foreign
   *             words, foreign voice - the easy catch, and the one that
   *             teaches least, because you can throw it out without knowing
   *             this song at all.
   *   TAMPERED  this song's own material with a share of the words swapped.
   *             Caught by reading, not by recognising.
   *   DECOY     this song's own line, untouched, in a place it does not go.
   *             Nothing about it is wrong except where it is, so the only way
   *             to place it is to actually know the song. The hard one.
   *
   * borrowN says how many of the not-here-and-now units to plant; decoyPct
   * skews that count between borrowed and decoy. The split is drawn per unit
   * rather than divided out, so a level does not settle into a fixed recipe -
   * the same reason the counts are ranges.
   */
  function plantSplit(n, pct) {
    var p = (pct === undefined || pct === null) ? 50 : Number(pct);
    var decoy = 0;
    for (var i = 0; i < n; i++) if (Math.random() * 100 < p) decoy++;
    return { decoy: decoy, borrow: n - decoy };
  }

  /** A whole number out of a [min, max] dial. Fixed counts are a tell. */
  function pickCount(r) {
    if (!(r instanceof Array) || r.length !== 2) return 0;
    var a = Math.min(r[0], r[1]), b = Math.max(r[0], r[1]);
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  /* Per game per level now: four options at Easy and four at Hard were never
     the same dial. Falls back to the old shared number for anything that has
     not got one of its own. */
  function choiceFloor(mode, level) {
    var d = mode ? dialsFor(mode, level) : {};
    if (d.choiceCount !== undefined) return d.choiceCount;
    var c = S.settings ? S.settings.choiceCount : 4;
    return c === undefined ? 4 : c;
  }

  /** The scoreable sections of a song, with their labels. */
  function realSections(song) {
    var labels = labelSections(song.sections), out = [];
    for (var i = 0; i < song.sections.length; i++) {
      var sec = song.sections[i];
      if (sec.type === 'marker') continue;
      var text = [];
      for (var j = 0; j < (sec.lines || []).length; j++) {
        if (sec.lines[j].t) text.push(sec.lines[j].t);
      }
      if (text.length) out.push({ label: labels[i], type: sec.type, lines: text });
    }
    return out;
  }

  /**
   * Borrowed verses whose line count matches something this song actually
   * does. If nothing fits, everything is offered rather than nothing - a game
   * with no ringers in it is worse than one with a ringer of the wrong shape.
   */
  function shapedVerses(song, verses) {
    var want = {}, secs = realSections(song);
    for (var i = 0; i < secs.length; i++) want[secs[i].lines.length] = true;
    var fit = [], rest = [];
    for (var v = 0; v < (verses || []).length; v++) {
      var n = verses[v].n || (verses[v].lines || []).length;
      if (want[n]) fit.push(verses[v]); else rest.push(verses[v]);
    }
    return fit.length ? fit : rest;
  }

  function gameHead(song, mode, level, note) {
    var cfg = modeById(mode) || { label: mode, blurb: '' };
    var pts = modePoints(mode, level);
    var intro = el('div', 'quiz-intro');
    intro.innerHTML =
      '<p class="section-eyebrow">' + esc(cfg.label) + '  &middot;  ' +
      esc(LEVEL_LABEL[level] || 'Easy') + '  &middot;  ' +
      pts + ' point' + (pts === 1 ? '' : 's') + '</p>' +
      '<h2 class="section-title mt-0">' + esc(song.title) + '</h2>' +
      '<p class="text-muted">' + esc(note || cfg.blurb) + '</p>';
    return intro;
  }

  /** Every game reports through the same shape the results screen reads. */
  function finishGame(song, idx, mode, level, right, total, rows, heads) {
    var accuracy = total ? Math.round((right / total) * 1000) / 10 : 0;
    var results = [{
      label: 'How it went', type: 'verse',
      sortRows: rows, sortHeads: heads || ['You', 'The song'],
      lines: [{ tokens: [], correctCount: right, totalCount: total }],
      correctCount: right, totalCount: total
    }];
    finishQuiz(song, idx, mode, accuracy, results, total, right, level, false);
  }

  /* ---------- ORDER: one question at a time ---------- */
  /**
   * Answering tells you straight away whether you were right and shows what
   * the song actually does. A recognition game that withholds that until the
   * end is just a test - the correction is where the learning is.
   */
  /**
   * BUILD, WHICH NO LONGER TELLS YOU - 1.62.
   *
   * Every choice used to mark itself the instant you made it: green if you had
   * it, red plus the green one if you did not, then the next question arrived
   * on its own. Two things were wrong with that, and they are the same thing
   * said twice.
   *
   * It answered the question it had just asked. A game whose wrong options are
   * tampered copies of your own lyrics is asking you to read carefully, and
   * being shown the right line half a second later means the reading never has
   * to be finished - you find out rather than work out. By question seven you
   * are picking quickly and being taught the answers, which is a flashcard
   * deck and not a test.
   *
   * And it made the run one-way. Marking as you go means the score exists
   * before the run is over, and a score that is already partly banked cannot
   * let you change your mind about question three. Every other walking game in
   * this app grades at the end for exactly this reason - see runStepGame - and
   * Build was the last one that did not.
   *
   * So: the choice records itself and moves on, nothing is coloured, and the
   * whole run is graded in one pass at the end out of whatever the answers
   * happen to be by then. Back walks the questions, a question you return to
   * shows what you picked, and picking again replaces it.
   *
   * THE OPTIONS ARE MINTED ONCE PER QUESTION AND KEPT. They used to be minted
   * on every draw, which was right when a draw only ever happened once - now
   * that you can walk back onto a question, re-minting would deal a fresh set
   * of wrong answers under a choice you had already made, and the thing you
   * picked might not even be on the board any more.
   */
  function runOrderGame(song, idx, mode, level, questions, heads) {
    var at = 0, over = false, answers = [];

    function finish() {
      if (over) return;
      over = true;
      stopGameClock();
      /* GRADED HERE AND NOWHERE ELSE, in question order, out of the answers as
         they finally stand. Anything never answered still counts in the total
         and scores nothing - the run is the whole set of questions, and leaving
         one blank is not the same as it not having been asked. */
      var right = 0, rows = [];
      for (var i = 0; i < questions.length; i++) {
        var q = questions[i], a = answers[i];
        if (!a) {
          rows.push({ ok: false,
            got:  { label: q.short, peek: 'never answered' },
            want: { label: q.short, peek: q.answer } });
          continue;
        }
        /* If a song sings a line twice, "what comes after it" has two honest
           answers. Every one of them is accepted; the row still shows the one
           the song happens to reach first, which is the useful thing to read
           back. */
        var ok = (q.answers || [q.answer]).indexOf(a.text) !== -1;
        if (ok) right++;
        rows.push({ ok: ok,
          got:  { label: q.short, peek: a.text },
          want: { label: q.short, peek: q.answer } });
      }
      finishGame(song, idx, mode, level, right, questions.length, rows,
                 heads || ['You picked', 'The song']);
    }

    var wrap = gameShell(song, mode, level, null, finish);
    /**
     * WHAT YOU HAVE BUILT SO FAR, standing above the question.
     *
     * The game is called Build and until now it built nothing you could see:
     * each answer flashed green or red and vanished, and by question seven you
     * had no idea what song you were assembling. Now every choice you make
     * stays on the page in the order you made it, so the thing growing at the
     * top of the screen is the song as you have told it - right answers reading
     * straight through, wrong ones sitting in it where you put them. That is
     * the context the next question is actually asked in.
     *
     * It scrolls itself to the bottom, because the newest choice is the one the
     * next question follows on from.
     */
    var chosen = el('div', 'built-wrap');
    wrap.appendChild(chosen);
    var host = el('div');
    wrap.appendChild(host);
    appEl.appendChild(wrap);

    /* Back on the left and narrow, Next on the right - the same bar the other
       walking games use, in the same place, doing the same thing. */
    var bar = el('div', 'quiz-submit-bar');
    var barRow = el('div', 'step-bar');
    var backBtn = el('button', 'btn btn-outline step-back', 'Back');
    backBtn.type = 'button';
    var nextBtn = el('button', 'btn btn-gold step-next', '');
    nextBtn.type = 'button';
    barRow.appendChild(backBtn);
    barRow.appendChild(nextBtn);
    bar.appendChild(barRow);
    appEl.appendChild(bar);
    buildFooter();

    function answeredCount() {
      var n = 0;
      for (var i = 0; i < questions.length; i++) if (answers[i]) n++;
      return n;
    }

    function paintChosen() {
      chosen.innerHTML = '';
      var last = -1, i;
      for (i = 0; i < questions.length; i++) if (answers[i]) last = i;
      if (last < 0 && at === 0) return;
      var upto = Math.max(last, at);
      chosen.appendChild(el('p', 'section-eyebrow',
        'What you have built - ' + answeredCount() + ' of ' + questions.length));
      var box = el('div', 'built-list');
      var here = null;
      for (i = 0; i <= upto; i++) {
        var row = el('div', 'built-item' + (answers[i] ? '' : ' built-gap') +
                            (i === at ? ' built-at' : ''));
        row.innerHTML = answers[i]
          ? esc(answers[i].text).split(NL).join('<br>')
          : esc(questions[i].short + ' - not answered yet');
        box.appendChild(row);
        if (i === at) here = row;
      }
      chosen.appendChild(box);
      /* Scroll the line you are standing on into the transcript rather than the
         bottom of it. They are the same place until you walk back, and after
         that the bottom is the wrong one. */
      if (here) box.scrollTop = Math.max(0, here.offsetTop - box.clientHeight / 2);
      else box.scrollTop = box.scrollHeight;
    }

    function draw() {
      host.innerHTML = '';
      if (at >= questions.length) return;
      var q = questions[at];
      /* MINTED ONCE, THE FIRST TIME THE QUESTION IS DRAWN, and kept on the
         question after that. Building them all up front meant one draw from the
         ringer pool covered the whole game, so the same borrowed verse turned up
         as a wrong answer four questions running and stopped being a question at
         all. Building them on EVERY draw was the fix for that, and it became a
         bug of its own the moment Back existed: walking back onto a question
         would deal a fresh set of wrong answers under a choice already made. */
      if (!q.options && q.make) q.options = q.make();
      host.appendChild(el('p', 'section-eyebrow',
        'Question ' + (at + 1) + ' of ' + questions.length));
      // promptHtml is already escaped by whoever built it, and carries the
      // line breaks a whole verse needs
      host.appendChild(el('div', 'quiz-prompt', q.promptHtml || esc(q.prompt)));

      var mine = answers[at];
      var box = el('div', 'choice-list');
      for (var i = 0; i < q.options.length; i++) {
        (function (opt) {
          var picked = !!mine && mine.text === opt.text;
          var b = el('button', 'choice-btn' + (picked ? ' is-picked' : ''));
          b.type = 'button';
          // a whole verse arrives with newlines in it
          b.innerHTML = esc(opt.text).split(NL).join('<br>');
          b.setAttribute('data-opt', opt.text);
          /* Record and move on, with nothing said about it. The last question
             does not advance - there is nowhere to advance to, and walking off
             the end of the run is a thing you should have to ask for. */
          b.addEventListener('click', function () {
            if (over) return;
            answers[at] = { text: opt.text };
            if (at < questions.length - 1) {
              at++;
              paintChosen();
              draw();
              window.scrollTo(0, 0);
            } else {
              paintChosen();
              draw();
            }
          });
          box.appendChild(b);
        })(q.options[i]);
      }
      host.appendChild(box);

      nextBtn.textContent = at === questions.length - 1 ? 'Check it' : 'Next';
      /* Hidden rather than absent on the first question, so the button beside
         it does not move under your thumb between one question and the next. */
      backBtn.style.visibility = at === 0 ? 'hidden' : 'visible';
      backBtn.title = at === 0 ? '' : 'Back to question ' + at;
    }

    /* THE ONE STEP THAT CANNOT BE TAKEN BACK is the one that ends the run, so
       it is the only one that asks - and it names what is still blank, because
       the commonest way to lose marks here is now to walk off the end with a
       question you meant to come back to. */
    function goNext() {
      if (over) return;
      if (at === questions.length - 1) {
        var blank = questions.length - answeredCount();
        if (!S.practiceRun &&
            !confirm('Check it now?' + NL + NL +
                     'That grades the run and ends it.' +
                     (blank ? NL + NL + blank + ' question' + (blank === 1 ? '' : 's') +
                              ' still unanswered, and they count against you.' : ''))) return;
        finish();
        return;
      }
      at++;
      paintChosen();
      draw();
      window.scrollTo(0, 0);
    }
    function goBack() {
      if (over || at === 0) return;
      at--;
      paintChosen();
      draw();
      window.scrollTo(0, 0);
    }
    nextBtn.addEventListener('click', goNext);
    backBtn.addEventListener('click', goBack);

    paintChosen();
    draw();
  }

  /**
   * Tampered distractors for a pick-one question.
   *
   * Some are made from THE ANSWER - one word off, so the right-looking option
   * has to be read rather than recognised. The rest are made from elsewhere in
   * the same song, so a wrong option can be both the wrong line AND a doctored
   * one. Only ever tampering the answer, which is what this used to do, made
   * every question the same shape: the true line, its evil twin, and some
   * strangers.
   *
   * units is an array of line-arrays, so one helper covers whole sections and
   * single lines alike.
   */
  function tamperedSet(answerLines, otherUnits, n, pct, pool) {
    var out = [];
    for (var i = 0; i < n; i++) {
      // the first one is a coin toss, the rest lean away from the answer
      var fromAnswer = (i === 0) ? (Math.random() < 0.5) : (Math.random() < 0.25);
      var src = (fromAnswer || !otherUnits.length)
        ? answerLines
        : otherUnits[Math.floor(Math.random() * otherUnits.length)];
      var f = tamper(src, pct, pool);
      if (f) {
        var text = f.join(NL);
        if (out.indexOf(text) === -1) out.push(text);
      }
    }
    return out;
  }

  /**
   * The answer plus its distractors, shuffled.
   *
   * Three kinds of wrong answer go into ONE hat and are drawn from together:
   * doctored copies, lines borrowed from other songs, and plain untouched lines
   * from elsewhere in this one. The dials decide how much of each kind is in
   * the hat; chance decides which of them come out. So the mix moves from
   * question to question, and no kind is guaranteed a seat.
   *
   * That is deliberate on both counts. Left to themselves the doctored and
   * borrowed lines filled every slot at the tighter levels, so a question could
   * offer nothing but the answer, its evil twin and two strangers, and never
   * once ask you to tell two real lines of this song apart. But handing the
   * plain line a reserved seat every time is its own tell - a fixed recipe is
   * something you learn to read instead of reading the lyrics.
   *
   * How many plain-but-misplaced lines go into the hat is no longer half the
   * ringer count and a shrug - it is the decoy half of the borrowN split, so
   * the easy rungs fill up with strangers you can throw out on sight and the
   * hard ones fill up with this song's own words in the wrong order. The list
   * is only as long as the choice floor or the planted count needs it to be,
   * so tuning a game up still shows.
   */
  /**
   * Everything that legitimately follows this cue. Normally one thing - but a
   * song that sings a line twice can be followed by two different lines, and
   * only one of them is the one the question happened to be built from.
   */
  function followersOf(seq, cue, fallback) {
    var out = [];
    for (var i = 0; i + 1 < seq.length; i++) {
      if (normWord(seq[i]) !== normWord(cue)) continue;
      if (out.indexOf(seq[i + 1]) === -1) out.push(seq[i + 1]);
    }
    if (!out.length) out.push(fallback);
    return out;
  }

  function orderOptions(answer, realPool, tampered, borrowed, nDecoy, mode, level) {
    var wrong = [], i;
    function add(t) { if (t !== answer && wrong.indexOf(t) === -1) wrong.push(t); }

    var shuffledReal = shuffled(realPool), plain = [];
    for (i = 0; i < shuffledReal.length; i++) {
      if (shuffledReal[i] !== answer && plain.indexOf(shuffledReal[i]) === -1) {
        plain.push(shuffledReal[i]);
      }
    }
    var ringers = tampered.concat(borrowed);
    var share = Math.max(1, Number(nDecoy) || 0);
    var hat = shuffled(ringers.concat(plain.slice(0, share)));
    var want = Math.max(choiceFloor(mode, level), 1 + ringers.length + share);

    for (i = 0; i < hat.length && wrong.length < want - 1; i++) add(hat[i]);
    // the hat can run dry on a short song or a level that plants nothing
    for (i = 0; i < plain.length && wrong.length < want - 1; i++) add(plain[i]);

    var opts = shuffled([answer].concat(wrong)), list = [];
    for (i = 0; i < opts.length; i++) list.push({ text: opts[i] });
    return list;
  }

  /* ---------- SORT: arrange them, throw the ringers out ---------- */
  /**
   * Ringers make this a different game. Without them you can get a perfect
   * score by recognising nothing - just shuffling until the shapes look
   * right - so borrowed and tampered material is mixed in and thrown away with
   * the cross. Keeping one costs you, and so does discarding a real one.
   *
   * Every card shows its TYPE and nothing else. It used to show the real ones
   * as "Verse 1", "Verse 2", "Chorus" - which is the answer, printed on the
   * cards, and it also made a ringer labelled plain "verse" obvious without
   * reading it.
   */
  function sortWidget(items, decoys, binName) {
    /* NO RINGER MAY READ THE SAME AS A CARD THAT BELONGS, or as another
       ringer. This is the bug that made a board you had ordered correctly come
       back wrong.

       A tampered copy is built by swapping words out of a real line, and
       nothing stopped a swap landing on the word that made it read as some
       OTHER line of the same section; a borrowed line out of another song can
       arrive as a phrase this song also sings. Either way you are shown two
       identical cards, told one of them does not belong, and there is no
       reading of the board that can tell you which - so half the time you
       throw out the real one.

       Dropping the collision is the whole fix. A board with one ringer fewer
       is a slightly easier board; a board with an unanswerable card on it is
       a broken one. */
    var realText = {}, q0, k0;
    for (q0 = 0; q0 < items.length; q0++) realText[normWord(items[q0].peek)] = true;
    var clean = [], ringText = {};
    for (q0 = 0; q0 < decoys.length; q0++) {
      k0 = normWord(decoys[q0].peek);
      if (realText[k0] || ringText[k0]) continue;
      ringText[k0] = true;
      clean.push(decoys[q0]);
    }
    decoys = clean;

    var pool = shuffled(items.concat(decoys));
    var kept = pool.slice(), binned = [];

    // does this board hold the same words twice?
    var twins = false, seenText = {};
    for (q0 = 0; q0 < items.length; q0++) {
      k0 = normWord(items[q0].peek);
      if (seenText[k0]) twins = true;
      seenText[k0] = true;
    }
    var byKey = {};
    for (var b0 = 0; b0 < pool.length; b0++) byKey[pool[b0].key] = pool[b0];

    var node = el('div');
    var host = el('div', 'sort-list');
    node.appendChild(host);
    var binWrap = el('div');
    node.appendChild(binWrap);

    var dragging = false;

    /**
     * Rebuild the order from the DOM after a drag, then renumber.
     *
     * THE GRADED ORDER IS WHATEVER IS ON THE SCREEN. This used to bail out
     * whenever the two lengths disagreed, on the reasoning that a rebuild that
     * had lost a card was not to be trusted - which left the board showing one
     * order and the grader holding another, silently, with nothing on screen
     * to say so. Take the DOM order for every card it names and put anything
     * it failed to name back on the end: a card that is on the board is
     * graded, always, and the two can no longer drift apart.
     */
    function commitOrder() {
      var next = [], seen = {}, i, k;
      for (i = 0; i < host.children.length; i++) {
        k = host.children[i].getAttribute('data-key');
        if (byKey[k] && !seen[k]) { seen[k] = true; next.push(byKey[k]); }
      }
      for (i = 0; i < kept.length; i++) {
        if (!seen[kept[i].key]) next.push(kept[i]);
      }
      kept = next;
      draw();
    }

    /**
     * Drag near the top or bottom of the screen and the page creeps, so a
     * card can be taken somewhere off-screen. A line-sort board on a phone is
     * taller than the window, and without this the bottom half is unreachable.
     */
    function edgeScroll(y) {
      var margin = 76;
      var over = 0;
      if (y < margin) over = -(margin - y);
      else if (y > window.innerHeight - margin) over = y - (window.innerHeight - margin);
      if (!over) return;
      var step = over / 5;
      if (step > 18) step = 18;
      if (step < -18) step = -18;
      window.scrollBy(0, step);
    }

    /**
     * Drag by the grip. The card follows the pointer, and as its middle
     * crosses a neighbour's middle the node is moved in the DOM and the offset
     * re-zeroed - so the card sits under your finger in its new slot rather
     * than drifting away from it.
     *
     * THE LISTENERS GO ON THE DOCUMENT, AND THE CAPTURE ON THE LIST. Both
     * matter, and getting either wrong is what made a card stick to the
     * cursor:
     *
     *   - Capturing on the grip looks right and is fatal. Reordering moves the
     *     card through the DOM, the grip rides inside it, and an element that
     *     leaves the document loses its pointer capture - so the very first
     *     reorder killed the capture and every move after it went to whatever
     *     happened to be under the cursor. The list itself never moves.
     *   - Listening on the document, in the capture phase, means a pointerup
     *     ANYWHERE ends the drag: outside the list, over another control, or
     *     off the edge of the window. A blur ends it too, for the case where
     *     the button is released over some other application entirely.
     */
    function startDrag(ev, card) {
      if (dragging) return;
      if (ev.button !== undefined && ev.button !== 0) return;   // not a right-click
      dragging = true;
      var anchor = ev.clientY;
      var pid = ev.pointerId;
      card.className = 'sort-card dragging';
      host.className = 'sort-list is-dragging';
      if (ev.cancelable) ev.preventDefault();
      try { host.setPointerCapture(pid); } catch (e) {}

      function move(e2) {
        if (e2.pointerId !== undefined && e2.pointerId !== pid) return;
        if (e2.cancelable) e2.preventDefault();
        card.style.transform = 'translateY(' + (e2.clientY - anchor) + 'px)';
        edgeScroll(e2.clientY);
        var mine = card.getBoundingClientRect();
        var cy = (mine.top + mine.bottom) / 2;
        var kids = host.children;
        for (var k = 0; k < kids.length; k++) {
          var other = kids[k];
          if (other === card) continue;
          var r = other.getBoundingClientRect();
          var oc = (r.top + r.bottom) / 2;
          var cardIsAfter = (other.compareDocumentPosition(card) & 4) !== 0;
          var cardIsBefore = (other.compareDocumentPosition(card) & 2) !== 0;
          if (cy < oc && cardIsAfter) {
            host.insertBefore(card, other);
          } else if (cy > oc && cardIsBefore) {
            host.insertBefore(card, other.nextSibling);
          } else {
            continue;
          }
          anchor = e2.clientY;
          card.style.transform = 'translateY(0px)';
          break;
        }
      }
      function stop(e3) {
        if (e3 && e3.pointerId !== undefined && e3.pointerId !== pid) return;
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', stop, true);
        document.removeEventListener('pointercancel', stop, true);
        window.removeEventListener('blur', stop);
        try { host.releasePointerCapture(pid); } catch (e) {}
        card.style.transform = '';
        dragging = false;
        commitOrder();
      }
      document.addEventListener('pointermove', move, true);
      document.addEventListener('pointerup', stop, true);
      document.addEventListener('pointercancel', stop, true);
      window.addEventListener('blur', stop);
    }

    function draw() {
      host.className = 'sort-list';
      host.innerHTML = '';
      for (var n = 0; n < kept.length; n++) {
        (function (it, pos) {
          var card = el('div', 'sort-card');
          card.setAttribute('data-key', it.key);
          var grip = el('button', 'sort-grip',
            '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">' +
            '<circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/>' +
            '<circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>' +
            '<circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>');
          grip.type = 'button';
          grip.title = 'Drag to move';
          grip.addEventListener('pointerdown', function (ev) { startDrag(ev, card); });
          card.appendChild(grip);

          var mid = el('div');
          mid.style.flex = '1';
          mid.style.minWidth = '0';
          mid.innerHTML =
            '<div class="sort-kind">' + (pos + 1) + '. ' + esc(it.kind) + '</div>' +
            '<div class="sort-preview">' + esc(it.peek) + '</div>';
          card.appendChild(mid);

          /* THE UP AND DOWN ARROWS ARE GONE. Two 30x22 buttons stacked in the
             corner of every card, on a board that is already dragged - they
             took the space the two controls you do use needed, and on a phone
             all three were a coin toss to hit. The grip and the cross get that
             space between them instead. */
          var out = el('button', 'sort-bin', '&#10007;');
          out.type = 'button';
          out.title = binName || 'Not in this song';
          out.addEventListener('click', function () {
            binned.push(kept[pos]); kept.splice(pos, 1); draw();
            /* The tray is at the foot of a board that can be taller than the
               window, so a card thrown out by a thumb that meant the grip
               beside it just vanished, silently, with nothing on the screen
               you were looking at to say where it went. */
            toast('Thrown out - it is in the tray at the foot of the board');
          });
          card.appendChild(out);
          host.appendChild(card);
        })(kept[n], n);
      }

      binWrap.innerHTML = '';
      if (twins) {
        binWrap.appendChild(el('p', 'twin-note',
          'This one repeats itself - where two cards read the same, either can ' +
          'go in either place.'));
      }
      binWrap.appendChild(el('p', 'section-eyebrow',
        (binName || 'Not in this song') + ' (' + binned.length + ')'));
      binWrap.appendChild(el('p', 'form-hint mt-0', binned.length
        ? 'Tap any of these to put it back on the board.'
        : 'Tap the cross on anything that does not belong.'));
      var tray = el('div', 'bin-tray');
      for (var b = 0; b < binned.length; b++) {
        (function (it, pos) {
          var chip = el('button', 'bin-chip', esc(it.peek));
          chip.type = 'button';
          chip.title = 'Put it back';
          chip.addEventListener('click', function () {
            kept.push(binned[pos]); binned.splice(pos, 1); draw();
          });
          tray.appendChild(chip);
        })(binned[b], b);
      }
      binWrap.appendChild(tray);
    }
    draw();

    return {
      node: node,
      grade: function () {
        var realKept = [], rows = [], right = 0, i, k;
        for (k = 0; k < kept.length; k++) if (kept[k].real) realKept.push(kept[k]);

        /* A LINE YOU THREW OUT COSTS ONE MARK, NOT EVERY LINE UNDER IT.
           The board used to be zipped straight onto the song - first real card
           against the first line, second against the second - so throwing out
           one card that did belong shifted every card below it up a slot and
           marked the lot of them wrong, and the last position came back
           reading "you left this position empty", which is not something this
           game can even do. One mistake, reported as most of the board.

           So: take the ones you threw out off the expected list first, mark
           each of them wrong exactly where it belongs, and grade the ORDER on
           what is actually still up there. Get the order right and the
           throw-out is the only thing against you. */
        var tossedReal = {}, tk;
        for (k = 0; k < binned.length; k++) {
          if (!binned[k].real) continue;
          tk = normWord(binned[k].peek);
          tossedReal[tk] = (tossedReal[tk] || 0) + 1;
        }
        var expect = [];
        for (i = 0; i < items.length; i++) {
          tk = normWord(items[i].peek);
          if (tossedReal[tk]) {
            tossedReal[tk]--;
            rows.push({
              ok: false,
              got:  { label: 'thrown out', peek: 'you threw this one out' },
              want: { label: items[i].kind, peek: items[i].peek }
            });
            continue;
          }
          expect.push(items[i]);
        }

        /* GRADED ON WHAT THE CARD SAYS, NOT WHICH CARD IT IS.
           A song that sings the same line twice puts two identical cards on the
           board, and there is no way on earth to know which copy the app meant
           to go first - so it used to be a coin flip that could only be got
           wrong. Comparing the text makes the two interchangeable, which is the
           only honest reading: you still have to know the line goes in both
           those places. */
        for (i = 0; i < expect.length; i++) {
          var want = expect[i];
          var got = realKept[i] || null;
          var ok = !!got && normWord(got.peek) === normWord(want.peek);
          if (ok) right++;
          rows.push({
            ok: ok,
            got:  { label: got ? got.kind : 'nothing',
                    peek: got ? got.peek : 'nothing here' },
            want: { label: want.kind, peek: want.peek }
          });
        }
        // a ringer left on the board is a mistake of its own
        for (var d = 0; d < decoys.length; d++) {
          var tossed = false;
          for (var t = 0; t < binned.length; t++) if (binned[t].key === decoys[d].key) tossed = true;
          if (tossed) right++;
          rows.push({
            ok: tossed,
            got:  { label: tossed ? 'thrown out' : 'kept', peek: decoys[d].peek },
            want: { label: (binName || 'not in this song').toLowerCase(),
                    peek: decoys[d].from || 'from another song' }
          });
        }
        return { right: right, total: items.length + decoys.length, rows: rows };
      }
    };
  }

  /** One board, one submit - the whole-song case. */
  function runSortGame(song, idx, mode, level, items, decoys, heads, note) {
    var w = sortWidget(items, decoys), over = false;

    function finish() {
      if (over) return;
      over = true;
      stopGameClock();
      var g = w.grade();          // grades the board exactly as it stands
      finishGame(song, idx, mode, level, g.right, g.total, g.rows,
                 heads || ['You put', 'The song']);
    }

    var wrap = gameShell(song, mode, level, note, finish);
    wrap.appendChild(el('p', 'drag-hint',
      'Drag by the dots to reorder. The cross throws a card out.'));
    wrap.appendChild(w.node);
    appEl.appendChild(wrap);

    var bar = el('div', 'quiz-submit-bar');
    var submit = el('button', 'btn btn-gold btn-block', 'Check it');
    submit.addEventListener('click', finish);
    bar.appendChild(submit);
    appEl.appendChild(bar);
    buildFooter();
  }

  /* ---------- STEP: one section at a time ----------
     THERE IS NO AUTO-ADVANCE ANY MORE, and the reason is worth keeping.

     A step used to be handed a controller with an advance() on it, so a board
     that was finished the moment its last blank filled could move on by itself
     after a beat. Kyle found what that beat cost: fill the last gap, tap Next
     section in the 320ms before the timer fires, and you advance TWICE. The
     second advance grades a section you were never shown - untouched, nothing
     placed - and the results screen then tells you that you failed to place
     lines you never saw. It reads as a scoring bug and it is really a race.

     Scramble Lines was the only game that used it, and it is one board now, so
     the controller went with it rather than being fixed: a convenience that
     can skip a section is not a convenience.

     GENERALISE: NEVER LET A TIMER AND A BUTTON DRIVE THE SAME TRANSITION.
     If both can fire, they will both fire, and the second one lands on a state
     that has already moved. */
  /**
   * A GAME THAT WALKS THE SONG A SECTION AT A TIME.
   *
   * GRADING HAPPENS AT THE END, NOT ON THE WAY PAST - 1.52. It used to grade
   * each section as you left it and add the marks to a running total, which
   * made the walk one-way by construction: going back would have meant
   * un-counting a section, and un-counting is the kind of arithmetic that ends
   * with a board scored twice. Every step keeps its own node and its own
   * grader, so the totals can simply be taken at the end, in one pass, from
   * whatever state the boards are actually in.
   *
   * That is what lets Back exist, and Back had to exist: these boards are
   * finished with a button that says Next section, and a mis-aimed thumb on the
   * last line of a verse took the whole run away from you with no way to
   * return to it.
   *
   * WHAT YOU NEVER REACHED STILL COUNTS FOR NOTHING. The clock stopping is not
   * the same event as walking off the end, so 'seen' is the furthest section
   * you have actually been shown - not where you happen to be standing when
   * time runs out. Go back to verse one from verse four and expire there, and
   * all four are graded, because you saw all four. The ones past it are counted
   * into the total and score nothing.
   *
   * That last part matters more than it looks. An untouched Impostor board
   * scores every real line correct simply because you never flagged it, so
   * grading the unseen steps normally would hand out most of their marks for
   * running out of time - the exact opposite of a penalty.
   */
  function runStepGame(song, idx, mode, level, steps, heads, note) {
    var at = 0, seen = 0, over = false;

    function finish() {
      if (over) return;
      over = true;
      stopGameClock();
      var right = 0, total = 0, rows = [], k, r;
      for (k = 0; k <= seen && k < steps.length; k++) {
        var g = steps[k].grade();
        right += g.right;
        total += g.total;
        for (r = 0; r < g.rows.length; r++) rows.push(g.rows[r]);
      }
      for (k = seen + 1; k < steps.length; k++) {
        var skipped = steps[k].grade();
        total += skipped.total;
        rows.push({ ok: false,
          got:  { label: steps[k].label, peek: 'never reached - the clock ran out' },
          want: { label: steps[k].label, peek: skipped.total + ' left unplayed' } });
      }
      finishGame(song, idx, mode, level, right, total, rows, heads || ['You', 'The song']);
    }

    var wrap = gameShell(song, mode, level, note, finish);
    var host = el('div');
    wrap.appendChild(host);
    appEl.appendChild(wrap);

    /* Back sits beside Check it rather than up with the heading, because it is
       the twin of the button you pressed by mistake and belongs under the same
       thumb. It is narrow: it is the way out of a slip, not a mode of play. */
    var bar = el('div', 'quiz-submit-bar');
    var row = el('div', 'step-bar');
    var backBtn = el('button', 'btn btn-outline step-back', 'Back');
    backBtn.type = 'button';
    var submit = el('button', 'btn btn-gold step-next', '');
    submit.type = 'button';
    row.appendChild(backBtn);
    row.appendChild(submit);
    bar.appendChild(row);
    appEl.appendChild(bar);
    buildFooter();

    function draw() {
      host.innerHTML = '';
      var st = steps[at];
      host.appendChild(el('p', 'section-eyebrow',
        st.label + '  &middot;  ' + (at + 1) + ' of ' + steps.length));
      host.appendChild(st.node);
      submit.textContent = at === steps.length - 1 ? 'Check it' : 'Next section';
      /* Hidden rather than absent on the first section, so Check it does not
         move under your thumb between one section and the next. */
      backBtn.style.visibility = at === 0 ? 'hidden' : 'visible';
      backBtn.title = at === 0 ? '' : 'Back to ' + steps[at - 1].label;
      window.scrollTo(0, 0);
    }

    /* THE ONE STEP THAT CANNOT BE TAKEN BACK is the one that ends the run, so
       it is the only one that asks. Everything before it is free: nothing is
       banked until the whole walk is graded. */
    function step() {
      if (over) return;
      if (at === steps.length - 1) {
        if (!S.practiceRun && steps.length > 1 &&
            !confirm('Check it now?' + NL + NL +
                     'That grades every section and ends the run.')) return;
        finish();
        return;
      }
      at++;
      if (at > seen) seen = at;
      draw();
    }
    function stepBack() {
      if (over || at === 0) return;
      at--;
      draw();
    }
    submit.addEventListener('click', step);
    backBtn.addEventListener('click', stepBack);
    draw();
  }

  var FUNCTION_WORDS = {
    the: 1, a: 1, an: 1, and: 1, or: 1, but: 1, of: 1, to: 1, in: 1, on: 1, at: 1,
    for: 1, with: 1, from: 1, by: 1, as: 1, is: 1, are: 1, was: 1, were: 1, be: 1,
    been: 1, am: 1, i: 1, you: 1, he: 1, she: 1, it: 1, we: 1, they: 1, me: 1,
    him: 1, her: 1, us: 1, them: 1, my: 1, your: 1, his: 1, its: 1, our: 1,
    their: 1, this: 1, that: 1, these: 1, those: 1, so: 1, if: 1, when: 1,
    then: 1, than: 1, up: 1, down: 1, out: 1, no: 1, not: 1, all: 1, do: 1,
    did: 1, does: 1, will: 1, would: 1, can: 1, could: 1, have: 1, has: 1, had: 1
  };
  function isFunctionWord(w) { return !!FUNCTION_WORDS[normWord(w)]; }

  /**
   * Case the fake the way ENGLISH would case it, not the way the word it
   * replaced happened to be cased.
   *
   * Copying the sample's case is right almost everywhere and wrong in exactly
   * one place, which Kyle caught: the pronoun I. It is capitalised wherever it
   * stands, so it carries no information about its position - and it is the
   * only common one-letter word besides "a", so those two swap for each other
   * constantly. Copying the case gave you both halves of the tell at once:
   *
   *   I wont cry, A wont cry, no I wont shed i tear
   *
   * A mid-line "A" is not how anyone writes, and a lone lower-case "i" is not
   * either. You could find both without knowing a word of the song.
   *
   * So: the pronoun always comes out capitalised, and when the word being
   * REPLACED is the pronoun its capital is ignored in favour of where the word
   * actually sits, because a capital I at the end of a line means nothing.
   * Everything else still copies the sample.
   *
   * atStart is whether this word opens its line - the only position that
   * genuinely licenses a capital.
   */
  function matchCase(sample, word, atStart) {
    var lower = String(word).toLowerCase();
    var capped = lower.charAt(0).toUpperCase() + lower.slice(1);
    if (lower === 'i') return 'I';                 // the pronoun, anywhere
    if (normWord(sample) === 'i') return atStart ? capped : lower;
    var first = String(sample).charAt(0);
    if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
      return capped;
    }
    return lower;
  }

  function pickImpostor(word, pool, atStart) {
    var target = normWord(word);
    var fn = isFunctionWord(word);
    var tiers = {};
    for (var i = 0; i < pool.length; i++) {
      var cand = pool[i], c = normWord(cand);
      if (!c || c === target) continue;
      if (isFunctionWord(cand) !== fn) continue;
      var d = Math.abs(c.length - target.length);
      if (d > 3) continue;
      if (!tiers[d]) tiers[d] = [];
      tiers[d].push(cand);
    }
    for (var k = 0; k <= 3; k++) {
      if (tiers[k] && tiers[k].length) {
        return matchCase(word, tiers[k][Math.floor(Math.random() * tiers[k].length)],
                         atStart);
      }
    }
    return null;
  }

  /**
   * Every word in the song plus every word in the ringers, STRIPPED OF THE
   * MARKS AROUND THEM. The pool used to hold raw tokens, so a fake could
   * arrive as "night," - comma and all - and be planted in the middle of a
   * line where no comma belongs. Punctuation that moves is a tell you can read
   * without knowing a word of the song.
   */
  function wordPool(song, decoys) {
    var out = [];
    for (var i = 0; i < song.sections.length; i++) {
      var ls = song.sections[i].lines || [];
      for (var j = 0; j < ls.length; j++) {
        if (!ls[j].t) continue;
        var ws = words(ls[j].t);
        for (var k = 0; k < ws.length; k++) if (normWord(ws[k])) out.push(bareWord(ws[k]));
      }
    }
    for (var d = 0; d < decoys.lines.length; d++) {
      var dw = words(decoys.lines[d].t);
      for (var m = 0; m < dw.length; m++) if (normWord(dw[m])) out.push(bareWord(dw[m]));
    }
    return out;
  }

  /**
   * A fake to stand where this word stands - in the same case, inside the same
   * punctuation. The comma stays put because it belongs to the line, not to
   * the word that happens to be sitting in front of it.
   */
  function fakeWord(raw, pool, atStart) {
    var rep2 = pickImpostor(bareWord(raw), pool, atStart);
    if (!rep2) return null;
    return leadPunct(raw) + rep2 + trailPunct(raw);
  }

  /** How many of n to touch, always at least one and never all of them. */
  function shareOf(n, pct) {
    var k = Math.round(n * pct / 100);
    if (k < 1) k = 1;
    if (k > n - 1) k = Math.max(1, n - 1);
    return k;
  }

  /**
   * A copy of these lines with a share of the words swapped for fakes. Returns
   * null when nothing could be swapped - a "tampered" copy identical to the
   * original would be an unanswerable question, so the caller drops it.
   */
  function tamper(lines, pct, pool) {
    var rows = [], flat = [], l, w;
    for (l = 0; l < lines.length; l++) {
      var ws = words(lines[l]), row = [];
      for (w = 0; w < ws.length; w++) {
        // only the word that OPENS a line is licensed a capital by position
        var tok = { text: ws[w], atStart: w === 0 };
        row.push(tok);
        if (normWord(ws[w])) flat.push(tok);
      }
      rows.push(row);
    }
    if (!flat.length) return null;
    var picks = shuffled(flat).slice(0, shareOf(flat.length, pct));
    var swapped = 0;
    for (var p = 0; p < picks.length; p++) {
      var rep2 = fakeWord(picks[p].text, pool, picks[p].atStart);
      if (!rep2) continue;
      picks[p].text = rep2;
      swapped++;
    }
    if (!swapped) return null;
    var out = [];
    for (var r = 0; r < rows.length; r++) {
      var parts = [];
      for (var c = 0; c < rows[r].length; c++) parts.push(rows[r][c].text);
      out.push(parts.join(' '));
    }
    return out;
  }


  /* ---------- Verse Sort / Line Sort ---------- */
  function startSortGame(song, idx, mode, level, decoys, unit) {
    var d = gameDials(mode, level);
    var pool = wordPool(song, decoys);
    var secs = realSections(song);

    if (unit === 'verse') {
      // Whole verses on the cards. Ordering a song off its first lines is a
      // different and much easier trick than ordering the song.
      // .sort-preview is pre-wrap, so the newlines render as written.
      var items = [], ringers = [], i;
      for (i = 0; i < secs.length; i++) {
        items.push({ key: 'r' + i, real: true, kind: secs[i].type,
                     peek: secs[i].lines.join(NL) });
      }
      var borrowed = shuffled(shapedVerses(song, decoys.verses))
        .slice(0, pickCount(d.borrowN));
      for (i = 0; i < borrowed.length; i++) {
        ringers.push({ key: 'b' + i, real: false, kind: borrowed[i].type || 'verse',
                       from: 'from ' + (borrowed[i].from || 'another song'),
                       peek: borrowed[i].lines.join(NL) });
      }
      var srcs = shuffled(secs), nEdit = pickCount(d.editN);
      for (i = 0; i < nEdit && srcs.length; i++) {
        var base = srcs[i % srcs.length];
        var faked = tamper(base.lines, d.editPct, pool);
        if (!faked) continue;
        ringers.push({ key: 'e' + i, real: false, kind: base.type,
                       from: 'this song, with words changed',
                       peek: faked.join(NL) });
      }
      runSortGame(song, idx, mode, level, items, ringers, ['You put', 'The song'],
        ringers.length
          ? 'Put the sections in order. Some of these are not in this song at all, and some are it with the words tampered with.'
          : 'Put the sections in order.');
      return;
    }

    // Every section gets its own board, walked one at a time - doing a single
    // verse and calling it a game left most of the song untouched.
    var spare = shuffled(decoys.lines), used = 0, steps = [];
    for (var s2 = 0; s2 < secs.length; s2++) {
      (function (sec, myIndex) {
        if (sec.lines.length < 2) return;
        var its = [], rings = [], k;
        var here = {};
        for (k = 0; k < sec.lines.length; k++) {
          // NOT clipped. A card that ends in an ellipsis asks you to order
          // lines you have not been shown the end of.
          its.push({ key: 'r' + k, real: true, kind: 'line', peek: sec.lines[k] });
          here[normWord(sec.lines[k])] = true;
        }
        /* A DECOY HERE IS ONE OF THIS SONG'S OWN LINES FROM ANOTHER SECTION.
           The board is one section, so a line out of the next verse genuinely
           does not belong on it - and unlike a borrowed line there is nothing
           foreign about it to notice. Anything this section already says is
           left out of the pool: two cards reading the same, one of which you
           are supposed to throw away, is a coin toss you can only lose. */
        var elsewhere = [];
        for (k = 0; k < secs.length; k++) {
          if (k === myIndex) continue;
          for (var q = 0; q < secs[k].lines.length; q++) {
            if (!here[normWord(secs[k].lines[q])]) {
              elsewhere.push({ t: secs[k].lines[q], label: secs[k].label });
            }
          }
        }
        elsewhere = shuffled(elsewhere);
        var plant = plantSplit(pickCount(d.borrowN), d.decoyPct);
        for (k = 0; k < plant.borrow && used < spare.length; k++, used++) {
          rings.push({ key: 'b' + used, real: false, kind: 'line',
                       from: 'from ' + (spare[used].from || 'another song'),
                       peek: spare[used].t });
        }
        for (k = 0; k < plant.decoy && k < elsewhere.length; k++) {
          rings.push({ key: 'd' + k, real: false, kind: 'line',
                       from: 'this song, but it belongs in ' + elsewhere[k].label,
                       peek: elsewhere[k].t });
        }
        var ne = pickCount(d.editN), mine = shuffled(sec.lines);
        for (k = 0; k < ne; k++) {
          var faked2 = tamper([mine[k % mine.length]], d.editPct, pool);
          if (!faked2) continue;
          rings.push({ key: 'e' + k, real: false, kind: 'line',
                       from: 'this song, with words changed',
                       peek: faked2[0] });
        }
        var w = sortWidget(its, rings, 'Not in this section');
        steps.push({ label: sec.label, node: w.node, grade: w.grade });
      })(secs[s2], s2);
    }
    if (!steps.length) { toast('No section here has more than one line'); back(); return; }
    runStepGame(song, idx, mode, level, steps, ['You put', 'The song'],
      'Put each section back in order. Drag by the dots. Throw out anything that does not belong in it - some of the strays are this song, from somewhere else in it.');
  }

  /* ---------- Verse Order / Line Order ---------- */
  function startOrderGame(song, idx, mode, level, decoys, unit) {
    var d = gameDials(mode, level);
    var pool = wordPool(song, decoys);
    var questions = [], i, k;

    if (unit === 'verse') {
      var secs = realSections(song);
      if (secs.length < 3) { toast('This song has too few sections for that'); back(); return; }
      var seq = [], cue = [];
      for (i = 0; i < secs.length; i++) {
        seq.push(secs[i].lines.join(NL));           // the WHOLE verse, not its first line
        cue.push(secs[i].lines[0]);
      }
      var borrowPool = shapedVerses(song, decoys.verses);
      for (i = 0; i < secs.length; i++) {
        (function (n) {
          questions.push({
            prompt: n === 0 ? 'Which section opens the song?'
                            : 'What comes after "' + clipLine(cue[n - 1], 40) + '"?',
            short: n === 0 ? 'opening' : 'position ' + (n + 1),
            answer: seq[n],
            answers: n === 0 ? [seq[n]] : followersOf(seq, seq[n - 1], seq[n]),
            make: function () {
              var otherSecs = [];
              for (var k = 0; k < secs.length; k++) {
                if (k !== n) otherSecs.push(secs[k].lines);
              }
              var tampered = tamperedSet(secs[n].lines, otherSecs, pickCount(d.editN),
                                         d.editPct, pool);
              var plant = plantSplit(pickCount(d.borrowN), d.decoyPct);
              var lifted = [], picks = shuffled(borrowPool).slice(0, plant.borrow);
              for (k = 0; k < picks.length; k++) lifted.push(picks[k].lines.join(NL));
              return orderOptions(seq[n], seq.slice(), tampered, lifted, plant.decoy,
                                  mode, level);
            }
          });
        })(i);
      }
      runOrderGame(song, idx, mode, level, questions, ['You picked', 'The song']);
      return;
    }

    // every section, not just the longest one
    var all = realSections(song), linePool = [], farLines = [];
    for (i = 0; i < all.length; i++) {
      for (k = 0; k < all[i].lines.length; k++) linePool.push(all[i].lines[k]);
    }
    for (i = 0; i < decoys.lines.length; i++) farLines.push(decoys.lines[i].t);
    for (var s = 0; s < all.length; s++) {
      if (all[s].lines.length < 2) continue;
      for (var n = 0; n < all[s].lines.length; n++) {
        (function (sec, at) {
          var ans = sec.lines[at];
          questions.push({
            prompt: at === 0 ? 'Which line opens ' + sec.label + '?'
                             : 'In ' + sec.label + ', what comes after "' +
                               clipLine(sec.lines[at - 1], 40) + '"?',
            short: sec.label + ' ' + (at === 0 ? 'opening' : 'position ' + (at + 1)),
            answer: ans,
            answers: at === 0 ? [ans]
                              : followersOf(sec.lines, sec.lines[at - 1], ans),
            make: function () {
              // every OTHER line in the song is fair game to doctor, not just this one
              var otherLines = [];
              for (var k = 0; k < linePool.length; k++) {
                if (linePool[k] !== ans) otherLines.push([linePool[k]]);
              }
              var tamp = tamperedSet([ans], otherLines, pickCount(d.editN), d.editPct, pool);
              var plant = plantSplit(pickCount(d.borrowN), d.decoyPct);
              var lift = shuffled(farLines).slice(0, plant.borrow);
              return orderOptions(ans, linePool.slice(), tamp, lift, plant.decoy,
                                  mode, level);
            }
          });
        })(all[s], n);
      }
    }
    if (!questions.length) { toast('No section here has more than one line'); back(); return; }
    runOrderGame(song, idx, mode, level, questions, ['You picked', 'The song']);
  }

  /* ---------- Word Scramble ---------- */
  /**
   * Only a share of each verse is lifted out, not the whole thing. Blanking a
   * line completely tests reconstruction from nothing; blanking a share of it
   * tests whether you know the words in place, which is the thing you actually
   * need on stage. The bank carries a few words that fit nowhere, so a full
   * bank is not by itself proof that every slot has a home.
   */
  function startScramble(song, idx, mode, level, decoys) {
    var d = gameDials(mode, level);
    var pool = wordPool(song, decoys);
    var secs = realSections(song);
    if (!secs.length) { toast('Nothing to play here'); back(); return; }

    var steps = [];
    for (var s = 0; s < secs.length; s++) {
      steps.push(scrambleStep(secs[s], d.missPct, pickCount(d.extraN), pool, d.trayN));
    }
    runStepGame(song, idx, mode, level, steps, ['You put', 'The song']);
  }

  /**
   * THE CHIPS CARRY THE WORD AND NOTHING ELSE.
   *
   * Two things used to be printed on them that were never part of the puzzle:
   *
   *   The capital letter. A chip reading "Silver" among a dozen lowercase ones
   *   is the first word of a line, and there are only so many blanks it can go
   *   in. That is not remembering the song, that is reading the typography -
   *   and on a four-line verse it was most of the answer.
   *
   *   The comma, the full stop, the quote mark. Those belong to the LINE, not
   *   to the word, so they stay on the board beside the blank where the song
   *   put them. They were also a second free clue: a chip ending in a full stop
   *   only ever fits the end of a sentence.
   *
   * The apostrophe stays on the chip, because there it really is part of the
   * word - "ol'" and "walkin'" are how the song says them, and stripping it
   * would hand back a chip that is not a word.
   *
   * The tray holds a fixed number of chips and REFILLS as you spend them, so
   * the number left on it never counts down the blanks for you.
   */
  function scrambleStep(sec, pct, extras, pool, cap) {
    var rows = [];                                   // per line: array of words
    var flat = [];                                   // every word, in reading order
    for (var l = 0; l < sec.lines.length; l++) {
      var ws = words(sec.lines[l]);
      var row = [];
      for (var w = 0; w < ws.length; w++) {
        var tok = { text: ws[w], bare: bareWord(ws[w]),
                    lead: leadPunct(ws[w]), trail: trailPunct(ws[w]),
                    hidden: false, slot: -1 };
        row.push(tok);
        if (normWord(ws[w])) flat.push(tok);
      }
      rows.push(row);
    }
    var take = shareOf(flat.length, pct);
    var picks = shuffled(flat).slice(0, take);
    var slots = [];
    for (var p = 0; p < picks.length; p++) picks[p].hidden = true;
    for (var f = 0; f < flat.length; f++) {
      if (!flat[f].hidden) continue;
      flat[f].slot = slots.length;
      slots.push({ expected: flat[f].bare, placed: null });
    }
    /* EVERY WORD THAT STILL HAS A HOME IS IN THE DECK, ALWAYS - and since 1.63
       the TRAY is a window onto that deck rather than the whole of it. See
       makeTray for the four rules that keep the window fair; the one that
       matters here is that the word the first unfilled blank wants is never
       allowed to be outside it, which is the guarantee 1.31a was reaching for
       when it stopped holding real words back at all.
       The deck is built exactly as it was: every missing word, plus two ringers
       per extraN. What changed is only how many of them you can see. */
    var deck = [];
    for (var q = 0; q < slots.length; q++) deck.push(slots[q].expected.toLowerCase());
    for (var x = 0; x < extras && slots.length; x++) {
      for (var t2 = 0; t2 < 2; t2++) {
        var seed = slots[Math.floor(Math.random() * slots.length)].expected;
        var fake = pickImpostor(seed, pool);
        if (!fake) continue;
        deck.push(bareWord(fake).toLowerCase());
      }
    }
    /** The blank a tapped chip would drop into, which is the only one the
        board owes an answer for. */
    function neededNow() {
      for (var k = 0; k < slots.length; k++) {
        if (slots[k].placed === null) return slots[k].expected;
      }
      return null;
    }
    var hand = makeTray(cap, deck, sameChip);
    hand.ensure(neededNow());

    var node = el('div', 'quiz-block');
    var body = el('div', 'scramble-lines');
    var tray = el('div', 'scramble-bank');
    node.appendChild(body);
    node.appendChild(tray);

    function draw() {
      body.innerHTML = '';
      for (var r = 0; r < rows.length; r++) {
        var lineEl = el('div', 'scramble-line');
        for (var c = 0; c < rows[r].length; c++) {
          (function (tok) {
            if (!tok.hidden) {
              lineEl.appendChild(el('span', 'sc-word', esc(tok.text)));
              return;
            }
            var sl = slots[tok.slot];
            if (tok.lead) lineEl.appendChild(el('span', 'sc-punct sc-lead', esc(tok.lead)));
            var b = el('button', 'sc-slot' + (sl.placed ? ' filled' : ''),
                       sl.placed ? esc(sl.placed) : '&nbsp;&nbsp;&nbsp;&nbsp;');
            b.type = 'button';
            b.addEventListener('click', function () {
              if (!sl.placed) return;
              hand.giveBack(sl.placed);
              sl.placed = null;
              hand.ensure(neededNow());
              draw();
            });
            lineEl.appendChild(b);
            if (tok.trail) lineEl.appendChild(el('span', 'sc-punct sc-trail', esc(tok.trail)));
          })(rows[r][c]);
        }
        body.appendChild(lineEl);
      }
      tray.innerHTML = '';
      /* DRAWN BY POSITION, INCLUDING THE EMPTY ONES. A position the deck can no
         longer fill is a gap rather than a chip that is not there: closing it up
         would shuffle every chip after it along one, which is the exact thing
         rule 1 exists to prevent. Empty positions at the END are trimmed, since
         nothing is after them to be moved. */
      var cells = hand.cells(), last = hand.lastFilled();
      for (var b2 = 0; b2 <= last; b2++) {
        (function (wrd, pos) {
          if (wrd === null) { tray.appendChild(el('span', 'word-chip word-gap')); return; }
          var chip = el('button', 'word-chip', esc(wrd));
          chip.type = 'button';
          chip.addEventListener('click', function () {
            for (var k = 0; k < slots.length; k++) {
              if (slots[k].placed === null) { slots[k].placed = wrd; break; }
            }
            hand.takeAt(pos);
            hand.ensure(neededNow());
            draw();
          });
          tray.appendChild(chip);
        })(cells[b2], b2);
      }
      if (last === -1) tray.appendChild(el('span', 'scramble-empty', 'all placed'));
    }
    draw();

    return {
      label: sec.label, node: node,
      grade: function () {
        var right = 0, out = [];
        for (var k = 0; k < slots.length; k++) {
          var ok = !!slots[k].placed && wordsMatch(slots[k].expected, slots[k].placed);
          if (ok) right++;
          out.push({
            ok: ok,
            got:  { label: sec.label, peek: slots[k].placed || '(left blank)' },
            want: { label: sec.label, peek: slots[k].expected }
          });
        }
        return { right: right, total: slots.length, rows: out };
      }
    };
  }

  /* ============================================================
     A CAPPED TRAY: a fixed window onto a deck - 1.63
     ============================================================

     WHY. Both Scramble games used to put the WHOLE deck on the tray. On a long
     verse on Hard that is thirty-odd chips, and somewhere around twenty the
     game stops being about the song and starts being about scanning a wall of
     words. The deck is not the problem - every missing word does have to be
     available - so what is capped is how much of it you can see at once.

     FOUR RULES, and every one of them is there to stop a specific kind of
     unfairness that a window can introduce:

     1. THE CHIP YOU TAP DOES NOT MOVE THE OTHERS. A tap takes the word out of
        its own position and the deck refills THAT position. Nothing else on the
        tray shifts. A tray that reflows under your finger means the second half
        of a board is spent re-reading chips you had already dismissed, and it
        makes a mis-tap the tray's fault rather than yours.

     2. THE WORD THE NEXT GAP WANTS IS ALWAYS THERE. A chip drops into the first
        unfilled gap in reading order, so that gap is the only one the board owes
        you an answer for. Before every draw it checks, and swaps the answer in
        if it is sitting in the unseen part of the deck. A window that can hide
        the one word you need is not a harder game, it is a stuck one.

     3. A SWAP MOVES SEVERAL CHIPS, NOT ONE. Replacing exactly the chip that was
        needed would point at it: one thing changed, and the changed thing is
        the answer. So a quarter of the tray turns over at once, the answer
        lands in a random one of those positions, and the rest come off the deck.
        (An honest caveat: a swap still tells you the answer was NOT there a
        moment ago, and that it is among the few that changed. Tracking which
        three of twelve similar words turned over, every turn, is harder work
        than knowing the verse - which is the bet this makes.)

     4. WHAT YOU TAKE BACK OUT COMES BACK INTO VIEW. Lifting a word out of a gap
        puts it on the tray, in a free position if there is one and otherwise in
        place of something the deck takes back. A word that vanished when you
        un-placed it would look like the game had eaten it.

     THE ONE CASE IT CANNOT FIX, and does not pretend to: put a word in the
     wrong gap when the song only sings it once, and the answer the current gap
     wants is now sitting in a filled gap rather than in the deck. There is
     nothing to swap in. The board is not stuck - tap that gap and the word
     comes back - but no amount of reshuffling will produce a copy that does not
     exist, so ensure() returns quietly rather than inventing one.

     Shared by both games because they are the same board asked of two units,
     and two copies of four rules is two places to get rule 3 wrong. */
  function makeTray(size, deck, same) {
    var reserve = shuffled((deck || []).slice());
    var cells = [];
    var want = Math.max(1, Math.min(size > 0 ? size : 12, reserve.length));
    for (var i = 0; i < want; i++) cells.push(reserve.shift());

    /** A quarter of the tray, never fewer than two - see rule 3. */
    function swapCount() { return Math.max(2, Math.round(cells.length / 4)); }
    function onTray(text) {
      for (var c = 0; c < cells.length; c++) {
        if (cells[c] !== null && same(cells[c], text)) return true;
      }
      return false;
    }

    return {
      /** The live positions. null is a position the deck can no longer fill. */
      cells: function () { return cells; },
      /** The last position holding anything, or -1. Everything past it is dead
          weight at the END of the tray, so trimming it moves nothing. */
      lastFilled: function () {
        var at = -1;
        for (var c = 0; c < cells.length; c++) if (cells[c] !== null) at = c;
        return at;
      },
      /** Rule 1: take this position, refill this position, touch nothing else. */
      takeAt: function (i) {
        var got = cells[i];
        cells[i] = reserve.length ? reserve.shift() : null;
        return got;
      },
      /** Rule 4. */
      giveBack: function (text) {
        for (var i = 0; i < cells.length; i++) {
          if (cells[i] === null) { cells[i] = text; return; }
        }
        var at = Math.floor(Math.random() * cells.length);
        reserve.push(cells[at]);
        reserve = shuffled(reserve);
        cells[at] = text;
      },
      /** Rules 2 and 3. Returns whether anything moved. */
      ensure: function (text) {
        if (text === null || text === undefined) return false;
        if (onTray(text)) return false;
        var at = -1, r;
        for (r = 0; r < reserve.length; r++) {
          if (same(reserve[r], text)) { at = r; break; }
        }
        if (at === -1) return false;        // the only copy is placed elsewhere
        var needed = reserve.splice(at, 1)[0];

        var order = [];
        for (var z = 0; z < cells.length; z++) order.push(z);
        var spots = shuffled(order).slice(0, Math.min(swapCount(), cells.length));

        /* Everything the chosen positions were holding goes back into the pot
           WITH the reserve, so the camouflage can be drawn from either and a
           displaced chip can land somewhere else on the tray rather than just
           disappearing. */
        var pot = [];
        for (var p = 0; p < spots.length; p++) {
          if (cells[spots[p]] !== null) pot.push(cells[spots[p]]);
        }
        pot = shuffled(pot.concat(reserve));
        var picks = [needed];
        while (picks.length < spots.length && pot.length) picks.push(pot.shift());
        reserve = shuffled(pot);
        picks = shuffled(picks);
        for (var q = 0; q < spots.length; q++) {
          cells[spots[q]] = q < picks.length ? picks[q] : null;
        }
        return true;
      }
    };
  }

  /** Both games compare through the grader's own reading of a word or a line. */
  function sameChip(a, b) { return normWord(a) === normWord(b); }

  /* ---------- Scramble Lines ---------- */
  /**
   * SCRAMBLE LINES: the whole song, with lines lifted out of it.
   *
   * It used to walk a section at a time, four lines on screen with one gap in
   * them and a short list underneath. That made it a much smaller question than
   * it looks: with the verse in front of you and one hole in it, the answer is
   * usually the only option that scans. And it was section by section, so the
   * thing the game is actually for - where a line sits in the whole song - was
   * never asked.
   *
   * Now the entire song is on the board and every gap in it is open at once, so
   * a line has to be placed against the whole thing rather than against the four
   * lines around it. The bank sits at the foot of the screen and stays there
   * while the song scrolls past it.
   *
   * TAP A LINE, THEN TAP A GAP - or a gap and then a line, whichever order you
   * reach for. The old board dropped every chip into the leftmost empty gap,
   * which meant that on a board with more than one gap you could not aim at
   * all: the game decided where your line went and then marked you wrong for
   * its own choice. Tapping a filled gap lifts the line back out.
   *
   * HOW MANY GO MISSING IS A COIN TOSS, NOT A ROUNDING. A fifth of a four-line
   * verse is 0.8 of a line, and rounding that up takes exactly one out of every
   * verse on Easy - a rule you learn once and stop reading the board for.
   * Carrying the fraction as a chance means Easy leaves some verses whole, so
   * you have to look at each one to find out, while over a long song the share
   * still lands where the dial put it.
   */
  function startLineScramble(song, idx, mode, level, decoys) {
    var d = gameDials(mode, level);
    var pool = wordPool(song, decoys);
    var secs = realSections(song);
    if (!secs.length) { toast('Nothing to play here'); back(); return; }

    var i, j, k;

    /* Which lines come out, over the whole song. Addressed by section and line
       so the board can be rebuilt from the song rather than from a flat list. */
    var gaps = {}, slots = [], totalLines = 0;
    for (i = 0; i < secs.length; i++) {
      var lines = secs[i].lines;
      totalLines += lines.length;
      var n = Math.floor(lines.length * d.missPct / 100 + Math.random());
      if (n > lines.length) n = lines.length;
      if (n < 0) n = 0;
      var order = [];
      for (j = 0; j < lines.length; j++) order.push(j);
      var take = shuffled(order).slice(0, n);
      for (j = 0; j < take.length; j++) gaps[i + ':' + take[j]] = true;
    }
    // a run with nothing at all to do is not a run
    var any = false;
    for (var g0 in gaps) if (gaps.hasOwnProperty(g0)) any = true;
    if (!any) {
      var fs = Math.floor(Math.random() * secs.length);
      gaps[fs + ':' + Math.floor(Math.random() * secs[fs].lines.length)] = true;
    }
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].lines.length; j++) {
        if (gaps[i + ':' + j]) {
          slots.push({ sec: i, line: j, expected: secs[i].lines[j], placed: null });
        }
      }
    }

    /* THE BANK HOLDS EVERY MISSING LINE, ALWAYS, plus the ringers. Nothing is
       held back in a reserve: 1.31a kept part of the tray hidden so that what
       was left on it never counted the gaps down, and that same reserve could
       be holding the line a gap wanted. The gaps are all on the board to be
       counted anyway, so there was never anything to protect.

       ONE CHIP PER GAP, DUPLICATES AND ALL. A song that sings the same line in
       two places can have both of them lifted out, and then the bank needs two
       copies of it - dedupe the real lines and the board is unwinnable, with
       one chip for two gaps and no way to see why. The de-duplication belongs
       on the RINGERS only, where it stops the same stranger appearing twice,
       and it also keeps a ringer from arriving as a line that is already a
       legitimate answer somewhere on the board. */
    var deck = [], seen = {};
    for (i = 0; i < slots.length; i++) {
      deck.push(slots[i].expected);
      seen[normWord(slots[i].expected)] = true;
    }
    var realCount = deck.length;
    function plant(text) {
      if (!text) return;
      var key = normWord(text);
      if (seen[key]) return;
      seen[key] = true;
      deck.push(text);
    }

    /* Borrowed lines are the easy reject - somebody else wrote them. The
       TAMPERED ones are copies of the lines that are actually missing, with a
       word swapped, which is the only kind of ringer this board can still make
       hard: the whole song is visible, so anything of yours from elsewhere is
       sitting there in its proper place. */
    var far = shuffled(decoys.lines || []);
    var want = pickCount(d.borrowN);
    for (i = 0; i < far.length && deck.length - realCount < want; i++) plant(far[i].t);
    var ne = pickCount(d.editN), mine = shuffled(slots.slice());
    for (i = 0; i < ne && mine.length; i++) {
      var faked = tamper([mine[i % mine.length].expected], d.editPct, pool);
      if (faked) plant(faked[0]);
    }
    /* THE TRAY IS A WINDOW ONTO THIS, NOT THE WHOLE OF IT - 1.63. See makeTray.
       The gap it guarantees an answer for is the first unfilled one in reading
       order, exactly as in Scramble Words - even though this board lets you aim
       anywhere. Anchoring the guarantee to the SELECTED gap instead would have
       been the more responsive rule and a much worse one: a reshuffle you can
       trigger by tapping a gap is a reshuffle you can tap every gap in turn to
       trigger, and the chips that change each time are the answers. A fixed
       anchor cannot be probed, and the board stays winnable either way, since
       the gaps can always be filled in order. */
    var hand = makeTray(d.trayN, deck, sameChip);
    function neededNow() {
      for (var q0 = 0; q0 < slots.length; q0++) {
        if (slots[q0].placed === null) return slots[q0].expected;
      }
      return null;
    }
    hand.ensure(neededNow());

    var heldChip = -1, heldGap = -1;

    var node = el('div', 'quiz-block');
    var body = el('div', 'ls-song');
    var tray = el('div', 'ls-bank');
    node.appendChild(body);
    node.appendChild(tray);

    function slotAt(s, l) {
      for (var q = 0; q < slots.length; q++) {
        if (slots[q].sec === s && slots[q].line === l) return q;
      }
      return -1;
    }
    function place(gapAt, chipAt) {
      slots[gapAt].placed = hand.cells()[chipAt];
      hand.takeAt(chipAt);                 // that position, and only that one
      hand.ensure(neededNow());
      heldChip = -1; heldGap = -1;
      draw();
    }

    function draw() {
      body.innerHTML = '';
      for (var s = 0; s < secs.length; s++) {
        (function (sec, si) {
          body.appendChild(el('div', 'ls-label', esc(sec.label)));
          for (var n = 0; n < sec.lines.length; n++) {
            (function (at) {
              var q = slotAt(si, at);
              if (q === -1) {
                body.appendChild(el('div', 'ls-line', esc(sec.lines[at])));
                return;
              }
              var sl = slots[q];
              var b = el('button', 'ls-slot' + (sl.placed ? ' filled' : '') +
                                   (heldGap === q ? ' picked' : ''),
                         sl.placed ? esc(sl.placed) : '&nbsp;');
              b.type = 'button';
              b.addEventListener('click', function () {
                if (sl.placed) {                 // lift it back out
                  hand.giveBack(sl.placed);
                  sl.placed = null;
                  hand.ensure(neededNow());
                  heldChip = -1; heldGap = -1;
                  draw();
                  return;
                }
                if (heldChip !== -1) { place(q, heldChip); return; }
                heldGap = (heldGap === q) ? -1 : q;
                draw();
              });
              body.appendChild(b);
            })(n);
          }
        })(secs[s], s);
      }

      tray.innerHTML = '';
      var left = 0;
      for (var z = 0; z < slots.length; z++) if (slots[z].placed === null) left++;
      tray.appendChild(el('p', 'ls-bank-head', left
        ? left + ' still to place'
        : 'All placed - check it when you are happy'));
      var cells = hand.cells(), lastAt = hand.lastFilled();
      for (var c = 0; c <= lastAt; c++) {
        (function (line, pos) {
          if (line === null) { tray.appendChild(el('span', 'line-chip line-gap')); return; }
          var chip = el('button', 'line-chip' + (heldChip === pos ? ' picked' : ''),
                        esc(line));
          chip.type = 'button';
          chip.addEventListener('click', function () {
            if (heldGap !== -1) { place(heldGap, pos); return; }
            heldChip = (heldChip === pos) ? -1 : pos;
            draw();
          });
          tray.appendChild(chip);
        })(cells[c], c);
      }
      if (lastAt === -1) {
        tray.appendChild(el('span', 'scramble-empty', 'nothing left in the bank'));
      }
    }
    draw();

    var step = {
      label: 'The whole song', node: node,
      grade: function () {
        var right = 0, out = [];
        for (var q = 0; q < slots.length; q++) {
          var sl = slots[q];
          /* Graded on WHAT THE LINE SAYS, not on which chip it was, so a song
             that sings the same line in two places lets either copy stand in
             either gap. */
          var ok = !!sl.placed && normWord(sl.placed) === normWord(sl.expected);
          if (ok) right++;
          out.push({ ok: ok,
            got:  { label: secs[sl.sec].label, peek: sl.placed || 'left empty' },
            want: { label: secs[sl.sec].label, peek: sl.expected } });
        }
        return { right: right, total: slots.length, rows: out };
      }
    };

    runStepGame(song, idx, mode, level, [step], ['You put', 'The song'],
      slots.length + ' line' + (slots.length === 1 ? '' : 's') + ' have been lifted ' +
      'out of the song, and the bank at the foot holds a few that were never in ' +
      'it. Tap a line then tap its gap, or a gap then its line.');
  }

  /* ---------- Word Impostor / Line Impostor ---------- */
  /**
   * BOTH IMPOSTOR GAMES ARE NOW ONE RING PER CELL, OVER THE WHOLE SONG.
   *
   * What they used to be: a section at a time, and every unit a yes/no. You
   * struck through what looked wrong and left the rest, and Line Impostor
   * padded the section out with extra rows so a four-line verse might show six.
   *
   * What they are now, and why:
   *
   *   THE WHOLE SONG, ALL AT ONCE. A verse read on its own is a different and
   *   much easier problem - a wrong word is odd against three lines of
   *   context, and you knew before you started that this screen had something
   *   in it. Reading the song end to end is the thing you actually have to be
   *   able to do, and it is the only view where a line can be wrong because of
   *   what came four lines earlier.
   *
   *   NO EXTRA ROWS. If the song is fourteen lines the board is fourteen lines.
   *   Counting the rows used to tell you how many fakes had been added before
   *   you read one of them.
   *
   *   TAPPING SWAPS, IT DOES NOT STRIKE OUT. Every cell holds a small ring of
   *   candidates with the true one somewhere in it, and a tap moves to the
   *   next - which may be the right one, and may be another impostor. So a
   *   suspicion is not a verdict: you tap through until what is on the page is
   *   what the song says, and then you leave it. Tapping something that was
   *   already right takes it AWAY from right, which is what stops the whole
   *   board from being cleared by tapping everything twice.
   *
   * Grading is what is on the page when you submit, cell by cell. Doing
   * nothing therefore scores exactly the share that was not faked - 70% at
   * Easy, 50% at Hard - which is why fakePct climbs with the level rather than
   * falling, the same as it always has for words.
   */

  /**
   * The true one plus its impostors, IN A SHUFFLED ORDER - 1.53.
   *
   * It used to build [truth, fake, fake, ...] and leave it that way, and since
   * a tap steps forward through the ring and wraps, that put the truth at the
   * far end of every walk: start on a fake at index 1 and the answer is the
   * last thing you reach, every single time. On Medium and Hard, where the
   * ring is three and four deep, the game stopped being "which one is right"
   * and became "tap this until it stops changing" - the correct line was
   * whatever came up just before the board repeated itself.
   *
   * Shuffling the ring is the whole fix. The truth now sits anywhere in it, so
   * the next tap may be the answer or may be another impostor, which is what
   * the ring was for. Callers must not assume index 0 is the truth any more -
   * they ask for it by value.
   */
  function makeRing(truth, fakes) {
    var ring = [truth], i;
    for (i = 0; i < fakes.length; i++) {
      if (fakes[i] && ring.indexOf(fakes[i]) === -1) ring.push(fakes[i]);
    }
    for (i = ring.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = ring[i]; ring[i] = ring[j]; ring[j] = t;
    }
    return ring;
  }
  /** Where in the ring the true one ended up, which is no longer index 0. */
  function truthAt(ring, truth) {
    var i = ring.indexOf(truth);
    return i === -1 ? 0 : i;
  }
  /**
   * Where in the ring to start: the truth, or a UNIFORMLY chosen one of the
   * fakes. Picking an index and skipping the truth would bias the slot next to
   * it, so the pick is made over the fakes themselves.
   */
  function ringStart(ring, planted, truth) {
    var home = truthAt(ring, truth);
    if (!planted || ring.length < 2) return home;
    var wrong = [];
    for (var i = 0; i < ring.length; i++) if (i !== home) wrong.push(i);
    return wrong[Math.floor(Math.random() * wrong.length)];
  }
  /**
   * How many wrong ones hide behind each unit. Always at least one, or a
   * tappable cell would have nowhere to go and say so by not moving.
   *
   * THE CEILING IS NOT A COST, IT IS A SUPPLY PROBLEM. Building a ring is
   * cheap - a scan of the word pool per fake, so a 200-word song at eight
   * fakes is a few hundred thousand comparisons, which is milliseconds. What
   * runs out is CANDIDATES: a fake has to match its word for class and come
   * within three letters of its length, and makeRing drops duplicates, so a
   * long or unusual word may only have two or three distinct partners in the
   * whole song. Ask for eight and you will often get four, more so on short
   * songs - which is the right way for it to fail, with fewer options rather
   * than worse ones.
   */
  function fakesPerOf(d) {
    var n = (d && d.fakesPer !== undefined) ? Math.round(d.fakesPer) : 2;
    if (!(n >= 1)) n = 1;
    if (n > 8) n = 8;
    return n;
  }
  function cellShows(c) { return c.ring[c.at]; }
  function cellRight(c) { return normWord(cellShows(c)) === normWord(c.truth); }
  function cellTap(c) { c.at = (c.at + 1) % c.ring.length; }
  /**
   * THE RING RUNS BOTH WAYS AS OF 1.62.
   *
   * A ring of four means a word you have gone one past costs you three more
   * taps to come back to, and on the hard levels - where the ring is at its
   * longest and every seat in it is plausible - going one too far is the
   * commonest thing that happens. Tapping round again is not difficulty, it is
   * just the long way round to somewhere you have already been.
   *
   * So the secondary click steps back. On a PC that is the right mouse button,
   * which is free: there is nothing in this app a context menu over a game
   * board has ever been wanted for, and suppressing it there costs nothing.
   * A phone has no second button and keeps the forward tap alone - the ring is
   * short on Easy, which is what a phone mostly plays, and a long-press already
   * means something to the browser.
   */
  function cellTapBack(c) { c.at = (c.at + c.ring.length - 1) % c.ring.length; }
  /** Wire both directions onto one chip. redraw takes no arguments. */
  function bindRingTaps(btn, c, redraw) {
    btn.addEventListener('click', function () { cellTap(c); redraw(); });
    btn.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (c.ring.length < 3) return;      // nothing a second direction can reach
      cellTapBack(c);
      redraw();
    });
  }

  /* Said only where it can be done. A right-click hint on a phone is an
     instruction for a button that is not there. */
  function ringBackHint() {
    return deviceNow() === 'phone' ? ''
      : '  Right-click to go back one.';
  }

  function startImpostor(song, idx, mode, level, decoys, unit) {
    var d = gameDials(mode, level);
    var secs = realSections(song);
    if (!secs.length) { toast('Nothing to play here'); back(); return; }
    var pool = wordPool(song, decoys);
    /* Words walk the song a section at a time and so come back as a LIST;
       lines still put the whole song on one board, because the question there
       is which line does not belong, and a line only reads as wrong against
       the lines around it. */
    var step = unit === 'word'
      ? wordImpostorBoard(secs, d, pool)
      : lineImpostorBoard(secs, d, decoys, pool);
    if (!step || (step.length === 0)) {
      toast('Not enough material for that here'); back(); return;
    }
    var steps = (unit === 'word') ? step : [step];
    runStepGame(song, idx, mode, level, steps, ['You left', 'The song'],
      unit === 'word'
        ? 'Every word can be tapped, and tapping swaps it for another. Leave the page reading the way the song does.' + ringBackHint()
        : 'Every line can be tapped, and tapping swaps it for another. Leave the page reading the way the song does.' + ringBackHint());
  }

  /** The song laid out with a heading over each section. */
  function boardShell(cls) {
    var node = el('div', 'quiz-block');
    var body = el('div', cls);
    node.appendChild(body);
    return { node: node, body: body };
  }

  /* ---------- Word Impostor ---------- */
  /**
   * IMPOSTOR WORDS, ONE SECTION AT A TIME - 1.52.
   *
   * It used to put the whole song on one page. On a six-verse song that is
   * three screens of tappable words, and the game it produced was scrolling
   * rather than reading: you cannot hold a whole lyric in your eye at once, so
   * the swapped words in the verses you were not looking at were found by
   * sweeping rather than by knowing. A verse at a time is the unit a song is
   * learned in, and it is the unit the other seven games already walk.
   *
   * The share is planted PER SECTION rather than once across the song. Planting
   * globally and then splitting the page would leave some verses untouched and
   * others carrying most of the fakes - and a verse with nothing wrong in it is
   * a verse you can only get wrong, since the only move available is to break
   * something that was already right.
   *
   * Returns a LIST of steps for runStepGame, or null if the song cannot carry
   * the game at all. A section too short to plant anything in is dropped rather
   * than shown clean, for the reason above.
   */
  function wordImpostorBoard(secs, d, pool) {
    var pct = d.fakePct, nFakes = fakesPerOf(d);
    var steps = [];

    for (var si = 0; si < secs.length; si++) {
      (function (sec) {
        var cells = [], real = [], l, w;
        for (l = 0; l < sec.lines.length; l++) {
          var ws = words(sec.lines[l]);
          for (w = 0; w < ws.length; w++) {
            var cell = { truth: ws[w], ring: [ws[w]], at: 0, start: 0,
                         tappable: !!normWord(ws[w]), line: l, atStart: w === 0 };
            cells.push(cell);
            if (cell.tappable) real.push(cell);
          }
        }
        if (real.length < 3) return;

        /* THE SAME RING EVERYWHERE, right words and planted ones alike - a word
           whose tap has nowhere to go has told you it is already correct. How
           many hide behind it is the level's own dial: one behind it means a
           tap on something you know is wrong lands on the answer, three means
           the tap is a guess of its own. */
        for (w = 0; w < real.length; w++) {
          var c1 = real[w], mades = [];
          for (var mf = 0; mf < nFakes; mf++) mades.push(fakeWord(c1.truth, pool, c1.atStart));
          c1.ring = makeRing(c1.truth, mades);
          // an untouched word shows the truth, wherever the shuffle put it
          c1.at = c1.start = truthAt(c1.ring, c1.truth);
        }
        var planted = shuffled(real).slice(0, Math.max(1, shareOf(real.length, pct)));
        var swapped = 0;
        for (w = 0; w < planted.length; w++) {
          if (planted[w].ring.length < 2) continue;
          planted[w].at = ringStart(planted[w].ring, true, planted[w].truth);
          planted[w].start = planted[w].at;
          swapped++;
        }
        if (!swapped) return;

        var shell = boardShell('imp-words');
        function draw() {
          shell.body.innerHTML = '';
          var lastLine = -1, lineEl = null;
          for (var i = 0; i < cells.length; i++) {
            (function (c) {
              if (c.line !== lastLine) {
                lastLine = c.line;
                lineEl = el('div', 'imp-line');
                shell.body.appendChild(lineEl);
              }
              if (!c.tappable) {
                lineEl.appendChild(el('span', 'sc-word', esc(cellShows(c))));
                return;
              }
              var b = el('button', 'imp-chip' + (c.at !== c.start ? ' touched' : ''),
                         esc(cellShows(c)));
              b.type = 'button';
              bindRingTaps(b, c, draw);
              lineEl.appendChild(b);
            })(cells[i]);
          }
        }
        draw();

        steps.push({
          label: sec.label, node: shell.node,
          grade: function () {
            var right = 0, wrongAt = {}, i;
            for (i = 0; i < real.length; i++) {
              if (cellRight(real[i])) { right++; continue; }
              wrongAt[i] = true;
            }
            var rows = [];
            /* THE LINE THE MISTAKE IS IN, WITH THE MISTAKE MARKED IN IT.
               Reporting a wrong word on its own - "you left: bright / the song:
               night" - is the answer with the question thrown away. A word in a
               lyric is only wrong in the company of the words either side of
               it, and that is also the only form in which reading it back
               teaches you anything.

               1.52 printed the WHOLE VERSE for that context, which was too much
               of a good thing: the results card clips a long block, and a
               mistake in the fourth line of a six-line verse was reliably
               clipped away - the card showed two clean lines and an ellipsis
               and never mentioned what you actually got wrong. The line either
               side of a word is the context that was being argued for; the
               verse was only ever the cheapest way to include it. So one row
               per wrong LINE, and the mistake is always on screen - 1.53. */
            var badLines = wrongLines(real, wrongAt);
            for (var bl = 0; bl < badLines.length; bl++) {
              (function (ln) {
                rows.push({ ok: false,
                  got:  { label: sec.label, peek: verseText(cells, false, ln),
                          html: verseHtml(cells, real, wrongAt, false, ln) },
                  want: { label: sec.label, peek: verseText(cells, true, ln),
                          html: verseHtml(cells, real, wrongAt, true, ln) } });
              })(badLines[bl]);
            }
            return { right: right, total: real.length, rows: rows };
          }
        });
      })(secs[si]);
    }
    return steps.length ? steps : null;
  }

  /**
   * Which lines of the section hold a wrong word, in the order they are read.
   * wrongAt is keyed by position among the TAPPABLE cells, which is what
   * grading counts, so the walk has to be over real and not over cells.
   */
  function wrongLines(real, wrongAt) {
    var seen = {}, out = [];
    for (var i = 0; i < real.length; i++) {
      if (!wrongAt[i]) continue;
      var ln = real[i].line;
      if (seen[ln]) continue;
      seen[ln] = true;
      out.push(ln);
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /**
   * The section as plain text - the fallback if anything cannot render HTML.
   * Pass only to get a single line of it instead of the whole thing.
   */
  function verseText(cells, truth, only) {
    var out = [], lastLine = -1, line = [];
    for (var i = 0; i < cells.length; i++) {
      if (only !== undefined && only !== null && cells[i].line !== only) continue;
      if (cells[i].line !== lastLine) {
        if (line.length) out.push(line.join(' '));
        line = [];
        lastLine = cells[i].line;
      }
      line.push(truth ? cells[i].truth : cellShows(cells[i]));
    }
    if (line.length) out.push(line.join(' '));
    return out.join(NL);
  }

  /**
   * The section with the words you got wrong picked out.
   *
   * Everything that goes in here is escaped on the way past - the only markup
   * is the span this function writes. It is handed to the results screen as
   * 'html' beside the plain 'peek', and the screen prefers it where it exists.
   */
  function verseHtml(cells, real, wrongAt, truth, only) {
    var one = only !== undefined && only !== null;
    var pos = 0, out = '', lastLine = -1, open = false;
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var isReal = c.tappable;
      /* THE COUNTER STILL WALKS EVERY CELL even when only one line is being
         drawn. wrongAt is keyed by position among the tappable cells of the
         whole section, so skipping cells before incrementing would slide every
         mark up the line by however many words came before it. */
      if (one && c.line !== only) { if (isReal) pos++; continue; }
      if (c.line !== lastLine) {
        if (open) out += '</div>';
        out += '<div class="verse-diff-line">';
        open = true;
        lastLine = c.line;
      } else out += ' ';
      var bad = isReal && wrongAt[pos];
      var text = truth ? c.truth : cellShows(c);
      out += bad ? '<span class="verse-diff-bad">' + esc(text) + '</span>' : esc(text);
      if (isReal) pos++;
    }
    if (open) out += '</div>';
    return out;
  }

  function lineImpostorBoard(secs, d, decoys, pool) {
    var nFakes = fakesPerOf(d);
    var cells = [], s, l, i;
    for (s = 0; s < secs.length; s++) {
      for (l = 0; l < secs[s].lines.length; l++) {
        cells.push({ truth: secs[s].lines[l], ring: [secs[s].lines[l]], at: 0,
                     start: 0, tappable: true, sec: s, line: l });
      }
    }
    if (cells.length < 3) return null;

    var far = shuffled(decoys.lines || []), farAt = 0;
    var mine = [];
    for (i = 0; i < cells.length; i++) mine.push(cells[i].truth);

    /** One fake of a named kind, or null if that hat is empty. */
    function borrowedFake() {
      if (farAt >= far.length) return null;
      return far[farAt++].t;
    }
    /* No decoy twice on one board. The same line showing up in three wrong
       places is not three decoys, it is one decoy you have already spotted -
       and it reads as a bug in the song rather than as a plant. */
    var decoyUsed = {};
    function decoyFake(c) {
      var pool2 = shuffled(mine), i2;
      for (i2 = 0; i2 < pool2.length; i2++) {
        var k2 = normWord(pool2[i2]);
        if (k2 === normWord(c.truth) || decoyUsed[k2]) continue;
        decoyUsed[k2] = true;
        return pool2[i2];
      }
      for (i2 = 0; i2 < pool2.length; i2++) {          // board exhausted; reuse
        if (normWord(pool2[i2]) !== normWord(c.truth)) return pool2[i2];
      }
      return null;
    }
    function tamperedFake(c) {
      var f = tamper([c.truth], d.editPct, pool);
      return f ? f[0] : null;
    }
    /** Any of the three, for the spare seat in a ring. */
    function anyFake(c) {
      var roll = Math.random();
      var f = roll < 0.34 ? tamperedFake(c) : (roll < 0.67 ? decoyFake(c) : borrowedFake());
      return f || tamperedFake(c) || decoyFake(c);
    }

    /* WHICH LINES START WRONG, and what kind of wrong. fakePct sets how many -
       a share, not a count, because the board is the whole song and a count of
       three would be 8% of a long one and 60% of a short one. editN is what is
       left of the old count: how many of those are this song tampered with.
       The rest split borrowed/decoy on the decoy dial. */
    var planted = shuffled(cells).slice(0, shareOf(cells.length, d.fakePct));
    var nTamper = Math.min(pickCount(d.editN), planted.length);
    var plant = plantSplit(planted.length - nTamper, d.decoyPct);
    var kinds = [];
    for (i = 0; i < nTamper; i++) kinds.push('tampered');
    for (i = 0; i < plant.borrow; i++) kinds.push('borrowed');
    for (i = 0; i < plant.decoy; i++) kinds.push('decoy');
    kinds = shuffled(kinds);

    var swapped = 0;
    for (i = 0; i < planted.length; i++) {
      var c = planted[i], kind = kinds[i] || 'tampered';
      var f = kind === 'borrowed' ? borrowedFake()
            : kind === 'decoy'    ? decoyFake(c)
                                  : tamperedFake(c);
      if (!f) f = anyFake(c);
      if (!f) continue;
      // the kind this line was picked for, then the rest of its ring
      var ring = [f];
      for (var rf = 1; rf < nFakes; rf++) ring.push(anyFake(c));
      c.ring = makeRing(c.truth, ring);
      c.at = c.ring.indexOf(f);
      c.start = c.at;
      c.planted = true;
      swapped++;
    }
    if (!swapped) return null;

    // the untouched lines still need somewhere to go when tapped
    for (i = 0; i < cells.length; i++) {
      if (cells[i].planted) continue;
      var spare = [];
      for (var sf = 0; sf < nFakes; sf++) spare.push(anyFake(cells[i]));
      cells[i].ring = makeRing(cells[i].truth, spare);
      cells[i].at = cells[i].start = truthAt(cells[i].ring, cells[i].truth);
    }

    var shell = boardShell('imp-lines');
    function draw() {
      shell.body.innerHTML = '';
      var lastSec = -1;
      for (var k = 0; k < cells.length; k++) {
        (function (c) {
          if (c.sec !== lastSec) {
            lastSec = c.sec;
            shell.body.appendChild(el('div', 'ls-label', esc(secs[c.sec].label)));
          }
          var b = el('button', 'imp-row' + (c.at !== c.start ? ' touched' : ''),
                     esc(cellShows(c)));
          b.type = 'button';
          bindRingTaps(b, c, draw);
          shell.body.appendChild(b);
        })(cells[k]);
      }
    }
    draw();

    return {
      label: 'The whole song', node: shell.node,
      grade: function () {
        var right = 0, out = [];
        for (var k = 0; k < cells.length; k++) {
          var c2 = cells[k];
          if (cellRight(c2)) { right++; continue; }
          out.push({ ok: false,
            got:  { label: secs[c2.sec].label, peek: cellShows(c2) },
            want: { label: secs[c2.sec].label, peek: c2.truth } });
        }
        return { right: right, total: cells.length, rows: out };
      }
    };
  }

  function renderQuiz(song, idx, mode, level, timed) {
    var cfg = modeById(mode) || {};
    if (cfg.kind !== 'game') {
      clockStart();
      renderTypingQuiz(song, idx, mode, timed);
      return;
    }

    appEl.innerHTML = '<div class="loading">Setting the board...</div>';
    loadDecoys(song.id).then(function (raw) {
      var decoys = usableDecoys(song, raw);
      appEl.innerHTML = '';
      if (mode === 'verseSort')         startSortGame(song, idx, mode, level, decoys, 'verse');
      else if (mode === 'lineSort')     startSortGame(song, idx, mode, level, decoys, 'line');
      else if (mode === 'verseOrder')   startOrderGame(song, idx, mode, level, decoys, 'verse');
      else if (mode === 'lineOrder')    startOrderGame(song, idx, mode, level, decoys, 'line');
      else if (mode === 'wordScramble') startScramble(song, idx, mode, level, decoys);
      else if (mode === 'lineScramble') startLineScramble(song, idx, mode, level, decoys);
      else if (mode === 'wordImpostor') startImpostor(song, idx, mode, level, decoys, 'word');
      else if (mode === 'lineImpostor') startImpostor(song, idx, mode, level, decoys, 'line');
      else renderTypingQuiz(song, idx, mode, timed);
    });
  }

  /**
   * level is the game rung, '' for a quiz. timed says the stopwatch box was
   * ticked, which is the only thing that lets pace move the award - the clock
   * itself always runs on a quiz and is always reported.
   */
  function finishQuiz(song, idx, mode, accuracy, results, totalWords, correctWords,
                      level, timed, obs) {
    var isG = isGame(mode);
    var secs = isG ? 0 : clockStop();
    var dev = timingDevice();          // never the third answer - see timingDevice
    var practice = !!S.practiceRun;
    S.creditRun = null;              // finished honestly; nothing left to forfeit

    /* A practice run is not recorded at all - no row, no points, no effect on
       the accuracy averages or on the count that unlocks the time challenge.
       Anything less than that and "practice" quietly becomes a way to pad your
       own statistics. */
    if (!practice) {
      var attempt = {
        songId: song.id, date: Date.now(), accuracy: accuracy,
        totalWords: totalWords, correctWords: correctWords,
        mode: mode, seconds: secs, device: dev,
        level: isG ? (level || 'easy') : '',
        timed: !isG && !!timed,
        variant: S.quizVariant || '',
        detail: { sections: results.length, mode: mode, level: isG ? (level || 'easy') : '' },
        /* THE COUNTDOWN, BOTH ENDS. Captured here because every finish path
           tears the clock down before it grades, so by the time the row is
           built the countdown is already gone. Null on a quiz and on a
           practice run, which never build one at all. */
        secsLeft: isG ? gclock.lastLeft : null,
        secsLimit: isG ? gclock.lastLimit : null,
        // the run's observations ride along with the row, in one round trip
        heat: obs || []
      };
      dropSong(song.id);
      S.outcome = null;
      bankAttempt(attempt);
    } else {
      S.outcome = null;
      /* PRACTICE REACHES THE HEATMAP AND NOTHING ELSE. No row, no points, no
         unlock, no averages, no spending the day - but practice is most of the
         repetitions you ever do, and a picture of your memory that ignored most
         of your repetitions would be a poor picture. There is nothing to farm
         here: the map is not a reward and carries no score. */
      if (obs && obs.length) {
        api('updateHeat', { songId: song.id, mode: mode, obs: obs })
          .then(function () { dropSong(song.id); }, function () {});
      }
    }
    // a game is not timed, but it is against a clock, and how close you came
    // to running out is the only pace figure it has
    S.gameLeft = isG ? gclock.lastLeft : null;
    go('results', {
      songId: song.id, accuracy: accuracy, results: results, mode: mode,
      seconds: secs, device: dev, level: isG ? (level || 'easy') : '',
      timed: !isG && !!timed, practice: practice, variant: S.quizVariant || ''
    }, true);
  }

  /**
   * THINGS WAITING ON THE WRITE TO LAND.
   *
   * The ladders and the day's spent runs are derived from the attempt history,
   * so anything drawn from them is WRONG between a run finishing and the row
   * coming back - which is precisely the window the results screen lives in.
   * A screen that needs the post-write truth registers here and is called once
   * the row is written AND the index has been rebuilt around it.
   *
   * It is a list rather than a single slot because there is no guarantee only
   * one thing wants it, and a second registration silently replacing the first
   * is the kind of bug that only shows up on the screen you were not testing.
   *
   * Each entry says whether it is still worth calling - a results screen you
   * have already navigated away from is not - so nothing here has to be
   * unregistered on the way out. Deregistration you have to remember is
   * deregistration you will forget.
   */
  var afterSave = [];

  function onSaveLanded(isLive, fn) {
    afterSave.push({ live: isLive, run: fn });
  }

  function fireSaveLanded() {
    var pending = afterSave;
    afterSave = [];
    for (var i = 0; i < pending.length; i++) {
      /* One listener throwing must not cost the others their call, and none of
         them can be allowed to reach the write's failure branch - by here the
         row is safely written and nothing after it may un-succeed it. */
      try {
        if (pending[i].live()) pending[i].run();
      } catch (e) {}
    }
  }

  /**
   * Write one attempt, and say so on screen while it is happening.
   *
   * The receipt goes in FIRST, before the network is touched, because the whole
   * point of it is to cover the window where the server does not know yet.
   */
  function bankAttempt(attempt) {
    var key = isGame(attempt.mode) ? attempt.mode : '_quiz';
    markSpent(attempt.songId, key);
    S.saving++;
    S.saveState = 'saving';
    S.saveRetry = null;
    paintSaveState();
    /* TWO-ARGUMENT then, NOT then().catch(). With a trailing catch, anything
       that goes wrong while PAINTING the success - and the outcome panel reads
       a dozen fields off the server's reply - lands in the failure branch, so a
       row that is safely written reports itself as unwritten and offers to
       write itself again. The rejection handler here can only ever see the
       write itself failing. */
    api('saveAttempt', { attempt: attempt })
      .then(function (r) {
        S.outcome = r;
        S.saving = Math.max(0, S.saving - 1);
        S.saveState = 'saved';
        S.saveRetry = null;
        paintOutcome();               // fills the placeholder, if you are still there
        paintSaveState();
        /* REFRESHING THE INDEX IS A SEPARATE CONCERN AND CARRIES ITS OWN CATCH.
           Chained onto the write and left to fall into the catch below, a
           refresh that failed reported a run that WAS written as unsaved, put a
           "send it again" button under it, and offered to write the row a
           second time - so a flaky read could double a score. The write has
           already succeeded by here; nothing after it can un-succeed it.

           THE LISTENERS FIRE AFTER THE REFRESH, NOT AFTER THE WRITE. The row
           being in the sheet is not the same as the app knowing what it did:
           the ladders and the day's spent runs are derived in apiInit, so
           anything repainting from them has to wait for the index that was
           built around the new row. */
        refreshIndex().then(fireSaveLanded, function () {});
      }, function (e) {
        S.saving = Math.max(0, S.saving - 1);
        /* No row was written, so the day is NOT spent - take the receipt back.
           Keeping it would lock you out of a credit run you never got. */
        delete S.spent[String(attempt.songId) + '|' + key];
        S.saveState = 'failed';
        S.saveRetry = attempt;
        paintSaveState();
        toast('Score not saved: ' + e.message);
      });
  }

  /**
   * The line on the results screen that says whether the run is in the book.
   *
   * It used to say nothing at all, and the run went off to the server while you
   * were already tapping your way back into the picker. Now the state is on the
   * page: writing, written, or not written and here is the button to try again.
   */
  function paintSaveState() {
    var host = document.getElementById('saveState');
    if (!host) return;
    host.innerHTML = '';
    if (!S.saveState) return;
    /* It is a tile in the outcome row now, so the state class goes ON TOP of
       the tile classes rather than replacing them. Assigning className wholesale
       used to be safe when this owned its own div; it is not any more. */
    var BASE = 'out-tile out-save save-state ';
    if (S.saveState === 'saving') {
      host.className = BASE + 'is-saving';
      host.innerHTML = '<span class="save-spinner"></span><span>Logging...</span>';
      return;
    }
    if (S.saveState === 'saved') {
      host.className = BASE + 'is-saved';
      host.innerHTML = '<span class="save-tick">&#10003;</span><span>Logged.</span>';
      return;
    }
    host.className = BASE + 'is-failed';
    host.innerHTML = '<span class="save-tick">!</span>' +
      '<span>Not written.</span><span class="out-sub">nothing is lost</span>';
    var again = el('button', 'btn btn-outline btn-sm', 'Send it again');
    again.addEventListener('click', function () {
      var a = S.saveRetry;
      if (a) bankAttempt(a);
    });
    host.appendChild(again);
  }

  /** Plain-language version of a hot/cold state. */
  function stateSentence(st) {
    if (!st || st.hot === null || st.hot === undefined) return 'never quizzed';
    if (st.hot) {
      return st.hotDays > 0
        ? 'hot for ' + st.hotDays + ' more day' + (st.hotDays === 1 ? '' : 's')
        : 'hot, just for today';
    }
    if (!(st.score > 0)) return 'frozen';
    return 'cold, losing ' + rateText(st.coldRate) + ' a night';
  }

  function paceLine(mine, theirs, unit, what) {
    if (!theirs) return '';
    var d = theirs - mine;
    var pct = Math.round((d / theirs) * 100);
    var cls = Math.abs(pct) < 3 ? 'pace-flat' : (d > 0 ? 'pace-good' : 'pace-bad');
    var word = Math.abs(pct) < 3 ? 'right on' : (d > 0 ? 'faster than' : 'slower than');
    var amount = unit === 's'
      ? Math.abs(Math.round(d)) + 's '
      : Math.abs(d).toFixed(2) + 's/word ';
    return '<div class="' + cls + '">' +
      (Math.abs(pct) < 3 ? 'right on ' : amount + word + ' ') + what +
      (Math.abs(pct) < 3 ? '' : '  (' + (d > 0 ? '-' : '+') + Math.abs(pct) + '%)') +
      '</div>';
  }

  /**
   * What the quiz did to the song, and how the pace compared. Built from the
   * server's answer rather than re-derived here - the hot/cold rules live in
   * one place and this screen is not going to be the second copy.
   */
  /** Hot days or the nightly loss, small, to sit under a score. */
  function outState(st) {
    if (!st || st.hot === null || st.hot === undefined) return '';
    if (st.hot) {
      return '<i class="out-dot is-hot" title="hot">' + (st.hotDays || 0) + '</i>';
    }
    if (!(st.score > 0)) return '<i class="out-dot is-frozen" title="frozen">&#10052;</i>';
    return '<i class="out-dot is-cold" title="losing ' + rateText(st.coldRate) +
      ' a night">' + rateText(st.coldRate) + '</i>';
  }

  /**
   * WHAT THE RUN DID, as a row of tiles rather than a column of sentences.
   *
   * It used to be three stacked paragraphs of prose - the state before and
   * after, then a pace block, then a line of footnotes - which is a lot of
   * reading for a screen you look at for four seconds on your way to the next
   * game. The same four facts fit across one row: what you played and how long
   * it took, how that pace compares, what it moved the song from and to, and
   * whether it is in the book.
   *
   * Games get the same row with the middle two tiles absent, because a game is
   * not timed and cannot be paced. Nothing here is game-specific or
   * quiz-specific; the tiles that have nothing to say do not appear.
   */
  function outcomeHtml(r) {
    var b = r.before, a = r.after, t = r.timing, tiles = [], bits = [];

    // 1. what it was, and how long it took
    var lvl = r.level ? (LEVEL_LABEL[r.level] || r.level) : '';
    var left = S.gameLeft;
    if (lvl || t.seconds > 0 || left !== null) {
      tiles.push('<div class="out-tile out-when">' +
        (lvl ? '<span class="level-tag">' + esc(lvl) + '</span>' : '') +
        (t.seconds > 0 ? '<div class="out-big">' + fmtClock(t.seconds) + '</div>' : '') +
        (left !== null && left !== undefined
          ? '<div class="out-left">' + fmtClock(left) + '<span> left</span></div>' : '') +
        '</div>');
    }

    // 2. how that pace reads against everything else you have done
    if (t.seconds > 0 && (t.perWord || t.songMedian)) {
      var head = '', subs = [];
      if (t.perWord && t.modePerWord) {
        var d = t.modePerWord - t.perWord;
        var pct = Math.round((d / t.modePerWord) * 100);
        var cls = Math.abs(pct) < 3 ? 'pace-flat' : (d > 0 ? 'pace-good' : 'pace-bad');
        head = '<div class="' + cls + '">' + t.perWord.toFixed(2) + 's/word' +
          (Math.abs(pct) < 3 ? '' : '  (' + (d > 0 ? '-' : '+') + Math.abs(pct) + '%)') +
          '</div>';
        subs.push(t.modePerWord.toFixed(2) + 's/word avg., ' + timingLabel(t.device));
        if (t.modeCount) {
          subs.push(t.modeCount + ' timed attempt' + (t.modeCount === 1 ? '' : 's'));
        }
      } else if (t.perWord) {
        head = '<div>' + t.perWord.toFixed(2) + 's/word</div>';
        subs.push('first timed run at this level');
        subs.push(esc(timingLabel(t.device)));
      }
      if (t.songMedian) {
        subs.push('vs ' + fmtClock(t.songMedian) + ' here (' + t.songCount + ')');
      }
      if (head) {
        tiles.push('<div class="out-tile out-pace">' + head +
          '<div class="out-sub">' + subs.join('<br>') + '</div></div>');
      }
    }

    /* 3. what it moved the song from, and to. THE ARROW CARRIES THE NET, not
       the award - arrears are settled out of what you earned, so a 3-point run
       against a rate of 2 moves the score by 1 and the arrow has to agree with
       the two numbers either side of it. The award itself is not lost, it is
       in the footnote below. */
    var net = r.netPoints === undefined || r.netPoints === null ? r.points : r.netPoints;
    var owed = r.paidDebt || 0;
    tiles.push('<div class="out-tile out-move">' +
      '<span class="out-score">' + (b.any ? Math.round(b.score) : '&ndash;') +
      outState(b.any ? b : null) + '</span>' +
      '<span class="out-arrow">&rarr;' +
      (net > 0 ? '<i>+' + net.toFixed(1) + '</i>' : '') + '</span>' +
      '<span class="out-score is-now">' + Math.round(a.score) + outState(a) + '</span>' +
      '</div>');

    // the footnotes that only sometimes apply
    if (owed > 0) {
      bits.push('worth ' + r.points.toFixed(1) + ', and ' + owed.toFixed(1) +
        ' of it went on the debt' +
        (a.hot ? '' : ', ' + rateText(a.coldRate) + ' a night still owing'));
    }
    if (r.speedOn) {
      if (r.speedBaseline) {
        var pct2 = Math.round((r.speedFactor - 1) * 100);
        bits.push('pace moved the award ' + (pct2 > 0 ? '+' : '') + pct2 + '%');
      } else if (r.timed) {
        bits.push('no earlier timed run here to pace this against');
      } else {
        bits.push('timed, but not scored on it - the box was not ticked');
      }
    }

    var html = tiles.join('');
    /* A MEDAL IS A HEADLINE, so it goes under the tiles at full width rather
       than becoming a fourth tile squeezed in beside them. It only ever
       appears on the one run that finished it - a banner on every results
       screen for the rest of the song's life would stop being an
       announcement inside a week. */
    if (r.medalGained) {
      html += '<div class="medal-won medal-won-' + esc(r.medalGained) + '">' +
        medalSvg(r.medalGained, 34) +
        '<div><div class="medal-won-head">' + esc(MEDAL_TEXT[r.medalGained]) +
        ' medal</div>' +
        '<div class="medal-won-sub">Rest days on this song are now bought at ' +
        medalX(r.medalGained) + ' times the usual share.</div></div></div>';
    }
    if (bits.length) {
      var safe = [];
      for (var z = 0; z < bits.length; z++) safe.push(esc(bits[z]));
      html += '<p class="form-hint out-note">' + safe.join('  &middot;  ') + '</p>';
    }
    return html;
  }

  /**
   * Median pace per level, phone and PC in their own columns.
   *
   * Never merged. A thumb on glass and ten fingers on a keyboard are
   * different measurements - averaged together they would read as "you are
   * slow at Blind" when all it means is that you did Blind on your phone.
   *
   * field 'median' gives raw time, which only means anything within one song.
   * field 'perWord' divides by the words graded, which is the only figure
   * that survives comparison ACROSS songs of different lengths.
   */
  function paceTable(rows, minRuns, field) {
    var by = {}, any = false;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!by[r.mode]) by[r.mode] = {};
      by[r.mode][r.device] = r;
    }
    var html = '<table class="pace-table"><tr><th>Level</th><th>Phone</th><th>PC</th></tr>';
    for (var m = 0; m < S.modes.length; m++) {
      var id = S.modes[m].id;
      if (!by[id] || S.modes[m].kind === 'game') continue;    // games are not timed
      any = true;
      html += '<tr><td>' + esc(S.modes[m].full || S.modes[m].label) + '</td>';
      var devs = ['phone', 'desktop'];
      for (var d = 0; d < devs.length; d++) {
        var cell = by[id][devs[d]];
        var val = null;
        if (cell) {
          val = field === 'perWord'
            ? (cell.perWord === null ? null : cell.perWord.toFixed(2) + 's')
            : fmtClock(cell.median);
        }
        if (val === null) { html += '<td class="pace-none">&ndash;</td>'; continue; }
        // the dot marks a bucket deep enough that pace is moving the points
        html += '<td>' + val + '<span class="pace-n">  ' + cell.n +
          (minRuns && cell.n >= minRuns ? ' &#9679;' : '') + '</span></td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    if (!any) return null;
    var host = el('div');
    host.innerHTML = html;
    return host;
  }

  /* The tiles carry the level and what the run was worth, so the sentence
     under the meter has done its job by the time they arrive. It stays until
     then, because the server takes a beat and a blank space is worse than a
     line you are about to replace. */
  function hideMeterSub() {
    var ms = document.querySelector('.meter-sub');
    if (ms) ms.style.display = 'none';
  }

  function paintOutcome() {
    var host = document.getElementById('quizOutcome');
    if (!host || !S.outcome) return;
    host.innerHTML = outcomeHtml(S.outcome);
    hideMeterSub();
  }

  /* ---------- Verse Sort ---------- */
  /* ---------- masks, one per rung of the ladder ---------- */
  function underscoresFor(w) {
    var out = '';
    for (var i = 0; i < w.length; i++) if (isLetterCode(w.charCodeAt(i))) out += '_';
    return out;
  }
  function lettersOf(w) {
    var out = '';
    for (var i = 0; i < w.length; i++) if (isLetterCode(w.charCodeAt(i))) out += w.charAt(i);
    return out;
  }
  function firstLetterMask(line) {
    var ws = words(line), parts = [];
    for (var i = 0; i < ws.length; i++) {
      var L = lettersOf(ws[i]);
      parts.push(L.length ? L.charAt(0) + underscoresFor(ws[i]).slice(1) : '');
    }
    return parts.join(' ');
  }

  /* ---------- the Easy rung's letters - 1.51 ---------- */

  /**
   * THE DIALS, READ OFF THE SETTINGS BLOB.
   *
   * A second reading of the same four fields the server validates - the page
   * cannot call the server's copy, and the alternative is shipping a resolved
   * rule alongside the settings that already contain it. The fallbacks here
   * match the server's defaults by inspection; they only ever fire on a blob
   * written before 1.51, since apiSetSettings will not store a value outside
   * the allowed list.
   */
  var LETTER_PICKS  = ['first', 'random'];
  var LETTER_SCOPES = ['word', 'line', 'verse', 'song'];

  function letterRuleOf(settings) {
    var q = (settings && settings.quizzes && settings.quizzes.medium) || {};
    return {
      pick:  LETTER_PICKS.indexOf(q.letterPick) === -1 ? 'random' : q.letterPick,
      scope: LETTER_SCOPES.indexOf(q.letterScope) === -1 ? 'word' : q.letterScope,
      count: Math.max(0, Math.min(12, Math.round(Number(q.letterCount) || 0))),
      pct:   Math.max(0, Math.min(100, Number(q.letterPct) || 0))
    };
  }

  /**
   * ONE WORD, WITH k OF ITS LETTERS SHOWING.
   *
   * The mask is built from the word's LETTERS ONLY, the same reading of a word
   * that underscoresFor uses, so punctuation never occupies a slot and a word
   * with an apostrophe in it does not get a free letter for the apostrophe.
   */
  function letterMaskWord(word, k, pick) {
    var L = lettersOf(word);
    if (!L.length) return '';
    var n = Math.max(0, Math.min(k, L.length));
    var show = {};
    if (pick === 'first') {
      for (var i = 0; i < n; i++) show[i] = true;
    } else {
      /* Partial Fisher-Yates over the positions rather than "pick a random
         index n times and hope": repeated draws collide, and a collision
         silently shows FEWER letters than the dial says - a dial that
         under-delivers at random is worse than one that is simply wrong. */
      var idx = [];
      for (var p2 = 0; p2 < L.length; p2++) idx.push(p2);
      for (var q = 0; q < n; q++) {
        var j = q + Math.floor(Math.random() * (idx.length - q));
        var t = idx[q]; idx[q] = idx[j]; idx[j] = t;
        show[idx[q]] = true;
      }
    }
    var out = '';
    for (var c = 0; c < L.length; c++) out += show[c] ? L.charAt(c) : '_';
    return out;
  }

  /**
   * HOW MANY LETTERS EACH WORD IN A UNIT GETS, out of a share of that unit.
   *
   * Proportional to length, which is the only reading of "20% of the letters"
   * that does not quietly become something else: handing every word the same
   * count would be a flat rule wearing a percentage's clothes, and it would
   * give a three-letter word the same help as a nine-letter one.
   *
   * The remainder after the floor of each share is handed out to the words
   * with the largest fractional part - the standard largest-remainder
   * apportionment - so the total lands exactly on the budget instead of
   * drifting a few letters under it on every verse.
   */
  function shareLetters(lens, pct) {
    var total = 0, i;
    for (i = 0; i < lens.length; i++) total += lens[i];
    var budget = Math.round(total * pct / 100);
    if (budget <= 0) return lens.map(function () { return 0; });
    if (budget >= total) return lens.slice();

    var out = [], rema = [];
    var given = 0;
    for (i = 0; i < lens.length; i++) {
      var exact = lens[i] * pct / 100;
      var base = Math.floor(exact);
      if (base > lens[i]) base = lens[i];
      out.push(base);
      given += base;
      rema.push({ at: i, frac: exact - base });
    }
    rema.sort(function (a, b) { return b.frac - a.frac; });
    var at = 0;
    /* Walk the list repeatedly rather than once: a word already at its full
       length cannot take another letter, so a single pass can finish with the
       budget unspent while other words still have room. */
    var guard = 0;
    while (given < budget && guard < lens.length * 20) {
      var w = rema[at % rema.length].at;
      if (out[w] < lens[w]) { out[w]++; given++; }
      at++;
      guard++;
    }
    return out;
  }

  /**
   * THE WHOLE SONG'S EASY MASKS, BUILT ONCE, keyed 'section|line'.
   *
   * Built up front and in one pass for two reasons, and each on its own would
   * be enough:
   *
   * - **The budget can span lines.** At a scope of verse or song, how many
   *   letters this line shows depends on every other line in the unit, so
   *   there is no answer to "mask this line" taken on its own. maskForMode
   *   cannot do it, because maskForMode only ever sees one line.
   * - **Random letters have to be decided once.** Re-rolling per repaint would
   *   move the visible letters under a half-typed answer.
   */
  function buildLetterMasks(song, rule) {
    var out = {};
    var units = [];      // each is a list of {key, words}

    var lines = [];
    for (var n = 0; n < song.sections.length; n++) {
      var sec = song.sections[n];
      if (sec.type === 'marker') continue;
      var all = typableLines(sec);
      var here = [];
      for (var k = 0; k < all.length; k++) {
        var entry = { key: n + '|' + k, words: words(all[k].t) };
        here.push(entry);
        lines.push(entry);
      }
      if (rule.scope === 'verse' && here.length) units.push(here);
      if (rule.scope === 'line') {
        for (var L = 0; L < here.length; L++) units.push([here[L]]);
      }
    }
    if (rule.scope === 'song') units = lines.length ? [lines] : [];
    if (rule.scope === 'word') units = lines.map(function (e) { return [e]; });

    for (var u = 0; u < units.length; u++) {
      var unit = units[u];
      // flatten the unit's words, remembering which line each came from
      var flatWords = [], owner = [];
      for (var a = 0; a < unit.length; a++) {
        for (var b = 0; b < unit[a].words.length; b++) {
          flatWords.push(unit[a].words[b]);
          owner.push(a);
        }
      }
      var lens = flatWords.map(function (w) { return lettersOf(w).length; });
      var counts;
      if (rule.scope === 'word') {
        counts = lens.map(function () { return rule.count; });
      } else {
        counts = shareLetters(lens, rule.pct);
      }

      var byLine = [];
      for (var z = 0; z < unit.length; z++) byLine.push([]);
      for (var w2 = 0; w2 < flatWords.length; w2++) {
        byLine[owner[w2]].push(letterMaskWord(flatWords[w2], counts[w2], rule.pick));
      }
      for (var y = 0; y < unit.length; y++) out[unit[y].key] = byLine[y].join(' ');
    }
    return out;
  }

  /** The rule in force, in a sentence, for the screen that is about to use it. */
  function letterRuleText(rule) {
    var where = rule.pick === 'first' ? 'from the start of' : 'at random from';
    if (rule.scope === 'word') {
      if (rule.count <= 0) return 'No letters showing - the same as Medium.';
      return rule.count + ' letter' + (rule.count === 1 ? '' : 's') + ' ' + where +
             ' every word.';
    }
    var unit = rule.scope === 'line' ? 'each line'
             : rule.scope === 'verse' ? 'each verse' : 'the whole song';
    if (rule.pct <= 0) return 'No letters showing - the same as Medium.';
    return rule.pct + '% of the letters in ' + unit + ', taken ' + where +
           ' the words in proportion to their length.';
  }
  /**
   * A WORD AS THE QUIZ HANDS IT TO YOU - 1.52, and every mark goes - 1.52a.
   *
   * No comma, no quote mark, no full stop, no elision mark, and as of 1.52a no
   * interior apostrophe either: ol' is handed over as ol, 'em as em, '79 as 79,
   * and don't as dont.
   *
   * THE RULE IS ABOUT WHAT YOU ARE ASKED TO TYPE, not about spelling. A mark
   * you are shown is a mark you will try to reproduce, and the grader has never
   * wanted one - it normalises every apostrophe away before it compares
   * anything. Showing "don't" while silently accepting "dont" was the app
   * asking for a character it then ignored.
   *
   * 1.52 kept the interior one on the argument that "dont" is not a word and
   * reads as a mistake in the songbook. Kyle's call, and the right one: the
   * songbook is full of words that are not words - walkin', ol', gonna, '79 -
   * and this is a fill-in-the-blank prompt rather than a printed lyric. THE
   * LYRIC SHEET IS UNTOUCHED and still shows every apostrophe the song has,
   * which is where spelling is actually on display.
   */
  function shownWord(w) {
    var core = bareWord(w), out = '';
    for (var i = 0; i < core.length; i++) {
      if (!isApos(core.charAt(i))) out += core.charAt(i);
    }
    return out;
  }

  function openingWordsMask(line) {
    var ws = words(line);
    if (!ws.length) return '';
    var n = Math.max(1, Math.round(ws.length * 0.3));
    var parts = [];
    for (var i = 0; i < ws.length; i++) {
      parts.push(i < n ? shownWord(ws[i]) : underscoresFor(ws[i]));
    }
    return parts.join(' ');
  }
  /* Easy and Medium swapped: having the opening words handed to you is a
     bigger leg-up than a first letter on every word, so it is the cheaper
     rung now. The ids and their point values did not move - only which mask
     each one draws. */
  /* The ids never moved when the ladder was relabelled - see QUIZ_MODES. So
     the id "easy" still draws the opening-words mask even though it now reads
     "Beginner". Blank Lines gets the plain underscore mask too: the section
     around it is already printed out, so the shape of the one missing line is
     not what was making it hard - and without it you are typing into a void
     with no idea whether you are reaching for four words or eleven. */
  /* pre is the Easy rung's precomputed mask for THIS line, where there is one.
     It has to come in from outside because its budget can span the whole verse
     or the whole song - see buildLetterMasks - and this function only ever sees
     one line. The first-letter mask is the fallback rather than an error: a
     missing entry means the map and the render disagreed about which lines
     exist, and the old behaviour is a great deal better than a blank rung. */
  function maskForMode(line, mode, pre) {
    if (mode === 'blind') return '';
    if (mode === 'easy') return openingWordsMask(line);
    if (mode === 'medium') return pre === undefined ? firstLetterMask(line) : pre;
    return maskOf(line);              // hard, and Blank Lines
  }

  /* ---------- every typing mode ---------- */
  /**
   * The typing ladder, and First Lines.
   *
   * First Lines is the cheap rung: the section is printed exactly as the song
   * sheet has it EXCEPT for its opening, which is a row of blanks you fill in.
   * Openings are the hooks a whole verse hangs off, so this is the one that
   * pays off fastest on a song you barely know - and it is graded on those
   * lines alone, since they are the only ones you were asked for.
   */
  function renderTypingQuiz(song, idx, mode, timed) {
    var blankLines = (mode === 'firstLines');
    // '' or 'r' means one at random from each section; 'n3' means the third
    var pick = String(S.quizVariant || 'r');
    var cfg = modeById(mode) || { label: mode, blurb: '' };
    /* Built once for the whole song, before a single line is drawn - the
       letters a line shows can depend on every other line in its verse. */
    var letterRule = mode === 'medium' ? letterRuleOf(S.settings) : null;
    var letterMasks = letterRule ? buildLetterMasks(song, letterRule) : null;
    var labels = labelSections(song.sections);
    var entriesBySection = {};
    // raw section index -> heat address, which counts only real sections
    var heatIdx = heatIndexMap(song);

    var wrap = el('div');
    var intro = el('div', 'quiz-intro');
    intro.innerHTML =
      '<p class="section-eyebrow">' + esc(cfg.label) + '  &middot;  ' +
      modePoints(mode) + ' points</p>' +
      '<h2 class="section-title mt-0">' + esc(song.title) + '</h2>' +
      '<p class="text-muted">' + esc(cfg.blurb) +
      (letterRule ? ' ' + esc(letterRuleText(letterRule)) : '') +
      ' Repeated choruses are shown as markers and are not scored.</p>';
    wrap.appendChild(intro);

    var form = el('form');
    wrap.appendChild(form);
    appEl.appendChild(wrap);

    /* A QUARTER OF THE BAR FOR THE SPELLCHECKER - 1.61. See the engine above
       spellFlags for what it marks and why it will not tell you the word. */
    var bar = el('div', 'quiz-submit-bar');
    var gradeRow = el('div', 'grade-bar');
    var spellBtn = el('button', 'btn btn-outline grade-spell', 'Spell check');
    spellBtn.type = 'button';
    var submit = el('button', 'btn btn-gold', 'Grade my lyrics');
    submit.type = 'button';
    gradeRow.appendChild(spellBtn);
    gradeRow.appendChild(submit);
    bar.appendChild(gradeRow);
    /* Built once for the whole song, like the letter masks, and handed to every
       line - it is the same few hundred words for all of them. */
    var vocab = songVocab(song);

    for (var i = 0; i < song.sections.length; i++) {
      (function (sec, n) {
        if (sec.type === 'marker') {
          form.appendChild(el('div', 'marker-chip', esc(sec.ref) + '  &#8635;  not scored'));
          return;
        }
        var all = typableLines(sec);
        if (!all.length) return;

        var block = el('div', 'quiz-block');
        var lab = el('div', 'quiz-line-label');
        lab.innerHTML = '<span>' + esc(labels[n]) + '</span>';
        block.appendChild(lab);

        var host = el('div', 'fillin-lines');
        var entries = [];

        // Every tapping mode is a game now and never reaches this renderer, so
        // what is left is a mask over each typed line - or, on Blank Lines, the
        // section printed out with one line of it missing.
        var blankAt = -1;
        if (blankLines) {
          if (pick.charAt(0) === 'n') {
            var want = Number(pick.slice(1)) - 1;
            // a section shorter than the line you asked for gives up its last
            blankAt = Math.min(Math.max(0, want), all.length - 1);
          } else {
            blankAt = Math.floor(Math.random() * all.length);
          }
        }
        for (var k = 0; k < all.length; k++) {
          (function (ln, at) {
            if (blankLines && at !== blankAt) {
              host.appendChild(el('div', 'fillin-shown', esc(ln.t)));
              return;
            }
            /* SHOWN IS NOT RECALLED. Beginner prints the opening words of every
               line, and typing back a word that is sitting in front of you
               proves nothing about whether you know it - so the heatmap is told
               about the masked words only. Blank Lines needs no equivalent: the
               lines it shows you are never entries at all. */
            var shown = (mode === 'easy')
              ? Math.max(1, Math.round(words(ln.t).length * 0.3)) : 0;
            var mask = maskForMode(ln.t, mode,
              letterMasks ? letterMasks[n + '|' + at] : undefined);
            var row = el('div', 'fillin-line' + (mask === '' ? ' fillin-blind' : ''));
            /* spellcheck stays FALSE on the input. The browser's own checker
               does not know this song, so it would red-line every dialect
               spelling and every name in the songbook, and it cannot be read
               from script - so it could neither be trusted nor counted. The
               layer below is the app making its own ruling. */
            row.innerHTML =
              '<div class="fillin-mask">' + (esc(mask) || NBSP) + '</div>' +
              '<div class="fillin-spell"></div>' +
              '<input class="fillin-input" type="text" autocomplete="off" ' +
              'autocapitalize="off" autocorrect="off" spellcheck="false">';
            host.appendChild(row);
            var input2 = row.querySelector('.fillin-input');
            var spellHost = row.querySelector('.fillin-spell');
            /* A MARK IS ABOUT THE TEXT IT WAS DRAWN ON. The moment that text
               changes the mark is a statement about something that is no longer
               there, and a stale mark on a word you have already fixed is worse
               than no mark at all - so typing clears it and the button is how
               you ask again. */
            input2.addEventListener('input', function () { spellHost.innerHTML = ''; });
            entries.push({ read: function () { return input2.value; }, actual: ln.t,
                           sec: heatIdx[n], line: at, shown: shown,
                           node: input2, spell: spellHost, vocab: vocab });
          })(all[k], k);
        }

        block.appendChild(host);
        entriesBySection[n] = entries;
        form.appendChild(block);
      })(song.sections[i], i);
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.appendChild(bar);

    // Tabbing into a line sitting under the sticky Grade bar used to leave you
    // typing behind it. Scroll the field clear instead.
    var allInputs = form.querySelectorAll('.fillin-input');
    for (var fi = 0; fi < allInputs.length; fi++) {
      (function (input) {
        input.addEventListener('focus', function () {
          setTimeout(function () {
            var b = bar.getBoundingClientRect();
            var r = input.getBoundingClientRect();
            var limit = b.top - 14;
            if (r.bottom > limit) window.scrollBy(0, r.bottom - limit);
            else if (r.top < 60) window.scrollBy(0, r.top - 60);
          }, 40);
        });
      })(allInputs[fi]);
    }

    /**
     * Mark every line at once, say how many, and go to the first one.
     *
     * The count is the whole report. A list of the words it objected to would be
     * a second place the same finding is written down, and the finding is
     * already on the line where the mistake is - which is where you have to go
     * to fix it anyway. Scrolling to the first mark is the other half of that:
     * on a long song the marks can all be off-screen, and a toast saying three
     * words are wrong somewhere is a worse experience than no button.
     */
    spellBtn.addEventListener('click', function () {
      var bad = 0, firstBad = null;
      for (var sn in entriesBySection) {
        if (!entriesBySection.hasOwnProperty(sn)) continue;
        var list = entriesBySection[sn];
        for (var e3 = 0; e3 < list.length; e3++) {
          var en3 = list[e3];
          var typed = en3.read();
          var flags = spellFlags(typed, en3.actual, en3.vocab);
          var parts = String(typed).split(' '), html = '', hits = 0;
          for (var p3 = 0; p3 < parts.length; p3++) {
            if (p3) html += ' ';
            if (flags[p3]) {
              html += '<span class="spell-bad">' + esc(parts[p3]) + '</span>';
              hits++;
            } else {
              html += esc(parts[p3]);
            }
          }
          en3.spell.innerHTML = hits ? html : '';
          if (hits && !firstBad) firstBad = en3.node;
          bad += hits;
        }
      }
      if (!bad) { toast('Nothing here looks misspelled'); return; }
      toast(bad === 1 ? 'One word looks misspelled - marked in red'
                      : bad + ' words look misspelled - marked in red');
      if (firstBad) {
        var r3 = firstBad.getBoundingClientRect();
        if (r3.top < 70 || r3.bottom > window.innerHeight - 150) {
          window.scrollBy(0, r3.top - 120);
        }
      }
    });

    submit.addEventListener('click', function () {
      var results = [], totalWords = 0, correctWords = 0, obs = [];
      for (var n = 0; n < song.sections.length; n++) {
        var entries = entriesBySection[n];
        if (!entries) continue;
        var sec = song.sections[n];
        var lines = [], secCorrect = 0, secTotal = 0;
        for (var e2 = 0; e2 < entries.length; e2++) {
          var en = entries[e2];
          var g = gradeLine(en.actual, en.read());
          lines.push(g);
          secCorrect += g.correctCount;
          secTotal += g.totalCount;
          /* One observation per word this run actually ASKED for. The line and
             verse rollups are derived on the server from these, never sent, so
             the page and the server cannot come to different conclusions about
             the same run. */
          if (en.sec !== undefined) {
            for (var hw = en.shown; hw < g.hits.length; hw++) {
              obs.push({ s: en.sec, l: en.line, w: hw, ok: g.hits[hw] ? 1 : 0 });
            }
          }
        }
        totalWords += secTotal;
        correctWords += secCorrect;
        results.push({
          label: labels[n], type: sec.type, lines: lines,
          correctCount: secCorrect, totalCount: secTotal
        });
      }
      var accuracy = totalWords ? Math.round((correctWords / totalWords) * 1000) / 10 : 0;
      finishQuiz(song, idx, mode, accuracy, results, totalWords, correctWords, '',
                 timed, obs);
    });
  }

  /* ---------- grading: LCS word diff ---------- */
  function diffWords(actualWords, typedWords) {
    /* Compared through wordsMatch rather than on normalised strings, so an
       elision the song wrote with a letter dropped accepts the whole word
       back. Everything else about the diff is unchanged. */
    var a = actualWords, b = typedWords, i, j;
    function same(x, y) { return wordsMatch(x, y); }
    var n = a.length, m = b.length;
    var dp = [];
    for (i = 0; i <= n; i++) {
      var row = [];
      for (j = 0; j <= m; j++) row.push(0);
      dp.push(row);
    }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var ops = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (same(a[i], b[j])) { ops.push({ type: 'equal', actual: actualWords[i], typed: typedWords[j] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'delete', actual: actualWords[i] }); i++; }
      else { ops.push({ type: 'insert', typed: typedWords[j] }); j++; }
    }
    while (i < n) { ops.push({ type: 'delete', actual: actualWords[i] }); i++; }
    while (j < m) { ops.push({ type: 'insert', typed: typedWords[j] }); j++; }

    var merged = [];
    for (var k = 0; k < ops.length; k++) {
      var cur = ops[k], next = ops[k + 1];
      if (cur.type === 'delete' && next && next.type === 'insert') {
        merged.push({ type: 'sub', actual: cur.actual, typed: next.typed }); k++;
      } else if (cur.type === 'insert' && next && next.type === 'delete') {
        merged.push({ type: 'sub', actual: next.actual, typed: cur.typed }); k++;
      } else merged.push(cur);
    }
    return merged;
  }

  /**
   * HOW FAR APART TWO WORDS ARE, in single-character edits.
   *
   * Ordinary Levenshtein over the normalised forms, so case and punctuation are
   * out of it before the count starts - "Don't" against "dont" is a distance of
   * nothing, which it should be.
   */
  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev.push(j);
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /**
   * WHAT A WRONG WORD IS STILL WORTH - 1.52.
   *
   * A word graded right or wrong and nothing in between makes one slipped
   * finger cost exactly as much as not knowing the line at all, and those are
   * not the same failure. Typing "wistle" for "whistle" is a typo; typing
   * "window" is a blank. The score should be able to tell them apart.
   *
   * So a wrong word keeps a share of its mark: one minus the edit distance over
   * the length of the word the song actually has.
   *
   *   whistle / wistle   1 edit of 7   ->  0.86
   *   whistle / whistled 1 edit of 7   ->  0.86
   *   whistle / window   6 edits of 7  ->  0
   *
   * TWO GUARDS, and both were the first thing to get wrong:
   *
   * - **At most two edits.** Past that it is not a typo, it is a different
   *   word, and letters two words happen to share are not partial knowledge.
   * - **At least half the word.** Short words are where this gets silly - "he"
   *   against "me" is one edit of two, and half a mark for a word you did not
   *   know is a great deal more than a typo is worth. The floor throws those
   *   out rather than pretending the formula scales all the way down.
   *
   * IT IS STILL MARKED WRONG. The token stays red-and-corrected on the results
   * screen, and the heatmap still records a miss: the credit is about scoring
   * proportionately, not about deciding you knew the word. A heat map that
   * forgave typos would slowly stop pointing at the lines you fumble.
   */
  var TYPO_MAX_EDITS = 2;
  var TYPO_MIN_SHARE = 0.5;

  function typoCredit(actual, typed) {
    var a = normWord(actual), b = normWord(typed);
    if (!a || !b) return 0;
    if (a === b) return 1;
    var d = editDistance(a, b);
    if (d > TYPO_MAX_EDITS) return 0;
    var share = 1 - (d / a.length);
    return share >= TYPO_MIN_SHARE ? share : 0;
  }

  /**
   * HITS ARE ALIGNED TO THE SONG'S WORDS, NOT TO THE TOKENS.
   *
   * The tokens are a diff and can be longer than the line - an insert is a word
   * you typed that the song does not have. Only equal, sub and delete consume
   * one of the song's words, so walking those three keeps the hit list the
   * same length and in the same order as words(actualLine), which is what the
   * heatmap addresses. Anything else and the tint lands on the wrong word.
   */
  function gradeLine(actualLine, typedLine) {
    var aw = words(actualLine), tw = words(typedLine);
    var ops = diffWords(aw, tw);
    var tokens = [], correct = 0, hits = [], at = 0;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.type === 'equal') {
        tokens.push({ kind: 'correct', text: op.actual }); correct++;
        hits[at++] = 1;
      } else if (op.type === 'sub') {
        /* A near miss still reads as wrong and still counts as a miss on the
           heat map - it just does not cost the whole word. See typoCredit. */
        var part = typoCredit(op.actual, op.typed);
        tokens.push({ kind: part > 0 ? 'typo' : 'incorrect',
                      text: op.typed, correction: op.actual,
                      credit: part > 0 ? part : undefined });
        correct += part;
        hits[at++] = 0;
      } else if (op.type === 'delete') {
        tokens.push({ kind: 'missing', text: op.actual });
        hits[at++] = 0;
      } else {
        tokens.push({ kind: 'incorrect', text: op.typed, correction: null });
      }
    }
    while (hits.length < aw.length) hits.push(0);
    /* Partial credit makes this a fraction, so it is rounded at the edge the
       way every other running total in the app is - a correctCount of
       17.299999999999997 is a floating-point artefact, not a score. */
    return { tokens: tokens, correctCount: Math.round(correct * 100) / 100,
             totalCount: aw.length, hits: hits };
  }

  /* ============================================================
     Results
     ============================================================ */
  VIEWS.results = function (p) {
    if (!p || !p.results) { go('front', {}, true); return; }
    var wrap = el('div');
    var meter = el('div', 'meter-wrap');
    var mode = p.mode || 'hard';
    var st = S.settings || { floor: 75 };
    var stFloor = floorOf(p.mode, p.level);
    var base = p.practice ? 0 : modePoints(mode, p.level || 'easy');
    var span = 100 - stFloor;
    var earned = p.accuracy <= stFloor ? 0
      : Math.round(base * ((p.accuracy - stFloor) / (span <= 0 ? 1 : span)) * 10) / 10;
    var cfgMode = null;
    for (var mi = 0; mi < S.modes.length; mi++) if (S.modes[mi].id === mode) cfgMode = S.modes[mi];
    meter.innerHTML = meterSvg(p.accuracy) +
      '<div class="meter-score">' + p.accuracy + '%</div>' +
      '<div class="meter-caption">' + caption(p.accuracy) + '</div>' +
      '<div class="meter-sub">on <span class="level-tag">' +
      esc(cfgMode ? cfgMode.label : mode) +
      (p.level ? '  &middot;  ' + esc(LEVEL_LABEL[p.level] || p.level) : '') + '</span>' +
      '<span id="earnedNote">' +
      (p.practice
        ? '  &rarr;  <strong>practice</strong> - nothing banked, nothing recorded'
        : earned > 0
          ? '  &rarr;  <strong>+' + earned.toFixed(1) + '</strong> points banked'
          : '  &rarr;  <strong>nothing banked</strong> - under the ' + stFloor + '% floor') +
      '</span></div>';
    wrap.appendChild(meter);

    // The figure above is accuracy only, worked out here so the screen is not
    // blank while the write is in flight. The server sends back the real
    // number a beat later - pace can still move it - along with what the run
    // did to the song. paintOutcome fills this in when it lands.
    /* Whether the run is actually in the book yet. Practice runs write nothing
       and say nothing; a real run says what it is doing while it does it. */
    /* THE TILES AND THE RECEIPT SHARE ONE ROW, and are painted by two
       different things at two different times - the receipt the moment the
       write is dispatched, the tiles when the server answers. So they are
       siblings inside the row rather than one owning the other: neither repaint
       can wipe the other out. */
    var outRow = el('div', 'out-row');
    var outcome = el('div', 'out-tiles');
    outcome.id = 'quizOutcome';
    outRow.appendChild(outcome);
    if (!p.practice) {
      var saved = el('div', 'out-tile out-save');
      saved.id = 'saveState';
      outRow.appendChild(saved);
    }
    wrap.appendChild(outRow);

    wrap.appendChild(el('p', 'section-eyebrow',
      (p.results.length === 1 && p.results[0].sortRows) ? 'What went wrong'
                                                        : 'By verse and chorus'));

    // Verse Sort compares two ORDERS, which a row of section names cannot
    // show. Two columns side by side, position for position, says it at a
    // glance: what you played, and what the song does.
    if (p.results.length === 1 && p.results[0].sortRows) {
      var allRows = p.results[0].sortRows;

      /* ONLY THE MISTAKES. A flawless Word Scramble used to print every word
         you placed beside the word it already was, forty rows of "you put
         willows / the song says willows" - which is a lot of scrolling to
         learn nothing. What is worth reading after a run is what you got
         wrong, so that is what is shown. */
      var rows = [];
      for (var fr = 0; fr < allRows.length; fr++) if (!allRows[fr].ok) rows.push(allRows[fr]);
      if (!rows.length) {
        wrap.appendChild(el('div', 'all-clear',
          'Nothing to correct - every one of the ' + allRows.length + ' right.'));
        wrap.appendChild(resultsActions(p));
        appEl.appendChild(wrap);
        buildFooter();
        paintOutcome();
        paintSaveState();
        return;
      }
      var cmp = el('div', 'sort-compare');
      var mine = el('div', 'sort-col');
      var real = el('div', 'sort-col');
      mine.innerHTML = '<div class="sort-col-head">You put</div>';
      real.innerHTML = '<div class="sort-col-head">The song</div>';
      /* A CELL MAY BRING ITS OWN MARKUP - 1.52. Impostor Words reports a whole
         verse with the wrong words picked out inside it, which is not something
         a plain string can carry. Anything a game puts in 'html' it escaped
         itself on the way in; 'peek' is still there and is what everything
         without markup uses, so a game that never heard of this is unaffected. */
      for (var sr = 0; sr < rows.length; sr++) {
        var row = rows[sr];
        var cls = row.ok ? ' sort-cell-ok' : ' sort-cell-no';
        mine.innerHTML += '<div class="sort-cell' + cls + '">' +
          '<div class="sort-cell-kind"><span>' + esc(row.got.label) +
          '</span><span>' + (row.ok ? '&#10003;' : '&#10007;') + '</span></div>' +
          '<div class="sort-cell-text">' +
          (row.got.html || esc(row.got.peek)) + '</div></div>';
        real.innerHTML += '<div class="sort-cell' + (row.ok ? ' sort-cell-ok' : '') + '">' +
          '<div class="sort-cell-kind"><span>' + esc(row.want.label) +
          '</span></div>' +
          '<div class="sort-cell-text">' +
          (row.want.html || esc(row.want.peek)) + '</div></div>';
      }
      cmp.appendChild(mine);
      cmp.appendChild(real);
      wrap.appendChild(cmp);
      wrap.appendChild(resultsActions(p));
      appEl.appendChild(wrap);
      buildFooter();
      paintOutcome();
      paintSaveState();
      return;
    }

    for (var i = 0; i < p.results.length; i++) {
      var r = p.results[i];
      var box = el('div', 'results-section' + (r.type === 'chorus' ? ' results-section-chorus' : ''));
      var pct = r.totalCount ? Math.round((r.correctCount / r.totalCount) * 100) : 100;
      var hdr = el('div', 'results-section-header');
      hdr.innerHTML = '<span>' + esc(r.label) + '</span><span>' + pct + '%</span>';
      box.appendChild(hdr);
      for (var j = 0; j < r.lines.length; j++) {
        var lineEl = el('div', 'diff-line');
        var toks = r.lines[j].tokens;
        if (!toks.length) { lineEl.innerHTML = '<span class="text-muted">(blank)</span>'; }
        for (var k = 0; k < toks.length; k++) {
          var t = toks[k];
          if ((t.kind === 'incorrect' || t.kind === 'typo') && t.correction) {
            var cont = el('span', 'diff-word-container');
            cont.appendChild(el('span', 'diff-word ' + t.kind, esc(t.text || '&mdash;')));
            /* A NEAR MISS SAYS WHAT IT WAS WORTH. Amber rather than red is
               half the message; the other half is the number, because "wrong,
               but it cost you a fifth of a word" is the whole point of the
               partial credit and is otherwise invisible. */
            cont.appendChild(el('span', 'diff-correction',
              '&rarr; ' + esc(t.correction) +
              (t.credit ? ' <span class="diff-part">' +
                 Math.round(t.credit * 100) + '%</span>' : '')));
            lineEl.appendChild(cont);
          } else {
            lineEl.appendChild(el('span', 'diff-word ' + t.kind, esc(t.text || '&mdash;')));
          }
        }
        box.appendChild(lineEl);
      }
      wrap.appendChild(box);
    }

    wrap.appendChild(resultsActions(p));
    appEl.appendChild(wrap);
    paintOutcome();          // already back? then it is there before you look
    paintSaveState();
    buildFooter();
  };

  /** The tab you came in from, so "back" means back where you were. */
  function originTab() {
    for (var i = S.stack.length - 1; i >= 0; i--) {
      var v = S.stack[i].view;
      if (v === 'front' || v === 'back' || v === 'library') return v;
    }
    return 'front';
  }

  var ORIGIN_LABEL = {
    front: 'Front burner',
    back: 'Back burner',
    library: 'The Pantry'
  };

  /**
   * WHICH GAME TO HAND SOMEONE WHO HAS ASKED FOR ANOTHER ONE.
   *
   * Random Game is the only caller left - the results screen prints the whole
   * shelf now rather than drawing from it - but it is still worth having as
   * its own function: the rule for what may be drawn is the same rule the
   * menu paints, and the two going out of step would mean a button that hands
   * you a door the page beside it is showing as shut.
   *
   * It draws from the games you have NOT spent for credit today and falls back
   * to all of them once they are all spent, because practice is unlimited and
   * the level sheet says plainly that today is gone. It will not offer a game
   * this song cannot play, nor one you have not yet reached along the chain.
   * Pass exceptMode to keep it from handing back the one you have just
   * finished, which is the least interesting answer to "another one".
   */
  function drawGameFor(idx, exceptMode) {
    var playable = [], open = [], i, m;
    for (i = 0; i < S.modes.length; i++) {
      m = S.modes[i];
      if (m.kind !== 'game') continue;
      if ((m.id === 'verseSort' || m.id === 'verseOrder') &&
          (idx.sectionCount || 0) < 3) continue;
      /* A GAME YOU HAVE NOT REACHED IS NOT A DRAW - 1.50. The button's whole
         job is to hand you something to play; handing back a locked door and
         letting the level sheet refuse you is worse than the button saying it
         has nothing. */
      if (gameShut(idx, m.id)) continue;
      playable.push(m);
      if (!gameUsed(idx, m.id)) open.push(m);
    }
    var pool = open.length ? open : playable;
    if (exceptMode && pool.length > 1) {
      var others = [];
      for (i = 0; i < pool.length; i++) if (pool[i].id !== exceptMode) others.push(pool[i]);
      if (others.length) pool = others;
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * WHAT TO DO NEXT, and as of 1.50 the answer is the menu itself.
   *
   * It used to be three shortcuts - Try again, More practice, Next game - sat
   * above two ways out. All three were guesses at which of twenty-four buttons
   * you wanted, made by a screen that could not know, and two of them opened a
   * sheet or a picker to ask the question anyway. Next game drew at random and
   * Try again could only ever offer the one you had just played.
   *
   * So the shortcuts are gone and the whole games shelf is printed underneath
   * instead, Random Game included - the same block the picker shows, from the
   * same function, so the locks and today's spent runs read identically on
   * both. One tap to anything, instead of two taps to a guess.
   *
   * The way out is one row of three. TRY QUIZ goes on the left, because it is
   * the only shelf the block below does not cover; then back to the song, then
   * back to wherever you came in from - which is named rather than assumed, so
   * it says Back burner when that is where you started.
   */
  function resultsActions(p) {
    var acts = el('div', 'results-actions');

    var row = el('div', 'act-row');

    var toQuiz = el('button', 'btn btn-gold', 'Try Quiz');
    toQuiz.title = 'The quiz shelf for this song';
    toQuiz.addEventListener('click', function () {
      go('quiz', { id: p.songId, kind: 'quiz' }, true);
    });
    row.appendChild(toQuiz);

    var toSong = el('button', 'btn btn-primary', 'Back to song');
    toSong.addEventListener('click', function () { go('detail', { id: p.songId }, true); });
    row.appendChild(toSong);

    var home = originTab();
    var toHome = el('button', 'btn btn-outline', ORIGIN_LABEL[home] || 'Back');
    toHome.addEventListener('click', function () { resetTo(home); });
    row.appendChild(toHome);
    acts.appendChild(row);

    /* The menu needs the song's own history - the stat panels beside every
       level are built out of it - so it arrives a beat after the rest of the
       screen. A placeholder holds its place rather than letting the page jump
       when it lands, and a failure leaves the three buttons above perfectly
       usable rather than an error where the menu should be. */
    var host = el('div', 'results-games');
    host.innerHTML = '<div class="loading">Loading the games...</div>';
    acts.appendChild(host);

    /**
     * THE MENU HAS TO BE DRAWN TWICE, AND THAT IS NOT A BUG - 1.50b.
     *
     * The run you have just finished is the one thing the menu cannot see. The
     * ladders and the tries counts are both derived from the attempt history,
     * and at the moment this screen is built the row is still in flight: the
     * write was dispatched a few milliseconds ago and the index that will carry
     * it has not been rebuilt. So the first paint shows the song as it was
     * BEFORE the run - a level you have just unlocked still locked, and a tries
     * count one short. Going back to the song and in again fixed it, which is
     * the tell that the data was fine and only this screen was early.
     *
     * Waiting for the write before drawing anything would be worse: a blank
     * band under the buttons for as long as Apps Script feels like taking, on
     * the screen you look at for four seconds. So it paints what is true now,
     * and paints again when the truth arrives.
     *
     * The song CACHE has to be dropped on the second pass. finishQuiz drops it
     * before dispatching the write, but the first paint here refetches
     * immediately and repopulates it with the pre-run history - so by the time
     * the row lands, the cache holds a stale copy that was fetched after the
     * drop and would be served straight back.
     */
    /* WHERE THE LADDERS STOOD BEFORE THIS RUN.
       Taken now, while S.songs is still the pre-write index - refreshIndex
       replaces those objects wholesale, so a reference kept into it would
       quietly become the AFTER state and every difference would vanish. This
       is a flat copy of the handful of facts that can move. */
    var wasIdx = songById(p.songId);
    var before = { games: {}, quizTier: quizTier(wasIdx), beginner: beginnerShut(wasIdx) };
    if (wasIdx) {
      for (var bm = 0; bm < S.modes.length; bm++) {
        if (S.modes[bm].kind !== 'game') continue;
        before.games[S.modes[bm].id] = {
          shut: gameShut(wasIdx, S.modes[bm].id),
          top: levelIdx(unlockedLevel(wasIdx, S.modes[bm].id))
        };
      }
    }

    /**
     * WHAT THIS RUN OPENED, as a set of things to mark.
     *
     * Keyed two ways on purpose: by mode id for a game that has just become
     * reachable along the chain, and by mode|level for a rung that has opened
     * inside a game you already had. They are different events - one is a new
     * door on the shelf, the other is a step up a ladder you were already on -
     * and the menu draws them differently.
     */
    function openedSince(idx) {
      var out = {};
      if (!idx || !wasIdx) return out;
      for (var i = 0; i < S.modes.length; i++) {
        var m = S.modes[i];
        if (m.kind !== 'game') continue;
        var was = before.games[m.id];
        if (!was) continue;
        var nowShut = gameShut(idx, m.id);
        if (was.shut && !nowShut) {
          out[m.id] = true;
          /* A game that has just opened is open AT EASY, and that rung is the
             point of it - so it is marked as well as the column. */
          out[m.id + '|easy'] = true;
          continue;
        }
        if (nowShut) continue;
        var top = levelIdx(unlockedLevel(idx, m.id));
        for (var lv = was.top + 1; lv <= top; lv++) out[m.id + '|' + LEVELS[lv]] = true;
      }
      return out;
    }

    function paintGames(fresh) {
      if (fresh) dropSong(p.songId);
      loadSong(p.songId).then(function (song) {
        // navigated away while the fetch was out: nothing to paint on
        if (!host.isConnected) return;
        var idx = songById(p.songId);
        if (!idx) { host.remove(); return; }
        var opened = fresh ? openedSince(idx) : {};
        var n = 0;
        for (var k in opened) if (opened.hasOwnProperty(k) && k.indexOf('|') < 0) n++;
        host.innerHTML = '';

        /* THE HEADLINE, above the menu, when the run opened anything at all.
           A tag on a button four hundred pixels down the page is a thing you
           find, not a thing you are told - and being told is the whole point:
           the run you just played bought you something. */
        var quizJustOpened = before.beginner && !beginnerShut(idx);
        var rungs = 0;
        for (var k2 in opened) if (opened.hasOwnProperty(k2) && k2.indexOf('|') > 0) rungs++;
        if (fresh && (rungs || quizJustOpened)) {
          var bits = [];
          if (n) {
            bits.push(n === 1 ? 'a new game' : n + ' new games');
          }
          var steps = rungs - n;      // the easy rungs that came with a new game
          if (steps > 0) bits.push(steps === 1 ? 'a new level' : steps + ' new levels');
          if (quizJustOpened) bits.push('the quizzes');
          host.appendChild(el('div', 'unlock-banner',
            '<span class="unlock-spark">&#10022;</span>' +
            '<span>That run opened <strong>' + esc(bits.join(' and ')) +
            '</strong>' + (quizJustOpened
              ? ' - every game passed on Easy, so the quiz shelf is open on this song.'
              : '.') + '</span>'));
        }

        host.appendChild(el('p', 'section-eyebrow', 'Another game'));
        host.appendChild(gamesMenu(song, idx, opened));
      }, function () { if (!fresh) host.remove(); });
    }

    paintGames(false);
    /* A practice run writes nothing, so nothing will ever land and the first
       paint is already the truth. Registering anyway would leave an entry
       waiting for a write that is not coming, to be fired by somebody else's
       later on. */
    if (!p.practice) {
      onSaveLanded(function () { return host.isConnected; },
                   function () { paintGames(true); });
    }

    return acts;
  }

  function caption(a) {
    if (a >= 95) return 'Note perfect';
    if (a >= 80) return 'Stage ready';
    if (a >= 60) return 'Getting there';
    if (a >= 35) return 'Needs more reps';
    return 'Back to the lyric sheet';
  }

  function meterSvg(accuracy) {
    var cx = 110, cy = 100, r = 86;
    var angle = -90 + (accuracy / 100) * 180;
    var rad = (angle - 90) * Math.PI / 180;
    var nx = cx + r * 0.78 * Math.cos(rad);
    var ny = cy + r * 0.78 * Math.sin(rad);
    var color = accuracy >= 80 ? '#3C7A4F' : accuracy >= 50 ? '#C79A3E' : '#B34A3C';
    return '<svg viewBox="0 0 220 120" width="220" height="120">' +
      '<path d="M 24 100 A 86 86 0 0 1 196 100" fill="none" stroke="#E3DDCC" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M 24 100 A 86 86 0 0 1 196 100" fill="none" stroke="' + color + '" stroke-width="10" ' +
      'stroke-linecap="round" stroke-dasharray="' + ((accuracy / 100) * 270) + ' 270"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) +
      '" stroke="#1F2A24" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#C79A3E"/></svg>';
  }

  /* ============================================================
     Add / Edit
     ============================================================ */
  VIEWS.add = function () { songForm(null); };
  VIEWS.edit = function (p) {
    loadSong(p.id).then(function (song) { appEl.innerHTML = ''; songForm(song); })
      .catch(function (e) { appEl.innerHTML = '<div class="empty-state">' + esc(e.message) + '</div>'; });
  };

  function keyOptions(cur) {
    cur = cur || '';
    function opts(list) {
      var h = '';
      for (var i = 0; i < list.length; i++) {
        h += '<option value="' + esc(list[i]) + '"' + (list[i] === cur ? ' selected' : '') +
             '>' + keyText(list[i]) + '</option>';
      }
      return h;
    }
    var known = KEY_PLAY_MAJOR.indexOf(cur) !== -1 || KEY_PLAY_MINOR.indexOf(cur) !== -1;
    return '<option value=""' + (cur ? '' : ' selected') + '>&ndash;</option>' +
      (cur && !known ? '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' : '') +
      '<optgroup label="Major">' + opts(KEY_PLAY_MAJOR) + '</optgroup>' +
      '<optgroup label="Minor">' + opts(KEY_PLAY_MINOR) + '</optgroup>';
  }
  function capoOptions(cur) {
    cur = Number(cur) || 0;
    var h = '';
    for (var c = 0; c < ROMAN.length; c++) {
      h += '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' +
           (c ? ROMAN[c] : 'No capo') + '</option>';
    }
    return h;
  }

  function songForm(song) {
    var isEdit = !!song;
    var wrap = el('div');
    wrap.innerHTML =
      '<p class="section-eyebrow">' + (isEdit ? 'Editing' : 'New entry') + '</p>' +
      '<h2 class="section-title">' + (isEdit ? 'Edit Song' : 'Add a Song') + '</h2>' +
      '<div class="form-group"><label class="form-label">Title</label>' +
      '<input class="form-input" id="fTitle" value="' + (isEdit ? esc(song.title) : '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Artist</label>' +
      '<input class="form-input" id="fArtist" value="' + (isEdit ? esc(song.artist || '') : '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Playing key</label>' +
          '<select class="form-input" id="fPlayKey">' + keyOptions(isEdit ? song.playKey : '') +
          '</select></div>' +
        '<div class="form-group"><label class="form-label">Capo</label>' +
          '<select class="form-input" id="fCapo">' + capoOptions(isEdit ? song.capo : 0) +
          '</select></div>' +
        '<div class="form-group"><label class="form-label">Sounding key</label>' +
          '<div class="form-input key-sound" id="fSound"></div></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">YouTube</label>' +
        '<div class="input-with-btn">' +
        '<input class="form-input" id="fYoutube" value="' + (isEdit ? esc(song.youtube || '') : '') + '">' +
        '<button type="button" class="find-btn" id="ytFind" title="Search YouTube">Find</button>' +
        '</div></div>' +
        '<div class="form-group"><label class="form-label">Spotify</label>' +
        '<div class="input-with-btn">' +
        '<input class="form-input" id="fSpotify" value="' + (isEdit ? esc(song.spotify || '') : '') + '">' +
        '<button type="button" class="find-btn" id="spFind" title="Search Spotify">Find</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Lists</label><div id="listBoxes"></div></div>' +
        '<div class="form-group"><label class="form-label">Find the words</label>' +
          '<button class="btn btn-outline btn-sm btn-block" id="findLyrics" type="button">' +
          'Search for lyrics</button>' +
          '<p class="form-hint mt-0">Looks up the title and artist above. ' +
          'You get a preview before anything lands in the form.</p>' +
          '<div id="findNote"></div></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Lyrics</label>' +
      '<div id="sections"></div>' +
      '<div style="display:flex; gap:10px; margin-top:8px">' +
        '<button class="btn btn-outline btn-sm" id="addVerse" type="button">+ Verse</button>' +
        '<button class="btn btn-outline btn-sm" id="addChorus" type="button">+ Chorus</button>' +
      '</div></div>' +
      '<div class="detail-actions"><button class="btn btn-primary btn-block" id="saveBtn">' +
      (isEdit ? 'Save changes' : 'Add song') + '</button></div>' +
      (isEdit
        ? '<button class="btn btn-outline btn-block" id="clearDataBtn">Clear song data</button>' +
          '<p class="form-hint mt-0">Wipes the runs and the score for this song. ' +
          'The words stay.</p>' +
          '<button class="btn btn-danger btn-block" id="deleteBtn">Delete song</button>'
        : '');
    appEl.appendChild(wrap);

    var keySel = wrap.querySelector('#fPlayKey'), capoSel = wrap.querySelector('#fCapo');
    function paintSound() {
      wrap.querySelector('#fSound').innerHTML = keySel.value
        ? keyText(soundingKey(keySel.value, capoSel.value)) : '&ndash;';
    }
    keySel.addEventListener('change', paintSound);
    capoSel.addEventListener('change', paintSound);
    paintSound();

    var boxes = wrap.querySelector('#listBoxes');
    var checked = isEdit ? (songById(song.id) ? songById(song.id).listIds || [] : []) : [];
    for (var i = 0; i < S.lists.length; i++) {
      var l = S.lists[i];
      var row = el('label', 'checkbox-row');
      row.innerHTML = '<input type="checkbox" value="' + esc(l.id) + '"' +
        (checked.indexOf(l.id) !== -1 ? ' checked' : '') + '><span>' + esc(l.name) + '</span>';
      boxes.appendChild(row);
    }

    var host = wrap.querySelector('#sections');

    /* A REPEAT is a pointer, not a copy. When a verse or a chorus comes back
       round you say so once; the words live in one place and stay in step if
       you edit them. It saves as the same centred marker the songbook already
       uses, so a repeat here and a repeat in the book are the same thing.

       Until now the editor dropped markers on load and never wrote them back,
       so editing any imported song with a "Chorus" marker quietly deleted it. */
    var uidSeq = 0;
    function nextUid() { uidSeq++; return 'u' + uidSeq; }

    function realBlocks() {
      var out = [];
      for (var i = 0; i < host.children.length; i++) {
        if (host.children[i].getAttribute('data-type') !== 'repeat') out.push(host.children[i]);
      }
      return out;
    }

    /* Renumber after every move, add or delete, so the labels always match
       what the song will actually look like. Repeats take no number of their
       own - they follow whatever they point at. */
    function relabel() {
      var blocks = host.children;
      var real = realBlocks();
      var vTotal = 0, cTotal = 0, i;
      for (i = 0; i < real.length; i++) {
        if (real[i].getAttribute('data-type') === 'chorus') cTotal++; else vTotal++;
      }
      var v = 0, c = 0, labelOf = {}, peekOf = {};
      for (i = 0; i < real.length; i++) {
        var rb = real[i];
        var isChorus = rb.getAttribute('data-type') === 'chorus';
        var name;
        if (isChorus) { c++; name = cTotal > 1 ? 'Chorus ' + c : 'Chorus'; }
        else { v++; name = vTotal > 1 ? 'Verse ' + v : 'Verse'; }
        rb.querySelector('.sec-label').textContent = name;
        rb.className = 'form-group sec-block' + (isChorus ? ' sec-chorus' : '');
        labelOf[rb.getAttribute('data-uid')] = name;
        peekOf[rb.getAttribute('data-uid')] =
          ((rb.querySelector('textarea').value || '').split(NL)[0] || '').slice(0, 60);
      }
      for (i = 0; i < blocks.length; i++) {
        var blk = blocks[i];
        if (blk.getAttribute('data-type') === 'repeat') {
          var uid = blk.getAttribute('data-ref-uid');
          var bound = uid && labelOf[uid];
          var text = bound ? labelOf[uid] : (blk.getAttribute('data-ref-text') || 'Chorus');
          blk.setAttribute('data-ref-text', text);
          blk.querySelector('.repeat-name').textContent = text;
          var peek = blk.querySelector('.repeat-peek');
          if (bound) {
            peek.className = 'repeat-peek';
            peek.textContent = peekOf[uid] || '(that section is empty)';
          } else {
            // the block it pointed at was deleted, or it never had one
            peek.className = 'repeat-peek repeat-orphan';
            peek.textContent = 'nothing here is called that - it will still be ' +
              'written as a marker';
          }
        }
        blk.querySelector('.mv-up').disabled = (i === 0);
        blk.querySelector('.mv-down').disabled = (i === blocks.length - 1);
      }
    }

    function wireMoves(b) {
      b.querySelector('.rm').addEventListener('click', function () { b.remove(); relabel(); });
      b.querySelector('.mv-up').addEventListener('click', function () {
        var prev = b.previousElementSibling;
        if (prev) host.insertBefore(b, prev);
        relabel();
      });
      b.querySelector('.mv-down').addEventListener('click', function () {
        var next = b.nextElementSibling;
        if (next) host.insertBefore(next, b);
        relabel();
      });
    }

    function addRepeat(refUid, refText) {
      var b = el('div', 'form-group sec-block sec-repeat');
      b.setAttribute('data-type', 'repeat');
      b.setAttribute('data-ref-uid', refUid || '');
      b.setAttribute('data-ref-text', refText || 'Chorus');
      b.innerHTML =
        '<div class="sec-head">' +
        '<span class="repeat-of">&#8635; <span class="repeat-name"></span> again</span>' +
        '<div class="sec-tools">' +
        '<button type="button" class="reorder-btn mv-up" title="Move up">&#9650;</button>' +
        '<button type="button" class="reorder-btn mv-down" title="Move down">&#9660;</button>' +
        '<button type="button" class="text-link-btn text-link-danger rm">Remove</button>' +
        '</div></div>' +
        '<div class="repeat-peek"></div>';
      wireMoves(b);
      host.appendChild(b);
      relabel();
      return b;
    }

    function addSection(type, text) {
      var b = el('div', 'form-group sec-block');
      b.setAttribute('data-type', type);
      b.setAttribute('data-uid', nextUid());
      b.innerHTML =
        '<div class="sec-head">' +
        '<span class="form-label mt-0 sec-label" style="margin:0"></span>' +
        '<div class="sec-tools">' +
        '<button type="button" class="reorder-btn mv-up" title="Move up">&#9650;</button>' +
        '<button type="button" class="reorder-btn mv-down" title="Move down">&#9660;</button>' +
        '<button type="button" class="text-link-btn rep">Repeat</button>' +
        '<button type="button" class="text-link-btn flip">Make chorus</button>' +
        '<button type="button" class="text-link-btn text-link-danger rm">Remove</button>' +
        '</div></div>' +
        '<textarea class="form-textarea"></textarea>';
      b.querySelector('textarea').value = text || '';
      b.querySelector('textarea').addEventListener('change', relabel);   // refresh the peeks

      wireMoves(b);

      b.querySelector('.rep').addEventListener('click', function () {
        addRepeat(b.getAttribute('data-uid'), null);
        toast('Repeat added at the end - move it where it belongs');
      });

      var flip = b.querySelector('.flip');
      function paintFlip() {
        flip.textContent = b.getAttribute('data-type') === 'chorus' ? 'Make verse' : 'Make chorus';
      }
      paintFlip();
      flip.addEventListener('click', function () {
        b.setAttribute('data-type',
          b.getAttribute('data-type') === 'chorus' ? 'verse' : 'chorus');
        paintFlip();
        relabel();
      });

      host.appendChild(b);
      relabel();
    }

    /* A marker out of the book is just the word "Chorus". If exactly one block
       carries that label, tie the two together so renumbering keeps them in
       step. If it is ambiguous, or says something like "Solo" that is not a
       section at all, leave it as literal text - which is what the book says
       anyway, and it round-trips unchanged. */
    function bindRepeats() {
      var real = realBlocks(), byLabel = {};
      for (var i = 0; i < real.length; i++) {
        var lab = real[i].querySelector('.sec-label').textContent.toLowerCase();
        byLabel[lab] = byLabel[lab] === undefined ? real[i].getAttribute('data-uid') : null;
      }
      for (var j = 0; j < host.children.length; j++) {
        var blk = host.children[j];
        if (blk.getAttribute('data-type') !== 'repeat') continue;
        if (blk.getAttribute('data-ref-uid')) continue;
        var want = String(blk.getAttribute('data-ref-text') || '').toLowerCase();
        if (byLabel[want]) blk.setAttribute('data-ref-uid', byLabel[want]);
      }
      relabel();
    }

    if (isEdit) {
      for (var s = 0; s < song.sections.length; s++) {
        var sec = song.sections[s];
        if (sec.type === 'marker') { addRepeat(null, sec.ref || 'Chorus'); continue; }
        var lines = [];
        for (var j = 0; j < sec.lines.length; j++) if (sec.lines[j].t) lines.push(sec.lines[j].t);
        addSection(sec.type, lines.join(NL));
      }
      bindRepeats();
    } else {
      addSection('verse', '');
    }
    wrap.querySelector('#addVerse').addEventListener('click', function () { addSection('verse', ''); });
    wrap.querySelector('#addChorus').addEventListener('click', function () { addSection('chorus', ''); });

    /* ---- open the service with the search already run, so the link is a
            copy away. Neither will hand a URL back to a page it does not own,
            so this goes as far as it can: straight to the results. ---- */
    function serviceSearch(kind) {
      var t = wrap.querySelector('#fTitle').value.trim();
      var a = wrap.querySelector('#fArtist').value.trim();
      if (!t) { toast('Type a title first'); return; }
      var q = encodeURIComponent(t + (a ? ' ' + a : ''));
      var url = kind === 'yt'
        ? 'https://www.youtube.com/results?search_query=' + q
        : 'https://open.spotify.com/search/' + q;
      window.open(url, '_blank', 'noopener');
    }
    wrap.querySelector('#ytFind').addEventListener('click', function () { serviceSearch('yt'); });
    wrap.querySelector('#spFind').addEventListener('click', function () { serviceSearch('sp'); });

    /* ---- look the words up rather than typing them ---- */
    var findBtn = wrap.querySelector('#findLyrics');
    var findNote = wrap.querySelector('#findNote');

    function fillFrom(sections) {
      var hasText = false;
      for (var b = 0; b < host.children.length; b++) {
        var ta = host.children[b].querySelector('textarea');
        if (ta && ta.value.trim()) hasText = true;
      }
      if (hasText && !confirm('Replace the lyrics already in this form?')) return;
      host.innerHTML = '';
      for (var i = 0; i < sections.length; i++) {
        var ls = [];
        for (var j = 0; j < sections[i].lines.length; j++) ls.push(sections[i].lines[j].t);
        addSection(sections[i].type, ls.join(NL));
      }
      toast('Dropped in ' + sections.length + ' section' + (sections.length === 1 ? '' : 's'));
    }

    findBtn.addEventListener('click', function () {
      var t = wrap.querySelector('#fTitle').value.trim();
      var ar = wrap.querySelector('#fArtist').value.trim();
      if (!t) { toast('Type a title first'); return; }
      findBtn.disabled = true;
      findBtn.textContent = 'Searching...';
      findNote.innerHTML = '';
      api('fetchLyrics', { title: t, artist: ar }).then(function (r) {
        findBtn.disabled = false;
        findBtn.textContent = 'Search for lyrics';
        openLyricPreview(r, fillFrom);
      }).catch(function (e) {
        findBtn.disabled = false;
        findBtn.textContent = 'Search for lyrics';
        findNote.innerHTML = '<p class="form-hint" style="color:var(--incorrect)">' +
          esc(e.message) + '</p>';
      });
    });

    wrap.querySelector('#saveBtn').addEventListener('click', function () {
      var title = wrap.querySelector('#fTitle').value.trim();
      if (!title) { toast('Give it a title first'); return; }
      var sections = [];
      var blocks = host.children;
      var realCount = 0;
      for (var i = 0; i < blocks.length; i++) {
        var type = blocks[i].getAttribute('data-type');
        if (type === 'repeat') {
          sections.push({
            type: 'marker',
            ref: blocks[i].getAttribute('data-ref-text') || 'Chorus',
            lines: []
          });
          continue;
        }
        var raw = blocks[i].querySelector('textarea').value;
        var ls = raw.split(NL), lines = [];
        for (var j = 0; j < ls.length; j++) {
          var t = ls[j].trim();
          if (t) lines.push({ c: null, t: t });
        }
        if (lines.length) { sections.push({ type: type, lines: lines }); realCount++; }
      }
      // a song of nothing but repeats has no words in it
      if (!realCount) { toast('Add at least one verse'); return; }
      var ids = [];
      var cbs = boxes.querySelectorAll('input');
      for (var k = 0; k < cbs.length; k++) if (cbs[k].checked) ids.push(cbs[k].value);

      var payload = {
        id: isEdit ? song.id : null,
        title: title,
        artist: wrap.querySelector('#fArtist').value.trim(),
        youtube: wrap.querySelector('#fYoutube').value.trim(),
        spotify: wrap.querySelector('#fSpotify').value.trim(),
        meta: isEdit ? song.meta : [],
        playKey: keySel.value,
        capo: Number(capoSel.value) || 0,
        sections: sections,
        listIds: ids,
        needsChorusTag: false
      };
      var btn = wrap.querySelector('#saveBtn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      api('saveSong', { song: payload }).then(function (res) {
        dropSong(res.id);
        // Patch the index in place and go straight there. Waiting on a second
        // round trip for a full refresh was doubling the time to save.
        var entry = songById(res.id);
        if (entry) {
          entry.title = payload.title;
          entry.artist = payload.artist;
          entry.listIds = ids;
          entry.sectionCount = realCount;      // playable ones, not the repeats
          entry.playKey = payload.playKey;
          entry.capo = payload.capo;
        } else {
          S.songs.push({
            id: res.id, title: payload.title, artist: payload.artist,
            listIds: ids, sectionCount: realCount, needsChorusTag: false,
            playKey: payload.playKey, capo: payload.capo,
            createdAt: Date.now(), sortIndex: Date.now(), source: 'manual',
            headingId: '', attempts: 0, lastAccuracy: null, lastDate: 0,
            bestAccuracy: 0, lastMode: null, modes: {}, modeAcc: {}, avgAccuracy: null,
            hot: null, hotDays: null, coldRate: null,
            score: null, daysSince: null, daysLeft: null, totalEarned: 0, lastPoints: 0
          });
        }
        toast(isEdit ? 'Song updated' : 'Song added');
        // back to the song you were working on, not the top of the library
        resetTo('detail', { id: res.id });
        refreshIndex().catch(function () {});      // catch up quietly behind you
      }).catch(function (e) {
        btn.disabled = false;
        btn.textContent = isEdit ? 'Save changes' : 'Add song';
        toast(e.message);
      });
    });

    /* ---- clearing one song's history ----
       Games and quizzes go separately because they mean different things. A
       pile of easy game runs is noise you may want gone without losing the
       record of the Blind quizzes that actually cost you something - and the
       whole-library button in Settings is far too blunt for that. */
    var clearDataBtn = wrap.querySelector('#clearDataBtn');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', function () {
        var hist = song.history || [];
        var nGame = 0, nQuiz = 0;
        for (var h = 0; h < hist.length; h++) {
          if (isGame(hist[h].mode)) nGame++; else nQuiz++;
        }
        if (!hist.length) { toast('This song has no runs on record'); return; }

        var back = el('div', 'sheet-backdrop');
        var sheet = el('div', 'sheet');
        sheet.appendChild(el('div', 'card-title', 'Clear data for ' + esc(song.title)));
        sheet.appendChild(el('p', 'form-hint mt-0',
          'The score is worked out from the runs, so clearing them takes the ' +
          'points with them. There is no undo.'));

        var picks = [
          ['quiz', 'Quiz data', nQuiz + ' typed run' + (nQuiz === 1 ? '' : 's')],
          ['game', 'Game data', nGame + ' game' + (nGame === 1 ? '' : 's')],
          ['both', 'Both', 'all ' + hist.length + ' run' + (hist.length === 1 ? '' : 's') +
                   ', back to never quizzed']
        ];
        for (var i = 0; i < picks.length; i++) {
          (function (pk) {
            var b = el('button', 'mode-card');
            b.type = 'button';
            b.innerHTML = '<div class="mode-body"><div class="mode-name">' + esc(pk[1]) +
              '</div><div class="mode-blurb">' + esc(pk[2]) + '</div></div>';
            if ((pk[0] === 'quiz' && !nQuiz) || (pk[0] === 'game' && !nGame)) {
              b.className = 'mode-card disabled';
              b.disabled = true;
            }
            b.addEventListener('click', function () {
              if (!confirm('Clear ' + pk[1].toLowerCase() + ' for "' + song.title + '"?')) return;
              back.remove();
              api('clearSongData', { id: song.id, kind: pk[0] }).then(function (r) {
                dropSong(song.id);
                return refreshIndex().then(function () { return r; });
              }).then(function (r) {
                toast('Cleared ' + r.removed + ' run' + (r.removed === 1 ? '' : 's'));
                resetTo('detail', { id: song.id });
              }).catch(function (e) { toast(e.message); });
            });
            sheet.appendChild(b);
          })(picks[i]);
        }
        var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'Cancel');
        cancel.addEventListener('click', function () { back.remove(); });
        sheet.appendChild(cancel);
        back.appendChild(sheet);
        back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
        document.body.appendChild(back);
      });
    }

    var delBtn = wrap.querySelector('#deleteBtn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if (!confirm('Delete "' + song.title + '" and its quiz history?')) return;
        api('deleteSong', { id: song.id }).then(function () {
          dropSong(song.id);
          return refreshIndex();
        }).then(function () { toast('Song deleted'); resetTo('library'); })
          .catch(function (e) { toast(e.message); });
      });
    }
  }

  /**
   * Nothing goes into the form unseen. What came back might be a different
   * song with the same name, and the verse/chorus split is a guess either
   * way - so the preview says where it came from and how it was decided, and
   * you get to say no.
   */
  function openLyricPreview(res, onUse) {
    var back = el('div', 'sheet-backdrop');
    var sheet = el('div', 'sheet');

    sheet.appendChild(el('div', 'card-title', 'Found: ' + esc(res.matchedTitle || '')));

    var bits = [esc(res.matchedArtist || 'unknown artist'), 'via ' + esc(res.source)];
    bits.push(res.tagged ? 'sections were labelled at the source'
                         : 'verse/chorus guessed from what repeats');
    if (res.collapsed) {
      bits.push(res.collapsed + ' repeated block' + (res.collapsed === 1 ? '' : 's') +
                ' folded into one, the way the songbook writes a chorus');
    }
    sheet.appendChild(el('p', 'form-hint mt-0', bits.join('  &middot;  ')));

    var body = el('div', 'lyric-preview');
    for (var i = 0; i < res.sections.length; i++) {
      var sec = res.sections[i];
      var blk = el('div', 'preview-block' + (sec.type === 'chorus' ? ' preview-chorus' : ''));
      var txt = [];
      for (var j = 0; j < sec.lines.length; j++) txt.push(esc(sec.lines[j].t));
      blk.innerHTML =
        '<div class="preview-label">' + (sec.type === 'chorus' ? 'Chorus' : 'Verse') + '</div>' +
        '<div class="preview-lines">' + txt.join('<br>') + '</div>';
      body.appendChild(blk);
    }
    sheet.appendChild(body);

    var use = el('button', 'btn btn-primary btn-block', 'Use these lyrics');
    use.addEventListener('click', function () { back.remove(); onUse(res.sections); });
    sheet.appendChild(use);

    var cancel = el('button', 'btn btn-outline btn-sm btn-block', 'No, leave it');
    cancel.style.marginTop = '8px';
    cancel.addEventListener('click', function () { back.remove(); });
    sheet.appendChild(cancel);

    back.appendChild(sheet);
    back.addEventListener('click', function (ev) { if (ev.target === back) back.remove(); });
    document.body.appendChild(back);
  }

  /* ============================================================
     Insights
     ============================================================ */
  VIEWS.insights = function () {
    var wrap = el('div');
    wrap.appendChild(el('p', 'section-eyebrow', 'Your progress'));
    wrap.appendChild(el('h2', 'section-title', 'Insights'));

    var quizzed = [], totalAttempts = 0, pointsNow = 0, everEarned = 0;
    var quizCount = 0, gameCount = 0;
    var modeCount = {};
    var dueSoon = [], spent = [], byArtist = {};
    for (var i = 0; i < S.songs.length; i++) {
      var s = S.songs[i];
      var a = String(s.artist || 'Unknown');
      if (!byArtist[a]) byArtist[a] = { n: 0, pts: 0, quizzed: 0 };
      byArtist[a].n++;
      byArtist[a].pts += (s.score || 0);
      if (!s.attempts) continue;
      byArtist[a].quizzed++;
      quizzed.push(s);
      totalAttempts += s.attempts;
      pointsNow += (s.score || 0);
      everEarned += (s.totalEarned || 0);
      for (var mk in (s.modes || {})) {
        if (!s.modes.hasOwnProperty(mk)) continue;
        modeCount[mk] = (modeCount[mk] || 0) + s.modes[mk];
        if (isGame(mk)) gameCount += s.modes[mk]; else quizCount += s.modes[mk];
      }
      // "runs out inside a week" stopped discriminating once the decay
      // started compounding - a flawless Blind run only lasts twelve days, so
      // nearly everything with points qualified. What matters now is whether
      // the song is actually bleeding tonight, and how hard.
      if ((s.score || 0) === 0) spent.push(s);
      else if (!s.hot) dueSoon.push(s);
    }

    if (!quizzed.length) {
      wrap.innerHTML += '<div class="empty-state"><span class="eyebrow-mark">No quizzes yet</span>' +
        'Take a quiz and your stats will show up here.</div>';
      appEl.appendChild(wrap);
      buildFooter();
      return;
    }

    /* ---- what you have earned lately ----
       Everything on this shelf answers to one window, chosen once at the top.
       Points banked is a fact about a stretch of time, and a figure with no
       stretch attached ("847 points") tells you nothing about whether you are
       keeping up. */
    var WINDOWS = [[1, 'Today'], [3, 'Last 3 days'], [7, 'Last 7 days'],
                   [15, 'Last 15 days'], [30, 'Last 30 days'], [90, 'Last 90 days'],
                   [365, 'Last year'], [0, 'All time']];

    /**
     * Points banked inside the window, and the span it actually covers.
     *
     * The span is not always the window. "All time" spans from your first
     * attempt to today, and a window longer than you have been playing is
     * clipped to that too - otherwise a fortnight-old library asked for its
     * yearly rate would divide by 365 and report roughly nothing.
     */
    function earnedWithin(days) {
      var got = S.earned || {};
      var lived = S.firstAttempt
        ? Math.max(1, Math.round((Date.now() - S.firstAttempt) / 86400000) + 1) : 1;
      if (!days) return { points: got.all || 0, days: lived };
      return { points: got[days] || 0, days: Math.min(days, lived) };
    }

    var winSel = el('select', 'set-select');
    var wOpts = '';
    for (var wi = 0; wi < WINDOWS.length; wi++) {
      wOpts += '<option value="' + WINDOWS[wi][0] + '"' +
        (S.insightWindow === WINDOWS[wi][0] ? ' selected' : '') + '>' +
        esc(WINDOWS[wi][1]) + '</option>';
    }
    winSel.innerHTML = wOpts;
    winSel.value = String(S.insightWindow);
    if (winSel.selectedIndex < 0) winSel.value = '30';
    wrap.appendChild(winSel);

    var grid = el('div', 'stat-grid');
    wrap.appendChild(grid);

    // Summing one-decimal floats drifts (129.70000000002), so round at the edge.
    var quizzedSongs = quizzed.length || 1;
    function paintGrid() {
      var w = earnedWithin(Number(winSel.value) || 0);
      var perDay = w.points / w.days;
      grid.innerHTML =
        '<div class="stat-card"><div class="stat-value">' + perDay.toFixed(1) +
          '</div><div class="stat-label">Points per day</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Math.round(w.points) +
          '</div><div class="stat-label">Points banked</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Math.round(pointsNow) +
          '</div><div class="stat-label">On the board now</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Math.round(everEarned) +
          '</div><div class="stat-label">Earned all time</div></div>' +
        '<div class="stat-card"><div class="stat-value">' +
          (quizCount / quizzedSongs).toFixed(1) +
          '</div><div class="stat-label">Quizzes per song</div></div>' +
        '<div class="stat-card"><div class="stat-value">' +
          (gameCount / quizzedSongs).toFixed(1) +
          '</div><div class="stat-label">Games per song</div></div>';
    }
    winSel.addEventListener('change', function () {
      S.insightWindow = Number(winSel.value) || 0;
      lsSet('insightWindow', S.insightWindow);
      paintGrid();
    });
    paintGrid();

    /* ---- the state of the repertoire, in five honest buckets ---- */
    /* STEAMING SPLIT OFF FROM HOT IN 1.50. One bucket for everything with the
       flame lit lumped a song resting until Thursday together with one resting
       until a fortnight on Friday, and those are not the same standing at all -
       the second is a song you have genuinely banked, and the medals exist to
       produce more of them. Seven days is the line because that is a week: a
       song you do not have to think about between one sitting and the next. */
    var STEAM_DAYS = 7;
    var bSteam = 0, bHot = 0, bWarm = 0, bSpent = 0, bNew = 0;
    var steaming = [];
    for (var q3 = 0; q3 < S.songs.length; q3++) {
      var sg = S.songs[q3];
      if (!sg.attempts) { bNew++; continue; }
      if ((sg.score || 0) === 0) { bSpent++; continue; }
      if (!sg.hot) { bWarm++; continue; }
      if ((sg.hotDays || 0) >= STEAM_DAYS) { bSteam++; steaming.push(sg); }
      else bHot++;
    }
    var totalSongs = Math.max(1, S.songs.length);
    var cov = el('div', 'card-block');
    var covHead = el('div', 'flex-between');
    covHead.appendChild(el('div', 'card-title', 'State of the repertoire'));
    covHead.appendChild(infoDot(
      'Steaming = hot with a week or more still on the flame, so you can leave ' +
      'it alone and it will still be resting when you come back. Hot = the ' +
      'flame is lit but there are fewer than ' + STEAM_DAYS + ' days on it. ' +
      'Cold = gone cold but still has points on the board, and is losing some ' +
      'of them every night, more each night it stays there. Frozen = worn all ' +
      'the way to zero; it owes nothing, so one run restarts it. Never opened ' +
      '= no attempt on record.'));
    cov.appendChild(covHead);
    var covBar = el('div', 'level-mix');
    var buckets = [['steam', bSteam], ['hot', bHot], ['warm', bWarm],
                   ['spent', bSpent], ['new', bNew]];
    var covHtml = '';
    for (var c3 = 0; c3 < buckets.length; c3++) {
      if (buckets[c3][1] <= 0) continue;
      covHtml += '<div class="mix-seg bucket-' + buckets[c3][0] + '" style="width:' +
        ((buckets[c3][1] / totalSongs) * 100) + '%"></div>';
    }
    covBar.innerHTML = covHtml;
    cov.appendChild(covBar);
    var covRows = [['Steaming', bSteam, 'steam'], ['Hot', bHot, 'hot'],
                   ['Cold', bWarm, 'warm'], ['Frozen', bSpent, 'spent'],
                   ['Never opened', bNew, 'new']];
    for (var r4 = 0; r4 < covRows.length; r4++) {
      var cr = el('div', 'legend-row');
      cr.innerHTML = '<span class="legend-dot bucket-' + covRows[r4][2] + '"></span>' +
        '<span class="legend-name">' + covRows[r4][0] + '</span>' +
        '<span class="legend-val">' + covRows[r4][1] + '</span>';
      cov.appendChild(cr);
    }
    /* The steaming songs are NAMED, not just counted. It is the one bucket
       that is an achievement rather than a warning, and it is short enough to
       print - most libraries have a handful, and a handful of titles is worth
       more than the number five. */
    if (steaming.length) {
      steaming.sort(function (a, b) { return (b.hotDays || 0) - (a.hotDays || 0); });
      cov.appendChild(el('div', 'card-subtitle',
        'Steaming - ' + STEAM_DAYS + '+ days on the flame'));
      for (var sm = 0; sm < steaming.length; sm++) {
        cov.appendChild(insightRow(steaming[sm], steaming[sm].hotDays + 'd'));
      }
    }
    wrap.appendChild(cov);

    /* ---- points banked per song, as a distribution ---- */
    var dist = el('div', 'card-block');
    var dh = el('div', 'flex-between');
    dh.appendChild(el('div', 'card-title', 'Where your points sit'));
    dh.appendChild(infoDot('Every song with points on the board, tallest first. ' +
      'A cold song loses more every night it stays cold, so this is a picture of ' +
      'recent work rather than of everything you have ever done.'));
    dist.appendChild(dh);
    var withPts = [];
    for (var w2 = 0; w2 < quizzed.length; w2++) if (quizzed[w2].score > 0) withPts.push(quizzed[w2]);
    withPts.sort(function (a, b) { return b.score - a.score; });
    if (!withPts.length) {
      dist.appendChild(el('p', 'form-hint mt-0', 'Everything has decayed to zero. Time to quiz something.'));
    } else {
      // How many bars. Twelve was a guess that stopped being right the moment
      // the library outgrew it, so it is a choice now, and it sticks.
      var nSel = el('select', 'set-select');
      var counts = [5, 10, 20, 50, 0];
      var nOpts = '';
      var shownOpts = 0;
      for (var c4 = 0; c4 < counts.length; c4++) {
        var v = counts[c4];
        // a "Top 50" sitting next to "All 30" is two names for one thing
        if (v && v >= withPts.length) continue;
        nOpts += '<option value="' + v + '"' + (S.pointsShown === v ? ' selected' : '') + '>' +
          (v ? 'Top ' + v : 'All ' + withPts.length) + '</option>';
        shownOpts++;
      }
      nSel.innerHTML = nOpts;
      // a remembered choice that no longer has an option means the library
      // shrank under it; fall back to showing everything rather than showing
      // a menu whose label disagrees with the chart
      nSel.value = String(S.pointsShown);
      if (nSel.selectedIndex < 0) { S.pointsShown = 0; nSel.value = '0'; }
      // one option is not a choice
      if (shownOpts < 2) nSel.style.display = 'none';
      var bars = el('div');
      function drawBars() {
        bars.innerHTML = '';
        var n = S.pointsShown;
        bars.appendChild(barChart(n ? withPts.slice(0, n) : withPts));
      }
      nSel.addEventListener('change', function () {
        S.pointsShown = Number(nSel.value);
        lsSet('pointsShown', S.pointsShown);
        drawBars();
      });
      dist.appendChild(nSel);
      dist.appendChild(bars);
      drawBars();
    }
    wrap.appendChild(dist);

    /* ---- how you quiz, across the whole ladder ---- */
    var totalLv = 0;
    for (var tk in modeCount) if (modeCount.hasOwnProperty(tk)) totalLv += modeCount[tk];
    if (totalLv) {
      var mix = el('div', 'card-block');
      mix.appendChild(el('div', 'card-title', 'How you quiz'));

      /* A pie, drawn as one circle with a dash pattern per slice. Every slice
         is a stroke on the same circle, offset by everything before it, which
         is far less arithmetic than building arc paths and cannot produce a
         sliver that fails to close. */
      var slices = [];
      for (var m = 0; m < S.modes.length; m++) {
        var cnt = modeCount[S.modes[m].id] || 0;
        if (cnt > 0) slices.push({ id: S.modes[m].id, cnt: cnt,
                                   name: S.modes[m].full || S.modes[m].label });
      }
      // retired modes still in your history deserve a slice too
      for (var rk in modeCount) {
        if (!modeCount.hasOwnProperty(rk) || !modeCount[rk]) continue;
        if (modeById(rk)) continue;
        slices.push({ id: rk, cnt: modeCount[rk], name: modeName(rk) });
      }
      slices.sort(function (a, b) { return b.cnt - a.cnt; });

      /* Names on the left, pie on the right, and the numbers live on the pie
         rather than in the key - hovering a slice is where you go when you
         actually want a figure, and printing every count twice made the key
         the widest thing on the page. */
      var R = 62, C = 2 * Math.PI * R, at = 0;
      var pieSvg = '<svg viewBox="0 0 172 172" width="172" height="172" class="pie-svg">';
      for (var p2 = 0; p2 < slices.length; p2++) {
        var frac = slices[p2].cnt / totalLv;
        var pct = Math.round(frac * 100);
        pieSvg += '<circle cx="86" cy="86" r="' + R + '" fill="none" stroke-width="42" ' +
          'class="mix-' + slices[p2].id + ' pie-slice" ' +
          'data-slice="' + p2 + '" ' +
          'stroke-dasharray="' + (frac * C).toFixed(2) + ' ' + C.toFixed(2) + '" ' +
          'stroke-dashoffset="' + (-at * C).toFixed(2) + '" ' +
          'transform="rotate(-90 86 86)">' +
          '<title>' + esc(slices[p2].name + ' - ' + slices[p2].cnt + ' run' +
            (slices[p2].cnt === 1 ? '' : 's') + ', ' + pct + '%') + '</title></circle>';
        at += frac;
      }
      pieSvg += '<circle cx="86" cy="86" r="41" fill="var(--paper-card)" ' +
        'pointer-events="none"/>' +
        '<text x="86" y="82" text-anchor="middle" class="pie-mid" ' +
        'pointer-events="none" id="pieMid">' + totalLv + '</text>' +
        '<text x="86" y="97" text-anchor="middle" class="pie-sub" ' +
        'pointer-events="none" id="pieSub">runs</text></svg>';

      var pw = el('div', 'pie-wrap');

      var legend = el('div', 'pie-legend');
      for (var m2 = 0; m2 < slices.length; m2++) {
        var lr = el('div', 'legend-row');
        lr.innerHTML = '<span class="legend-dot mix-' + slices[m2].id + '"></span>' +
          '<span class="legend-name">' + esc(slices[m2].name) + '</span>';
        legend.appendChild(lr);
      }
      pw.appendChild(legend);

      var pieBox = el('div', 'pie-box');
      pieBox.innerHTML = pieSvg;
      pw.appendChild(pieBox);
      mix.appendChild(pw);

      /* The hub doubles as the readout: hover a slice and it names it. The
         native <title> covers touch and keyboard, where there is no hover. */
      var mid = pieBox.querySelector('#pieMid'), sub = pieBox.querySelector('#pieSub');
      var arcs = pieBox.querySelectorAll('.pie-slice');
      for (var a2 = 0; a2 < arcs.length; a2++) {
        (function (arc, sl) {
          arc.addEventListener('mouseenter', function () {
            mid.textContent = sl.cnt;
            sub.textContent = Math.round((sl.cnt / totalLv) * 100) + '% ' + sl.name;
          });
          arc.addEventListener('mouseleave', function () {
            mid.textContent = totalLv;
            sub.textContent = 'runs';
          });
        })(arcs[a2], slices[a2]);
      }
      var topRuns = (modeCount.blind || 0) + (modeCount.hard || 0);
      mix.appendChild(el('p', 'form-hint',
        topRuns === 0
          ? 'You have never taken the top two rungs, which is where the points are.'
          : Math.round((topRuns / totalLv) * 100) + '% of your runs are Medium or Hard.'));
      wrap.appendChild(mix);
    }


    /* ---- one game or quiz at a time ---- */
    wrap.appendChild(modeStatsPanel());

    /* ---- pace, phone against PC ---- */
    if (S.timing && S.timing.length) {
      var ptbl = paceTable(S.timing, 0, 'perWord');
      if (ptbl) {
        var pc = el('div', 'card-block');
        var phd = el('div', 'flex-between');
        phd.appendChild(el('div', 'card-title', 'Pace, phone against PC'));
        phd.appendChild(infoDot(
          'Median seconds per graded word, across every song - dividing by ' +
          'length is the only way times from a two-verse song and a ' +
          'six-verse one can sit in the same column. The two devices are ' +
          'never mixed: pooling them would read as "you are slow at Blind" ' +
          'when all it means is that you do Blind on your phone.'));
        pc.appendChild(phd);
        pc.appendChild(ptbl);

        // one honest headline, only where both devices have something to say
        var pSum = 0, pN = 0, dSum = 0, dN = 0;
        for (var tt = 0; tt < S.timing.length; tt++) {
          var row = S.timing[tt];
          if (row.perWord === null) continue;
          if (row.device === 'phone') { pSum += row.perWord * row.n; pN += row.n; }
          else if (row.device === 'desktop') { dSum += row.perWord * row.n; dN += row.n; }
        }
        if (pN && dN) {
          var pAvg = pSum / pN, dAvg = dSum / dN;
          var slower = pAvg > dAvg;
          var ratio = slower ? pAvg / dAvg : dAvg / pAvg;
          pc.appendChild(el('p', 'form-hint',
            'Overall you are <strong>' + ratio.toFixed(2) + ' times</strong> ' +
            (slower ? 'slower on your phone than on your PC' : 'slower on your PC than on your phone') +
            ' - ' + pAvg.toFixed(2) + 's a word against ' + dAvg.toFixed(2) + '. ' +
            'That gap is exactly why the two are scored apart.'));
        }
        wrap.appendChild(pc);
      }
    }

    /* ---- what is bleeding hardest tonight ---- */
    if (dueSoon.length) {
      // worst rate first, and where two match, the one with more to lose
      dueSoon.sort(function (a, b) {
        return (b.coldRate || 0) - (a.coldRate || 0) || (b.score || 0) - (a.score || 0);
      });
      var due = el('div', 'card-block');
      var dh = el('div', 'flex-between');
      dh.appendChild(el('div', 'card-title', 'Bleeding fastest (' + dueSoon.length + ')'));
      dh.appendChild(infoDot(
        'Cold songs that still have points, worst first. The number is what ' +
        'each one loses tonight if you leave it - and that figure grows every ' +
        'night it stays cold. Quiz one and what you bank pays the rate off ' +
        'before it buys any rest days back, so these are the cheapest places ' +
        'to stop the bleeding.'));
      due.appendChild(dh);
      for (var d2 = 0; d2 < Math.min(8, dueSoon.length); d2++) {
        due.appendChild(insightRow(dueSoon[d2], '-' + rateText(dueSoon[d2].coldRate) + '/night'));
      }
      wrap.appendChild(due);
    }

    /* ---- gone cold ---- */
    if (spent.length) {
      spent.sort(function (a, b) { return b.daysSince - a.daysSince; });
      var cold = el('div', 'card-block');
      var ch = el('div', 'flex-between');
      ch.appendChild(el('div', 'card-title', 'Frozen (' + spent.length + ')'));
      ch.appendChild(infoDot('Worn all the way back to zero. They owe nothing, so ' +
        'one quiz on any of these starts it moving again from a standing start.'));
      cold.appendChild(ch);
      for (var c2 = 0; c2 < Math.min(8, spent.length); c2++) {
        cold.appendChild(insightRow(spent[c2], agoText(spent[c2].daysSince)));
      }
      wrap.appendChild(cold);
    }

    /* ---- artists ---- */
    var artistRows = [];
    for (var key in byArtist) {
      if (!byArtist.hasOwnProperty(key)) continue;
      // Only artists with points on the board. Padding the list out to ten with
      // rows of 0 told you nothing except that the list wanted to be ten long.
      if (byArtist[key].pts <= 0) continue;
      artistRows.push({
        name: key, n: byArtist[key].n, pts: byArtist[key].pts,
        q: byArtist[key].quizzed,
        avg: byArtist[key].pts / byArtist[key].n     // per song they have, not per song quizzed
      });
    }
    artistRows.sort(function (a, b) { return b.avg - a.avg || b.pts - a.pts; });
    if (artistRows.length) {
      var art = el('div', 'card-block');
      var artHead = el('div', 'flex-between');
      artHead.appendChild(el('div', 'card-title', 'By artist (' + artistRows.length + ')'));
      artHead.appendChild(infoDot(
        'Points banked on that artist divided by how many of their songs you ' +
        'have, so a writer with three songs is not flattered against one with ' +
        'thirty. Artists with nothing on the board are left out.'));
      art.appendChild(artHead);
      for (var r2 = 0; r2 < artistRows.length; r2++) {
        var ar = artistRows[r2];
        var arow = el('div', 'insight-song-row');
        arow.style.cursor = 'default';
        arow.innerHTML =
          '<div style="flex:1; min-width:0"><div class="insight-song-name">' + esc(ar.name) + '</div>' +
          '<div class="insight-song-sub">' + ar.n + ' song' + (ar.n === 1 ? '' : 's') +
          '  &middot;  ' + ar.q + ' quizzed  &middot;  ' + Math.round(ar.pts) + ' total</div></div>' +
          '<div class="trend-badge good">' + ar.avg.toFixed(1) + '</div>';
        art.appendChild(arow);
      }
      wrap.appendChild(art);
    }

    appEl.appendChild(wrap);
    buildFooter();
  };

  /**
   * GAMES AND QUIZZES, one at a time, across the whole library.
   *
   * Everything else on this screen is about songs. This is about the app: how
   * a level actually behaves once a few hundred runs have been through it.
   *
   * THE FIGURE IT EXISTS FOR IS TIME LEFT, as a share of the clock rather than
   * in seconds. Every game's limit is a rate times the length of the song it
   * is played on, so seconds from a nine-verse ballad and seconds from a
   * two-verse one are not the same quantity and averaging them says nothing.
   * The share is comparable everywhere, and it reads straight off as a verdict
   * on the dial: a level finishing with two thirds of its clock unspent is one
   * where the countdown is doing no work at all, and one finishing near zero -
   * or expiring outright on a fifth of its runs - is a level being decided by
   * how fast you can tap.
   *
   * Every row is drawn even where there is no history behind it, with an em
   * dash where a number would go. An untouched level is exactly the thing you
   * want to notice, and a panel that hid its empty rows would be a panel that
   * quietly stopped mentioning them.
   */
  function modeStatsPanel() {
    var box = el('div', 'card-block');
    var head = el('div', 'flex-between');
    head.appendChild(el('div', 'card-title', 'Games and quizzes'));
    head.appendChild(infoDot(
      'One game or quiz at a time, counted across every song. Time left is ' +
      'the share of the countdown still unspent when the board was graded, ' +
      'averaged - the game limits are rates times the length of the song, so ' +
      'raw seconds from two different songs cannot be compared and the share ' +
      'can. It is the number the timers are tuned from: high means the clock ' +
      'is not doing any work, near zero means the level is being decided by ' +
      'how fast you tap rather than by what you remember. Practice runs and ' +
      'forfeits are left out of all of it.'));
    box.appendChild(head);

    var rows = S.modeStats || [];
    /* Keyed lookup, because the dropdown is built from the mode list rather
       than from the data - a level nobody has ever played still has to appear,
       and it has no row to be listed from. */
    var byKey = {};
    for (var i = 0; i < rows.length; i++) {
      byKey[rows[i].mode + (rows[i].level ? '|' + rows[i].level : '')] = rows[i];
    }

    var picks = [];
    for (var m = 0; m < S.modes.length; m++) {
      var mo = S.modes[m];
      if (mo.kind === 'game') {
        for (var L = 0; L < LEVELS.length; L++) {
          picks.push({ key: mo.id + '|' + LEVELS[L], mode: mo.id, level: LEVELS[L],
                       label: mo.label + '  -  ' + LEVEL_LABEL[LEVELS[L]], game: true });
        }
      } else {
        picks.push({ key: mo.id, mode: mo.id, level: '', label: mo.label, game: false });
      }
    }
    if (!picks.length) return box;

    var sel = el('select', 'set-select');
    var opts = '';
    for (var q = 0; q < picks.length; q++) {
      opts += '<option value="' + esc(picks[q].key) + '">' + esc(picks[q].label) + '</option>';
    }
    sel.innerHTML = opts;
    sel.value = S.statMode || picks[0].key;
    if (sel.selectedIndex < 0) sel.value = picks[0].key;
    box.appendChild(sel);

    var body = el('div');
    box.appendChild(body);

    var DASH = '&ndash;';
    function tile(v, label, cls) {
      return '<div class="stat-card' + (cls ? ' ' + cls : '') + '">' +
        '<div class="stat-value">' + v + '</div>' +
        '<div class="stat-label">' + label + '</div></div>';
    }

    function paint() {
      var key = sel.value;
      var pick = null;
      for (var z = 0; z < picks.length; z++) if (picks[z].key === key) pick = picks[z];
      if (!pick) { body.innerHTML = ''; return; }
      var r = byKey[key];
      var n = r ? r.n : 0;

      var grid = '<div class="stat-grid">';
      grid += tile(n, 'Runs');
      grid += tile(n ? r.avgAccuracy.toFixed(1) + '%' : DASH, 'Average accuracy');
      grid += tile(n ? r.bestAccuracy + '%' : DASH, 'Best');
      grid += tile(n ? r.passRate + '%' : DASH, 'Banked points');
      grid += tile(n ? r.perfectRate + '%' : DASH, 'At 100%');
      if (pick.game) {
        /* THE TILE THE PANEL IS FOR, so it is the one that carries a colour:
           green where the clock is comfortable, gold where it is starting to
           bite, red where it is deciding the run. */
        var tl = r && r.timeLeftPct !== null && r.timeLeftPct !== undefined
          ? r.timeLeftPct : null;
        var band = tl === null ? '' : (tl >= 40 ? 'tl-loose' : tl >= 15 ? 'tl-fair' : 'tl-tight');
        grid += tile(tl === null ? DASH : tl + '%', 'Time left, average', band);
        grid += tile(r && r.expiredPct !== null && r.expiredPct !== undefined
          ? r.expiredPct + '%' : DASH, 'Ran out of time');
      } else {
        grid += tile(r && r.medianSecs ? fmtClock(r.medianSecs) : DASH, 'Median time');
      }
      grid += '</div>';
      body.innerHTML = grid;

      if (pick.game) {
        var timed = r ? r.timedRuns : 0;
        body.appendChild(el('p', 'form-hint mt-0', timed
          ? 'Time left is averaged over ' + timed + ' timed run' +
            (timed === 1 ? '' : 's') + '. The dial behind it is ' +
            esc(String(gameDials(pick.mode, pick.level).secsPer)) + 's per ' +
            esc(gameUnit(pick.mode)) + ', under gear &rarr; Games.' +
            (timed < 5 ? ' Too few runs to tune anything on yet.' : '')
          : 'No timed runs on this level yet - practice runs build no clock, and ' +
            'runs from before 1.50 were never asked what was left on theirs.'));
      } else if (n) {
        body.appendChild(el('p', 'form-hint mt-0',
          'A quiz is timed against a stopwatch rather than a countdown, so there ' +
          'is nothing left on the clock to report - the median above is how long ' +
          'the typing actually takes.'));
      }
    }

    sel.addEventListener('change', function () {
      S.statMode = sel.value;
      lsSet('statMode', S.statMode);
      paint();
    });
    paint();
    return box;
  }

  /** What one game charges its seconds per - section, line or word. It is the
     unit the game WALKS, which is not always the unit it is played in: the two
     verse games are charged per section. */
  function gameUnit(mode) {
    if (mode === 'verseSort' || mode === 'verseOrder') return 'section';
    var m = modeById(mode);
    if (!m) return 'unit';
    return m.unit === 'word' ? 'word' : 'line';
  }

  /** Horizontal bars, sorted, direct-labelled - no legend needed for one series. */
  function barChart(songs) {
    var box = el('div');
    var max = 0;
    for (var i = 0; i < songs.length; i++) if (songs[i].score > max) max = songs[i].score;
    if (max <= 0) max = 1;
    /* The BAR LENGTHS are relative to what is on screen - that is what a chart
       of the top ten is for - but the COLOURS are the library's, like every
       other plate in the app. Spreading them across the ten songs shown would
       paint the weakest of your ten best in rust. */
    var scale = libraryScale();
    for (var j = 0; j < songs.length; j++) {
      var s = songs[j];
      var row = el('div', 'bar-row');
      row.innerHTML =
        '<div class="bar-label">' + esc(s.title) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' +
        Math.max(2, (s.score / max) * 100) + '%;background:' + scoreColor(s, scale) + '"></div></div>' +
        '<div class="bar-val">' + s.score + '</div>';
      (function (id) {
        row.addEventListener('click', function () { go('detail', { id: id }); });
      })(s.id);
      box.appendChild(row);
    }
    return box;
  }

  function insightRow(s, badge) {
    var row = el('div', 'insight-song-row');
    var scale = buildScale(S.songs);
    row.innerHTML =
      '<div style="flex:1; min-width:0">' +
        '<div class="insight-song-name">' + esc(s.title) + '</div>' +
        '<div class="insight-song-sub">' + s.attempts + ' attempt' + (s.attempts > 1 ? 's' : '') +
        '  &middot;  best ' + Math.round(s.bestAccuracy) + '%' +
        '  &middot;  ' + esc(agoText(s.daysSince)) + '</div>' +
      '</div>' +
      '<div class="score-pill" style="background:' + scoreColor(s, scale) + '">' +
      (badge === undefined ? s.score : esc(badge)) + '</div>';
    row.addEventListener('click', function () { go('detail', { id: s.id }); });
    return row;
  }

  /* ============================================================
     Settings
     ------------------------------------------------------------
     Six cards, in the order you actually reach for them: the songbook, then
     scoring, then the two shelves that are worth points, then the stopwatch,
     then the machine you are on, then the things you cannot undo.

     Games AND quizzes are one thing at a time behind a single dropdown. Eight
     games times three levels times six dials, plus five quizzes, is a hundred
     and fifty-odd controls, and a screen with a hundred and fifty controls on
     it is not a settings screen, it is a wall.

     A quiz draws one card rather than three: the mask IS its difficulty, so it
     has no levels to tune - only what it is worth and what it has to beat.
     ============================================================ */

  /* What each dial is called and how it is drawn. The server decides which of
     these a given game HAS - a level object only carries its own keys - so
     this table never has to be kept in step with the game list. */
  /* Roughly: what it is worth, how long you get, HOW MUCH is wrong or missing,
     then what the wrong material is made of. A card that opens with the dial
     that decides the shape of the board reads in the order you think in. */
  var DIAL_ORDER = ['pts', 'floor', 'secsPer', 'fakePct', 'fakesPer', 'missPct',
                    'editN', 'editPct', 'borrowN', 'decoyPct', 'extraN', 'trayN',
                    'choiceCount',
                    /* The Easy rung's four, in the order you decide them:
                       which letters, then over what, then how many. The count
                       and the share sit next to each other because only one of
                       them is live at a time and seeing the dead one greyed
                       beside its replacement is how you learn which is which. */
                    'letterPick', 'letterScope', 'letterCount', 'letterPct'];
  var DIAL_META = {
    pts:     { label: 'Worth', kind: 'num', min: 0, max: 1000,
               sub: 'points a flawless run banks' },
    floor:   { label: 'Floor', kind: 'pct', min: 0, max: 99,
               sub: 'at or under this a run banks nothing at all; halfway ' +
                    'between it and 100 banks half the value' },
    choiceCount: { label: 'Options', kind: 'num', min: 2, max: 8,
               sub: 'answers offered per question, so a pure guess is worth ' +
                    'one in this many. A floor, not a cap - if the level plants ' +
                    'more wrong answers than will fit, the list grows' },
    editN:   { label: 'Tampered', kind: 'range', min: 0, max: 6,
               sub: 'copies of this song with some words swapped for fakes' },
    editPct: { label: 'How tampered', kind: 'pct', min: 5, max: 100,
               sub: 'share of the words swapped - a HIGHER share is easier to catch' },
    borrowN: { label: 'Planted', kind: 'range', min: 0, max: 6,
               sub: 'units that do not belong here. Where there is a Decoys ' +
                    'dial below, it splits these between lines borrowed from ' +
                    'other songs and this song in the wrong place' },
    decoyPct: { label: 'Decoys', kind: 'pct', min: 0, max: 100,
               sub: 'of the planted material that is not tampered with: 0 is all ' +
                    'BORROWED from other songs, 100 is all DECOY - a line this ' +
                    'song really does sing, in the wrong place. The decoy is the ' +
                    'harder catch, because nothing about it is wrong except where ' +
                    'it is' },
    /* Read against the game's unit - see dialGrid. Words for Scramble Words,
       lines for Scramble Lines. */
    missPct: { label: 'Units missing', kind: 'pct', min: 5, max: 100,
               sub: 'lifted out for you to put back' },
    extraN:  { label: 'Extra words', kind: 'range', min: 0, max: 12,
               sub: 'in the bank, belonging nowhere' },
    /* Read against the unit like missPct is - see dialGrid. */
    trayN:   { label: 'On the tray', kind: 'num', min: 2, max: 40,
               sub: 'at once. The deck is unchanged - everything missing is ' +
                    'still in it, plus the ringers - this is how much of it you ' +
                    'can see. MORE IS HARDER: a bigger haystack, and less of ' +
                    'the song confirmed for you at any one moment. The word the ' +
                    'next gap wants is always on the tray, so a smaller one ' +
                    'never makes a board unwinnable' },
    fakePct: { label: 'Share faked', kind: 'pct', min: 5, max: 100,
               sub: 'doing nothing at all scores whatever is left' },
    fakesPer: { label: 'Behind each', kind: 'num', min: 1, max: 8,
               sub: 'wrong ones hidden behind every one you can tap. ONE is ' +
                    'the easy end - a tap on something you know is wrong lands ' +
                    'straight on the answer - and three means the tap is a ' +
                    'guess of its own' },
    secsPer: { label: 'Seconds each', kind: 'rate', min: 0.1, max: 600,
               sub: 'the time limit is this times what the song holds' },
    letterPick: { label: 'Which letters', kind: 'choice',
               options: [['random', 'At random'], ['first', 'From the start']],
               sub: 'a letter from the MIDDLE of a word is the better prompt: ' +
                    'a first letter is often guessable from the line before it, ' +
                    'which turns the rung into a crossword you can solve ' +
                    'without the song' },
    letterScope: { label: 'Counted over', kind: 'choice',
               options: [['word', 'Each word - a flat count'],
                         ['line', 'Each line - a share'],
                         ['verse', 'Each verse - a share'],
                         ['song', 'The whole song - a share']],
               sub: 'a flat count gives every word the same help; a share ' +
                    'spreads a budget of letters across the unit in proportion ' +
                    'to how long each word is, so the long words get more' },
    letterCount: { label: 'Letters per word', kind: 'num', min: 0, max: 12,
               sub: 'when counted over each word. A word shorter than this ' +
                    'shows all of itself and no more' },
    letterPct: { label: 'Share of letters', kind: 'pct', min: 0, max: 100,
               sub: 'when counted over a line, a verse or the song' }
  };

  VIEWS.settings = function () {
    S.settingsDirty = false;      // a freshly drawn screen has nothing staged
    var wrap = el('div');
    wrap.appendChild(el('p', 'section-eyebrow', 'Setup'));
    wrap.appendChild(el('h2', 'section-title', 'Settings'));

    /**
     * NOTHING ON THIS SCREEN WRITES UNTIL YOU SAY SO.
     *
     * Every control used to post the moment it changed, which meant dragging a
     * slider from 1 to 8 wrote eight times, each one dropping every cached song
     * and rebuilding the index, and each one toasting "Saved" over the last.
     * Worse, there was no way to try a number and change your mind: the trying
     * WAS the committing.
     *
     * So an edit is staged. It is applied to the local copy straight away, so
     * the screen keeps showing what you typed and every computed line under a
     * dial recomputes off it, and it is merged into one patch that the Save
     * button posts in a single write. Discard throws the patch away and pulls
     * the stored settings back.
     *
     * The RESETS are the exception and stay immediate: they are already behind
     * a confirm, they replace whole blocks rather than single dials, and half a
     * reset is not a thing anyone wants staged.
     */
    var pending = null;

    /** Merge a patch into a target. Arrays are values here, never merged. */
    function mergePatch(dst, src) {
      for (var k in src) {
        if (!src.hasOwnProperty(k)) continue;
        var v = src[k];
        if (v && typeof v === 'object' && !(v instanceof Array)) {
          if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
          mergePatch(dst[k], v);
        } else {
          dst[k] = (v instanceof Array) ? v.slice() : v;
        }
      }
    }
    function countEdits(o, n) {
      n = n || 0;
      for (var k in o) {
        if (!o.hasOwnProperty(k)) continue;
        var v = o[k];
        if (v && typeof v === 'object' && !(v instanceof Array)) n = countEdits(v, n);
        else n++;
      }
      return n;
    }

    var saveBar = el('div', 'settings-save');
    var saveBtn = el('button', 'btn btn-gold', 'Save');
    var dropBtn = el('button', 'btn btn-outline', 'Discard');
    var saveWord = el('span', 'settings-save-word');
    saveBar.appendChild(saveWord);
    saveBar.appendChild(dropBtn);
    saveBar.appendChild(saveBtn);

    function paintSaveBar() {
      var n = pending ? countEdits(pending) : 0;
      S.settingsDirty = n > 0;
      saveBar.style.display = n ? '' : 'none';
      saveWord.textContent = n + (n === 1 ? ' unsaved change' : ' unsaved changes');
    }

    /** Stage an edit. Applied locally at once; written only on Save. */
    function pushSettings(patch, after) {
      if (patch && patch.reset) { writeSettings(patch, after); return; }
      pending = pending || {};
      mergePatch(pending, patch);
      mergePatch(S.settings, patch);
      paintSaveBar();
      if (after) after();
    }

    function writeSettings(patch, after) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving';
      api('setSettings', { settings: patch }).then(function (saved) {
        S.settings = saved;
        pending = null;
        dropAllSongs();              // every cached song is now mis-scored
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        paintSaveBar();
        refreshIndex().catch(function () {});
        if (after) after();
        toast('Saved');
      }, function (e) {
        /* TWO-ARGUMENT then. A throw while repainting a successful save must
           not report the save as failed and leave the patch staged - that is
           how you get the same edit written twice. */
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        if (after) after();
        toast(e.message);
      });
    }

    saveBtn.addEventListener('click', function () {
      if (!pending) return;
      writeSettings(pending);
    });
    dropBtn.addEventListener('click', function () {
      if (!pending) return;
      if (!confirm('Throw away your unsaved changes?')) return;
      pending = null;
      S.settingsDirty = false;
      refreshIndex().then(function () { render(); }, function () { render(); });
    });

    /* ---------------- the songbook ---------------- */
    /* WHERE THE SONGBOOK IS, SET FROM IN HERE - 1.60. It used to be a constant
       at the top of the file, which made the app one person's app: anyone else
       installing it had to edit code they had no reason to open, and had no
       way at all to move their doc later without a redeploy. It lives in Meta
       now, beside every other setting.

       A blank songbook is a FIRST-CLASS STATE, not an error. Songs can be
       added by hand and the words looked up, so an install with no doc is a
       working install - the import panel just has nothing to import from, and
       says so instead of offering a button that can only fail. */
    var imp = el('div', 'card-block');
    imp.appendChild(el('div', 'card-title', 'Songbook'));

    var docNow = el('p', 'form-hint mt-0');
    imp.appendChild(docNow);

    var docIn = el('input', 'form-input');
    docIn.type = 'url';
    docIn.placeholder = 'Paste the link to your Google Doc';
    docIn.value = '';
    var docRow = el('div', 'input-with-btn');
    var docSave = el('button', 'find-btn', 'Save');
    docSave.type = 'button';
    docRow.appendChild(docIn);
    docRow.appendChild(docSave);

    var docGroup = el('div', 'form-group');
    docGroup.appendChild(docRow);
    docGroup.appendChild(el('p', 'form-hint mt-0',
      'Open your songbook in Google Docs and copy the address bar. It has to be a ' +
      'document your own account can open.'));
    imp.appendChild(docGroup);

    var status = el('div');
    var btn = el('button', 'btn btn-gold btn-block', 'Import new songs from Doc');

    /* One repaint for both halves of the panel, because setting the doc is
       what turns the import on and clearing it is what turns it off. */
    function paintDoc() {
      docNow.innerHTML = S.docUrl
        ? 'Reading from <a href="' + esc(S.docUrl) + '" target="_blank" rel="noopener">' +
          esc(S.docTitle || 'your songbook') + '</a>. Import pulls anything not already ' +
          'here, matched on title - re-ordering the doc does not matter, and songs you ' +
          'have edited in the app are left alone.'
        : 'No songbook set. Point the app at a Google Doc and it can bulk-import from it. ' +
          'Without one you can still add songs by hand, words and all.';
      btn.disabled = !S.docUrl;
      btn.style.display = S.docUrl ? '' : 'none';
      docSave.textContent = S.docUrl ? 'Change' : 'Save';
    }

    docSave.addEventListener('click', function () {
      var val = docIn.value.trim();
      if (!val) { toast('Paste the link to your Google Doc first'); return; }
      docSave.disabled = true;
      docSave.textContent = 'Checking...';
      api('setDoc', { url: val }).then(function (r) {
        S.docUrl = r.docUrl;
        S.docTitle = r.docTitle;
        docIn.value = '';
        docSave.disabled = false;
        paintDoc();
        toast('Songbook set: ' + r.docTitle);
      }).catch(function (e) {
        docSave.disabled = false;
        paintDoc();
        toast(e.message);
      });
    });
    btn.addEventListener('click', function () {
      // The whole import is a single server call, so there is no percentage to
      // report - nothing streams back until it is finished. What we can honestly
      // show is that it is alive and how long it has been going.
      var started = Date.now();
      var timer = null;
      btn.disabled = true;
      status.innerHTML =
        '<div class="progress-track"><div class="progress-worm"></div></div>' +
        '<p class="form-hint mt-0" id="impNote">Reading the document...</p>';
      var note = status.querySelector('#impNote');
      function tick() {
        var secs = Math.round((Date.now() - started) / 1000);
        btn.textContent = 'Importing... ' + secs + 's';
        if (note) {
          note.textContent = secs < 12
            ? 'Reading the document...'
            : 'Still reading - the songbook is long, this takes a while.';
        }
      }
      tick();
      timer = setInterval(tick, 1000);

      function stop() {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = 'Import new songs from Doc';
      }

      api('importDoc', { replaceAll: false }).then(function (r) {
        return refreshIndex().then(function () { return r; });
      }).then(function (r) {
        var secs = Math.round((Date.now() - started) / 1000);
        stop();
        var msg = '<div class="import-done"><div class="import-done-head">Done in ' +
          secs + 's</div>' +
          '<p class="form-hint mt-0">Read <strong>' + r.parsed + '</strong> songs in the doc. ' +
          'Added <strong>' + r.added + '</strong>, already had ' + r.skipped + '.</p>';
        if (r.added && r.addedTitles && r.addedTitles.length) {
          msg += '<p class="form-hint"><strong>New:</strong> ' +
            esc(r.addedTitles.join(', ')) + '</p>';
        }
        if (r.flagged) {
          msg += '<p class="form-hint">' + r.flagged + ' need a chorus tagged (they say ' +
            '"Chorus" but never indented one). They carry a flag in the library.</p>';
        }
        msg += '</div>';
        status.innerHTML = msg;
        if (r.added) {
          var see = el('button', 'btn btn-primary btn-block btn-sm', 'See them in the Pantry');
          see.style.marginTop = '8px';
          see.addEventListener('click', function () { resetTo('library'); });
          status.appendChild(see);
        }
        toast(r.added ? 'Imported ' + r.added + ' songs' : 'Nothing new in the doc');
      }).catch(function (e) {
        stop();
        status.innerHTML = '<p class="form-hint" style="color:var(--incorrect)">' +
          esc(e.message) + '</p>';
      });
    });
    imp.appendChild(btn);
    imp.appendChild(status);
    imp.appendChild(el('p', 'form-hint',
      S.lastImport ? 'Last import: ' + esc(S.lastImport) : 'Never imported.'));
    paintDoc();

    var links = el('p', 'form-hint');
    var linkHtml = [];
    if (S.sheetUrl) {
      linkHtml.push('<a href="' + esc(S.sheetUrl) +
        '" target="_blank" rel="noopener" class="text-link-btn">Back up or move your data</a>');
    }
    links.innerHTML = linkHtml.join('&nbsp;&nbsp;&middot;&nbsp;&nbsp;');
    imp.appendChild(links);
    wrap.appendChild(imp);

    /* ---------------- scoring: hot, cold, and the floor ---------------- */
    var sc = el('div', 'card-block');
    var scHead = el('div', 'flex-between');
    scHead.appendChild(el('div', 'card-title', 'Scoring'));
    scHead.appendChild(infoDot(
      'A run banks its value scaled by how far above the floor you scored. ' +
      'At or below the floor it banks nothing; at 100% it banks the full value. ' +
      'Whatever it banks pays down the nightly loss first. A QUIZ then turns ' +
      'what is left into rest days at the share below, and a hot song loses ' +
      'nothing. A GAME stops at paying the loss down: clear it outright and the ' +
      'song is hot for today only, which buys back the one free night before ' +
      'the cold bites again. A game can never add a day, nor extend a song that ' +
      'is already hot. Once the flame is out the loss climbs by the cold step ' +
      'every night until the score is gone. Changing anything here rescores ' +
      'every song and its whole history at once, because points are computed ' +
      'from accuracy and mode, never stored.'));
    sc.appendChild(scHead);

    /**
     * Mirrors the server's nightsToZero so these blurbs tell the truth rather
     * than the old score/decay arithmetic, which stopped being right the
     * moment the loss started compounding.
     */
    function nightsToZero(score, hotDays, y) {
      if (score <= 0) return 0;
      if (y <= 0) return null;
      var nights = hotDays + 1;             // hot nights, then the free turn
      var left = score, rate = y, guard = 0;
      while (left > 0 && guard++ < 4000) {
        left = left - rate;
        rate = rate + y;
        nights++;
      }
      return nights;
    }

    /* Quizzes only - a game never buys a rest day at all. */
    function hotDaysFor(points, pct) { return Math.round(points * pct / 100); }

    /* cold step */
    var decayVal = el('div', 'mastery-head');
    var decayNote = el('p', 'form-hint mt-0');
    function decayBlurb(d) {
      if (d === 0) return 'Nothing ever goes cold - a song rests forever once the flame is out.';
      var pct = S.settings.hotPct === undefined ? 10 : S.settings.hotPct;
      var out = [];
      for (var i = 0; i < S.modes.length; i++) {
        var m = S.modes[i];
        if (m.id !== 'medium' && m.id !== 'hard' && m.id !== 'blind') continue;
        var p = modePoints(m.id) || 0;
        var hd = hotDaysFor(p, pct);
        out.push(m.label + ' (' + p + ') rests ' + hd + 'd then is spent after ' +
                 nightsToZero(p, hd, d) + 'd');
      }
      return 'One flawless run, then left alone: ' + out.join('; ') + '.';
    }
    function paintDecay(d) {
      decayVal.innerHTML = '<div class="mastery-num">' + d + '</div>' +
        '<div><div class="mastery-word">cold step</div>' +
        '<div class="insight-song-sub">a cold song loses this much the first night, ' +
        'twice it the next, then three times. Always a whole number - what a run ' +
        'pays off the rate is rounded, so no song ever sits at "losing 0.7 tonight"' +
        '</div></div>';
      decayNote.textContent = decayBlurb(d);
    }
    paintDecay(S.settings.decay);
    sc.appendChild(decayVal);

    var slider = el('input', 'decay-slider');
    slider.type = 'range';
    slider.min = '0'; slider.max = '5'; slider.step = '1';
    slider.value = String(S.settings.decay);
    slider.addEventListener('input', function () { paintDecay(Number(slider.value)); });
    slider.addEventListener('change', function () {
      pushSettings({ decay: Number(slider.value) }, function () {
        slider.value = String(S.settings.decay);
        paintDecay(S.settings.decay);
        paintHot(S.settings.hotPct);
      });
    });
    sc.appendChild(slider);
    sc.appendChild(decayNote);

    /* hot days */
    var hotNote = el('p', 'form-hint');
    function paintHot(h) {
      if (!h) {
        hotNote.innerHTML = 'Hot days <strong>0%</strong> &mdash; no quiz ever buys a ' +
          'rest day, so every song is cold the morning after.';
        return;
      }
      var b = modePoints('blind') || 100;
      var days = hotDaysFor(b, h);
      hotNote.innerHTML = 'Hot days <strong>' + h + '%</strong> &mdash; a QUIZ keeps a song ' +
        'safe for this share of what it banked, rounded to whole days. At ' + h + '%, ' +
        'a flawless Blind quiz (' + b + ') buys ' + days + ' day' + (days === 1 ? '' : 's') +
        ', and a quiz has to bank ' + Math.ceil(50 / h) + ' points to buy even one. ' +
        'Games are not on this dial at all - they only ever buy the day they are ' +
        'played on.';
    }
    paintHot(S.settings.hotPct);
    var hSlider = el('input', 'decay-slider');
    hSlider.type = 'range';
    hSlider.min = '0'; hSlider.max = '50'; hSlider.step = '1';
    hSlider.value = String(S.settings.hotPct === undefined ? 10 : S.settings.hotPct);
    hSlider.addEventListener('input', function () { paintHot(Number(hSlider.value)); });
    hSlider.addEventListener('change', function () {
      pushSettings({ hotPct: Number(hSlider.value) }, function () {
        hSlider.value = String(S.settings.hotPct);
        paintHot(S.settings.hotPct);
        paintDecay(S.settings.decay);
      });
    });
    sc.appendChild(hSlider);
    sc.appendChild(hotNote);

    /* ---------------- the hot share, and what each medal does to it -------
     *
     * ONE INTERFACE, BECAUSE IT IS ONE NUMBER - 1.63. The share above and the
     * four multipliers below are not two settings that happen to sit near each
     * other; they are a base and its coefficients, and the only figure that
     * matters is their product. Tuning them on separate screens means doing
     * that multiplication in your head every time, against a points value you
     * also have to remember - which is how the medals came to be worth
     * whatever they were worth rather than what anybody chose.
     *
     * So the table states the product. Every row is a real sentence about a
     * real run: a flawless quiz at the top rung, on a song holding that medal,
     * buys THIS many days. Change any dial and every row moves.
     *
     * The rows are days, not multipliers, because a multiplier is the input
     * and days are the thing you are actually deciding about. Three times of
     * something is not a quantity anybody has an opinion about; eleven days
     * versus fifteen is.
     */
    var mmHead = el('div', 'flex-between');
    mmHead.appendChild(el('div', 'card-title mt-12', 'What a medal is worth'));
    mmHead.appendChild(infoDot(
      'A medal multiplies the hot share above, and nothing else. It never ' +
      'changes what a run is worth in points - those are the record of what ' +
      'you did, and multiplying them would rewrite your history the moment a ' +
      'medal landed. Rest days are a claim about the future, which is the ' +
      'right tense for a reward. Each tier replaces the one below rather than ' +
      'stacking on it, so a platinum song converts at the platinum rate and ' +
      'not at two times three times four times five.'));
    sc.appendChild(mmHead);

    var mmGrid = el('div', 'medal-dial-grid');
    var mmNote = el('p', 'form-hint mt-0');

    function mmValue(tier) {
      var m = S.settings && S.settings.medalMult;
      var v = m ? Number(m[tier]) : NaN;
      return (v >= 0) ? v : (MEDAL_X_DEFAULT[tier] || 1);
    }
    /* The top quiz rung, because it is the run these dials are really about -
       the one somebody takes on a song they have finished. Falls back to a
       plain hundred if the ladder has been renamed out from under it. */
    function topQuizPoints() { return modePoints('blind') || 100; }

    function paintMedalDials() {
      var pct = S.settings.hotPct === undefined ? 10 : S.settings.hotPct;
      var pts = topQuizPoints();
      var plain = Math.round(pts * pct / 100);
      var topMode = modeById('blind');
      var rows = 'A flawless ' + esc(topMode ? topMode.label : 'top') + ' quiz (' + pts +
        ' points) buys <strong>' + plain + ' day' + (plain === 1 ? '' : 's') +
        '</strong> on a song with no medal';
      var bits = [];
      for (var i = 0; i < MEDAL_ORDER.length; i++) {
        var t = MEDAL_ORDER[i];
        var days = Math.round(pts * (pct * mmValue(t)) / 100);
        bits.push(esc(MEDAL_TEXT[t]) + ' ' + days);
      }
      mmNote.innerHTML = rows + ', and then ' + bits.join(', ') + '. ' +
        (pct ? '' : 'The share above is zero, so no medal can buy anything.');
    }

    function medalDialRow(tier) {
      var cell = el('div', 'medal-dial');
      cell.innerHTML = '<span class="medal-dial-disc">' + medalSvg(tier, 18) + '</span>' +
        '<span class="medal-dial-name">' + esc(MEDAL_TEXT[tier]) + '</span>';
      var input = el('input', 'num-input');
      input.type = 'number';
      input.min = '1'; input.max = '20'; input.step = '1';
      input.value = String(mmValue(tier));
      input.addEventListener('change', function () {
        var patchM = { medalMult: {} };
        patchM.medalMult[tier] = Number(input.value);
        pushSettings(patchM, function () {
          input.value = String(mmValue(tier));
          paintMedalDials();
          paintHot(S.settings.hotPct);
          paintDecay(S.settings.decay);
        });
      });
      cell.appendChild(input);
      return cell;
    }
    for (var mi = 0; mi < MEDAL_ORDER.length; mi++) {
      mmGrid.appendChild(medalDialRow(MEDAL_ORDER[mi]));
    }
    sc.appendChild(mmGrid);
    paintMedalDials();
    sc.appendChild(mmNote);

    /* Repainting the medal table whenever the base moves, so the two halves of
       one interface can never be showing different arithmetic. */
    hSlider.addEventListener('change', paintMedalDials);

    var mmReset = el('button', 'btn btn-outline btn-sm', 'Back to 2 / 3 / 4 / 5');
    mmReset.addEventListener('click', function () {
      pushSettings({ reset: 'medals' }, function () {
        render();
        toast('Medal multipliers reset');
      });
    });
    sc.appendChild(mmReset);

    /* THE FLOOR IS NOT HERE ANY MORE. One number for the whole app said that
       75% of an Easy board and 75% of a Hard one were the same achievement,
       which they never were. Every game level and every quiz carries its own,
       under Games and quizzes below. */
    sc.appendChild(el('p', 'form-hint',
      'The floor - what a run has to beat to bank anything - is set per level, ' +
      'down in Games and quizzes.'));

    /* ---------------- the heatmap ----------------
       Four dials, printed in the unit you think in rather than as the raw
       constants they are. The asymmetry between sting and mend is what decides
       whether the map nags you or forgives you too quickly, and that is far
       easier to FEEL than to reason about - so the consequence is computed and
       printed underneath, the same way the floor dial states what it banks. */
    sc.appendChild(el('div', 'set-group-title', 'The heatmap'));
    sc.appendChild(el('p', 'form-hint mt-0',
      'Every word, line and verse of a song starts at 100 and only moves when a ' +
      'run says something about it. The lyric sheet shades the weak ones. ' +
      'It carries no score and never will - it is there to look at, not to clear.'));

    var heatNote = el('p', 'form-hint');
    function heatDials() {
      var st = S.settings || {};
      return {
        sting: st.sting === undefined ? 35 : Number(st.sting),
        mend: st.mend === undefined ? 18 : Number(st.mend),
        gameWeight: st.gameWeight === undefined ? 40 : Number(st.gameWeight),
        fade: st.fade === undefined ? 90 : Number(st.fade)
      };
    }
    /** How many clean runs it takes to climb back over 90 from one miss. */
    function heatRecovery(sting, mend) {
      var v = 100 - sting, n = 0;
      while (v < 90 && n < 99) { v = v + (100 - v) * (mend / 100); n++; }
      return n;
    }
    function paintHeatNote() {
      var d = heatDials();
      heatNote.innerHTML =
        'A word at 100 that you miss drops to <strong>' + (100 - d.sting) +
        '</strong>, and takes about <strong>' + heatRecovery(d.sting, d.mend) +
        '</strong> clean runs to climb back over 90. A game moves it ' +
        d.gameWeight + '% as far as a quiz does, and anything you have not ' +
        'been asked in ' + d.fade + ' days counts half as much.';
    }

    function heatRow(key, label, sub, min, max) {
      var row = el('div', 'dial-row');
      var name = el('div', 'dial-name');
      name.innerHTML = '<span>' + esc(label) + '</span>' +
        '<span class="dial-sub">' + esc(sub) + '</span>';
      row.appendChild(name);
      var input = el('input', 'num-input');
      input.type = 'number';
      input.min = String(min); input.max = String(max); input.step = '1';
      input.value = String(heatDials()[key]);
      input.addEventListener('change', function () {
        var patch = {};
        patch[key] = Number(input.value);
        pushSettings(patch, function () {
          input.value = String(heatDials()[key]);
          paintHeatNote();
        });
      });
      row.appendChild(input);
      return row;
    }

    sc.appendChild(heatRow('sting', 'A mistake stings',
      'how far a wrong answer pulls a standing down, per cent of what is left',
      1, 100));
    sc.appendChild(heatRow('mend', 'A clean run mends',
      'and how far a right one pulls it back up', 1, 100));
    sc.appendChild(heatRow('gameWeight', 'A game is worth',
      'per cent of what a quiz is worth. Quizzes are the better evidence',
      0, 100));
    sc.appendChild(heatRow('fade', 'Half-forgotten after',
      'days, after which an observation counts half as much. The shading goes ' +
      'pale rather than pretending it still knows', 7, 3650));
    paintHeatNote();
    sc.appendChild(heatNote);

    wrap.appendChild(sc);

    /* ---------------- the stopwatch ---------------- */
    var tc = el('div', 'card-block');
    var tHead = el('div', 'flex-between');
    tHead.appendChild(el('div', 'card-title', 'The timer'));
    tHead.appendChild(infoDot(
      'Every quiz is timed, with the clock stopped whenever the app is in the ' +
      'background - one walk-away run would otherwise poison a median for good. ' +
      'But the clock only MOVES your points on a run where you ticked its box in ' +
      'the picker, and that box only unlocks once you have enough runs at that ' +
      'level on that machine to have a real median to be measured against. ' +
      'Games are not on this dial at all - they run against a countdown instead, ' +
      'tuned per game under Games.'));
    tc.appendChild(tHead);

    var speedNote = el('p', 'form-hint mt-0');
    function paintSpeed() {
      var on = !!S.settings.speedMod;
      var sw = S.settings.speedSwing === undefined ? 20 : S.settings.speedSwing;
      var blind = modePoints('blind') || 100;
      var mn = S.settings.timerMin || 5;
      speedNote.innerHTML = on
        ? 'Unlocks after <strong>' + mn + '</strong> runs at a level. Swing <strong>' +
          sw + '%</strong> &mdash; on a run where you tick the timer, ' +
          'twice your average speed earns the full ' + sw + '%, twice as slow gives it ' +
          'all back, and running at your average changes nothing at all. A flawless ' +
          'Blind (' + blind + ') would pay <strong>' + (blind * (1 + sw / 100)).toFixed(1) +
          '</strong> at double speed and <strong>' + (blind * (1 - sw / 100)).toFixed(1) +
          '</strong> at half. Untick it and the run is scored on accuracy alone.'
        : 'Pace is recorded and shown everywhere, but the tick box is hidden and no ' +
          'run is scored on it.';
    }

    var minRow = el('div', 'points-row');
    minRow.innerHTML = '<span class="points-name">Runs before it unlocks</span>';
    var minInput = el('input', 'points-input');
    minInput.type = 'number';
    minInput.min = '1'; minInput.max = '50'; minInput.step = '1';
    minInput.value = String(S.settings.timerMin || 5);
    minInput.addEventListener('change', function () {
      pushSettings({ timerMin: Number(minInput.value) }, function () {
        minInput.value = String(S.settings.timerMin);
        paintSpeed();
      });
    });
    minRow.appendChild(minInput);
    tc.appendChild(minRow);

    var toggle = el('label', 'checkbox-row');
    toggle.innerHTML = '<input type="checkbox"' + (S.settings.speedMod ? ' checked' : '') +
      '><span>Offer the timer on quizzes</span>';
    toggle.querySelector('input').addEventListener('change', function (ev) {
      var boxEl = ev.target;
      pushSettings({ speedMod: boxEl.checked }, function () {
        boxEl.checked = !!S.settings.speedMod;
        paintSpeed();
      });
    });
    tc.appendChild(toggle);

    var swSlider = el('input', 'decay-slider');
    swSlider.type = 'range';
    swSlider.min = '0'; swSlider.max = '50'; swSlider.step = '5';
    swSlider.value = String(S.settings.speedSwing === undefined ? 20 : S.settings.speedSwing);
    swSlider.addEventListener('input', function () {
      var was = S.settings.speedSwing;
      S.settings.speedSwing = Number(swSlider.value);
      paintSpeed();
      S.settings.speedSwing = was;
    });
    swSlider.addEventListener('change', function () {
      pushSettings({ speedSwing: Number(swSlider.value) }, function () {
        swSlider.value = String(S.settings.speedSwing);
        paintSpeed();
      });
    });
    tc.appendChild(swSlider);
    paintSpeed();
    tc.appendChild(speedNote);
    wrap.appendChild(tc);

    /* ---------------- the games, one at a time ---------------- */
    var gm = el('div', 'card-block');
    var gmHead = el('div', 'flex-between');
    gmHead.appendChild(el('div', 'card-title', 'Games and quizzes'));
    gmHead.appendChild(infoDot(
      'Games pay down a song nightly loss and nothing more. Clear it outright ' +
      'and the song is hot for that day only; a game can never buy a rest day ' +
      'or extend one. That is deliberate - they are a holding action between ' +
      'real sittings, and quizzes are how a song actually climbs. ' +
      'Three levels each, and the level is chosen on the card when you start a ' +
      'game. TAMPERED material is this song with words swapped for fakes - a ' +
      'higher swap share is EASIER, because a verse a third wrong reads as wrong ' +
      'at a glance. BORROWED material is lifted whole out of another song, ' +
      'matched on line count so it does not stand out by shape alone. A DECOY ' +
      'is the third kind and the hardest: a line this song really does sing, ' +
      'untouched, put somewhere it does not go - nothing about it is wrong but ' +
      'where it is, so the only way to catch it is to know the song. The Planted ' +
      'count and the Decoys share split those two between them. Both Impostor ' +
      'games are the odd ones: every unit is a judgement over the whole song, ' +
      'so doing nothing scores exactly the share you did not fake - which is ' +
      'why their harder levels fake MORE, not fewer.'));
    gm.appendChild(gmHead);

    /**
     * WHAT THE DROPDOWN LISTS IS THE THING, NOT THE SIDE OF IT.
     *
     * Order Verses and Order Lines are one game asked of two different units,
     * and so are the other three pairs - they share a blurb, they share the
     * shape of their dials, and you tune one because you have just been
     * annoyed by the other. Thirteen entries in a list, eight of them halves
     * of something, made you hunt for a pair the picker has always drawn side
     * by side. Four families and four rungs, with the two halves on a switch
     * underneath, is the same set of dials in a list you can read.
     *
     * The two Beginner quizzes go the same way for the same reason: they are
     * alternatives at one height, not steps, which is exactly how the picker
     * shows them.
     */
    function tuneGroups() {
      var out = [], quizzes = [], begin = [], fams = S.families || [], i, j, m;
      for (i = 0; i < fams.length; i++) {
        var ids = [];
        for (j = 0; j < S.modes.length; j++) {
          if (S.modes[j].family === fams[i].id) ids.push(S.modes[j].id);
        }
        if (ids.length) {
          out.push({ id: 'f_' + fams[i].id, kind: 'game', label: fams[i].label, ids: ids });
        }
      }
      if (!out.length) {                       // no families declared: one each
        for (j = 0; j < S.modes.length; j++) {
          m = S.modes[j];
          if (m.kind === 'game') {
            out.push({ id: 'g_' + m.id, kind: 'game', label: m.label, ids: [m.id] });
          }
        }
      }
      for (j = 0; j < S.modes.length; j++) {
        m = S.modes[j];
        if (m.kind === 'quiz') {
          if ((m.tier || 0) === 0) begin.push(m.id);
          else quizzes.push({ id: 'q_' + m.id, kind: 'quiz', label: m.label, ids: [m.id] });
        }
      }
      if (begin.length) {
        quizzes.unshift({ id: 'q_beginner', kind: 'quiz', label: 'Beginner', ids: begin });
      }
      return out.concat(quizzes);
    }

    /** What one half of a pair is called, once the family name is off it. */
    function sideLabel(id) {
      var m = modeById(id);
      if (!m) return id;
      if (m.variant) return m.variant;
      var s = String(m.label || id), cut = s.indexOf(' - ');
      return cut === -1 ? s : s.slice(cut + 3);
    }

    function groupOf(id) {
      var gs = tuneGroups();
      for (var i = 0; i < gs.length; i++) if (gs[i].ids.indexOf(id) !== -1) return gs[i];
      return gs[0] || null;
    }

    var allGroups = tuneGroups();
    if (!S.gameEdit || !groupOf(S.gameEdit)) {
      S.gameEdit = (allGroups[0] && allGroups[0].ids[0]) || '';
    }

    var gSel = el('select', 'set-select');
    (function () {
      var here = groupOf(S.gameEdit), games = '', quizzes = '';
      for (var i = 0; i < allGroups.length; i++) {
        var g = allGroups[i];
        var opt = '<option value="' + esc(g.id) + '"' +
          (here && here.id === g.id ? ' selected' : '') + '>' + esc(g.label) + '</option>';
        if (g.kind === 'game') games += opt; else quizzes += opt;
      }
      gSel.innerHTML = '<optgroup label="Games">' + games + '</optgroup>' +
                       '<optgroup label="Quizzes">' + quizzes + '</optgroup>';
    })();
    gm.appendChild(gSel);

    var gBody = el('div');
    gm.appendChild(gBody);

    /** One number box - or one dropdown - wired straight to one dial. */
    function dialInput(gameId, level, key, which, value, meta) {
      var isQuiz = !isGame(gameId);

      /* A CHOICE DIAL IS A SELECT, not a number box with a legend somewhere
         else. Two of the Easy rung's four dials are words, and a number
         standing for a word is the kind of thing you have to keep a table for. */
      if (meta.kind === 'choice') {
        var sel = el('select', 'set-select dial-select');
        var html = '';
        for (var o = 0; o < meta.options.length; o++) {
          html += '<option value="' + esc(meta.options[o][0]) + '"' +
            (String(value) === meta.options[o][0] ? ' selected' : '') + '>' +
            esc(meta.options[o][1]) + '</option>';
        }
        sel.innerHTML = html;
        sel.value = String(value);
        sel.addEventListener('change', function () {
          var patchC = { quizzes: {} };
          patchC.quizzes[gameId] = {};
          patchC.quizzes[gameId][key] = sel.value;
          pushSettings(patchC, drawGame);
        });
        return sel;
      }

      var input = el('input', 'num-input');
      input.type = 'number';
      input.min = String(meta.min);
      input.max = String(meta.max);
      // a rate of "1 second per word" is far too coarse a step for a rate
      input.step = meta.kind === 'rate' ? '0.1' : '1';
      input.value = String(value);
      input.addEventListener('change', function () {
        var cur = dialsFor(gameId, level);
        var next;
        if (meta.kind === 'range') {
          var pair = (cur[key] || [0, 0]).slice();
          pair[which] = Number(input.value);
          if (pair[0] > pair[1]) { var t = pair[0]; pair[0] = pair[1]; pair[1] = t; }
          next = pair;
        } else {
          next = Number(input.value);
        }
        var patch;
        if (isQuiz) {
          patch = { quizzes: {} };
          patch.quizzes[gameId] = {};
          patch.quizzes[gameId][key] = next;
        } else {
          patch = { games: {} };
          patch.games[gameId] = {};
          patch.games[gameId][level] = {};
          patch.games[gameId][level][key] = next;
        }
        pushSettings(patch, drawGame);
      });
      return input;
    }

    /**
     * WHAT THIS LEVEL MAKES OF THIS DIAL, in as few characters as will carry
     * it. The prose belongs to the dial and is said once; a seconds-per-line
     * rate and a floor both turn into a different real number at each level,
     * and THAT belongs under the box it came out of.
     */
    function levelNote(gameId, level, key, d) {
      if (key === 'secsPer') return fmtLimit(timeLimitFor(noteSong(gameId), gameId, level));
      if (key === 'floor') {
        var pts = d.pts === undefined ? 0 : d.pts;
        return Math.round((d[key] + 100) / 2) + '% banks ' + (pts / 2).toFixed(1);
      }
      /* A percentage of a song is not a number of blanks until you say which
         song. Both of these print against a real one, for the same reason the
         seconds rate does - an abstract share tells you nothing about what the
         board will look like. */
      if (key === 'missPct') {
        var s1 = noteSong(gameId);
        if (!s1) return '';
        var n1 = unitCountFor(s1, gameId);
        return 'about ' + Math.max(1, Math.round(n1 * d[key] / 100)) + ' of ' + n1;
      }
      if (key === 'borrowN' && gameId === 'lineScramble') {
        var s2 = noteSong(gameId);
        if (!s2) return '';
        var gaps = Math.max(1, Math.round(unitCountFor(s2, gameId) * d.missPct / 100));
        var mid = function (r) { return r ? (Number(r[0]) + Number(r[1])) / 2 : 0; };
        return Math.round(gaps + mid(d.borrowN) + mid(d.editN)) + ' in the bank';
      }
      return '';
    }
    /** A real song to measure a rate against - an abstract rate means nothing. */
    function noteSong(gameId) {
      for (var z = 0; z < S.songs.length; z++) {
        if (unitCountFor(S.songs[z], gameId) > 0) return S.songs[z];
      }
      return null;
    }

    /**
     * ONE GAME, ALL THREE LEVELS, one grid.
     *
     * Three separate cards said everything three times: every dial name, and
     * under it every line of explanation, once per column. Two thirds of the
     * screen was the same sentence again. The dial is named once across the
     * full width and its three boxes sit under the three headings, which is
     * the shape the question actually has - one dial, three answers - and it
     * is what makes Easy and Hard comparable at a glance.
     */
    function dialGrid(gameId) {
      var grid = el('div', 'dial-grid'), L;
      for (L = 0; L < LEVELS.length; L++) {
        (function (lv) {
          var d = dialsFor(gameId, lv);
          var pts = d.pts === undefined ? 0 : d.pts;
          grid.appendChild(el('div', 'dg-head',
            '<span>' + esc(LEVEL_LABEL[lv]) + '</span><span>' + pts + ' pt' +
            (pts === 1 ? '' : 's') + '</span>'));
        })(LEVELS[L]);
      }

      var first = dialsFor(gameId, LEVELS[0]);
      for (var k = 0; k < DIAL_ORDER.length; k++) {
        (function (key) {
          if (first[key] === undefined) return;
          var meta = DIAL_META[key];
          var sub = meta.sub, label = meta.label;
          /* WORDS MISSING AND LINES MISSING ARE THE SAME DIAL AND NOT THE SAME
             QUESTION. One table entry, read against the unit the game walks, so
             Scramble Lines stops asking how many WORDS to lift out of a board
             that only has lines on it. */
          if (key === 'missPct') {
            var mu = modeById(gameId);
            var isLines = mu && mu.unit === 'line';
            label = isLines ? 'Lines missing' : 'Words missing';
            sub = isLines
              ? 'lifted out of the whole song for you to put back'
              : 'lifted out of each section for you to put back';
          }
          if (key === 'trayN') {
            var tu = modeById(gameId);
            label = (tu && tu.unit === 'line') ? 'Lines on the tray' : 'Words on the tray';
          }
          if (key === 'secsPer') {
            var m2 = modeById(gameId), sample = noteSong(gameId);
            sub = 'per ' + (m2 ? m2.unit : 'unit') + '. ' + (sample
              ? 'The limits under the boxes are for ' + esc(sample.title) + ', which has ' +
                unitCountFor(sample, gameId) + '.'
              : 'No songs to measure against yet.');
          }
          var name = el('div', 'dg-name');
          name.innerHTML = '<span>' + esc(label) +
            (meta.kind === 'pct' ? ' (%)' : '') + '</span>' +
            '<span class="dial-sub">' + sub + '</span>';
          grid.appendChild(name);

          for (var L2 = 0; L2 < LEVELS.length; L2++) {
            (function (lv2) {
              var d2 = dialsFor(gameId, lv2);
              var cell = el('div', 'dg-cell');
              if (meta.kind === 'range') {
                cell.appendChild(dialInput(gameId, lv2, key, 0, d2[key][0], meta));
                cell.appendChild(el('span', 'dial-to', 'to'));
                cell.appendChild(dialInput(gameId, lv2, key, 1, d2[key][1], meta));
              } else {
                cell.appendChild(dialInput(gameId, lv2, key, 0, d2[key], meta));
              }
              var note = levelNote(gameId, lv2, key, d2);
              if (note) cell.appendChild(el('div', 'dg-note', esc(note)));
              grid.appendChild(cell);
            })(LEVELS[L2]);
          }
        })(DIAL_ORDER[k]);
      }
      return grid;
    }

    /** One card of dials, for a quiz - which has one level and so one column. */
    function dialCard(gameId, level, headLabel) {
      var d = dialsFor(gameId, level);
      var card = el('div', 'lvl-card');
      var head = el('div', 'lvl-card-head');
      head.innerHTML = '<span>' + esc(headLabel) + '</span>' +
        '<span>' + (d.pts === undefined ? 0 : d.pts) + ' pt' +
        (d.pts === 1 ? '' : 's') + '</span>';
      card.appendChild(head);

      for (var k = 0; k < DIAL_ORDER.length; k++) {
        (function (key) {
          if (d[key] === undefined) return;
          var meta = DIAL_META[key];
          var row = el('div', 'dial-row');
          var name = el('div', 'dial-name');
          var sub = meta.sub;
          /* ONLY ONE OF THE TWO COUNTS IS LIVE, and the other is greyed rather
             than hidden. Hiding it would make the row above it look like it had
             changed the shape of the panel rather than the meaning of one dial,
             and you would lose the pairing that tells you what the scope
             actually switched between. */
          if (key === 'letterCount' || key === 'letterPct') {
            var ruleNow = letterRuleOf(S.settings);
            var live = (key === 'letterCount') === (ruleNow.scope === 'word');
            if (!live) row.className = 'dial-row is-idle';
          }
          if (key === 'letterPick' || key === 'letterScope') {
            row.className = 'dial-row dial-row-choice';
          }
          if (key === 'secsPer') {
            // an abstract rate means nothing; show it against a real song
            var m2 = modeById(gameId);
            var unitWord = m2 ? m2.unit : 'unit';
            var sample = null;
            for (var z = 0; z < S.songs.length && !sample; z++) {
              if (unitCountFor(S.songs[z], gameId) > 0) sample = S.songs[z];
            }
            sub = 'per ' + unitWord + '. ' + (sample
              ? esc(sample.title) + ' has ' + unitCountFor(sample, gameId) + ', so ' +
                fmtLimit(timeLimitFor(sample, gameId, level))
              : 'no songs to measure against yet');
          }
          if (key === 'floor') {
            // a floor is only meaningful against what the thing is worth
            var pts = d.pts === undefined ? 0 : d.pts;
            var half = Math.round((d[key] + 100) / 2);
            sub = meta.sub + '. Here, ' + half + '% banks ' +
                  (pts / 2).toFixed(1) + ' of ' + pts + '.';
          }
          name.innerHTML = '<span>' + esc(meta.label) +
            (meta.kind === 'pct' ? ' (%)' : '') + '</span>' +
            '<span class="dial-sub">' + sub + '</span>';
          row.appendChild(name);
          if (meta.kind === 'range') {
            row.appendChild(dialInput(gameId, level, key, 0, d[key][0], meta));
            row.appendChild(el('span', 'dial-to', 'to'));
            row.appendChild(dialInput(gameId, level, key, 1, d[key][1], meta));
          } else {
            row.appendChild(dialInput(gameId, level, key, 0, d[key], meta));
          }
          card.appendChild(row);
        })(DIAL_ORDER[k]);
      }
      /* THE FOUR DIALS READ BACK AS ONE SENTENCE. Individually they are a
         pick, a scope and two counts, and the thing you actually want to know
         is what a line will look like - which is the same sentence the quiz
         itself prints above the first verse, from the same function. */
      if (gameId === 'medium') {
        var lr = letterRuleOf(S.settings);
        var demo = el('div', 'letter-demo');
        demo.innerHTML = '<div class="letter-demo-say">' + esc(letterRuleText(lr)) + '</div>';
        var sample = sampleLineFor();
        if (sample) {
          /* Against a real line of a real song, because "2 letters at random"
             is not a picture until you have seen one. Re-rolled on every
             repaint by design: a random rule that showed the same letters
             every time you looked would be misrepresenting itself. */
          demo.innerHTML += '<div class="letter-demo-line">' +
            esc(buildOneLineMask(sample, lr)) + '</div>' +
            '<div class="letter-demo-src">' + esc(sample) + '</div>';
        }
        card.appendChild(demo);
      }
      return card;
    }

    /** A real line out of the library, for the Easy rung's preview. */
    function sampleLineFor() {
      for (var i = 0; i < S.songs.length; i++) {
        var cached = S.cache[S.songs[i].id];
        if (!cached || !cached.sections) continue;
        for (var n = 0; n < cached.sections.length; n++) {
          var ls = typableLines(cached.sections[n]);
          for (var k = 0; k < ls.length; k++) {
            if (words(ls[k].t).length >= 4) return ls[k].t;
          }
        }
      }
      return 'And the whistle blew at nine';
    }

    /* One line masked on its own, for the preview. A line-scope reading of the
       rule, since a preview of one line cannot honour a verse-wide budget - and
       showing a line with a verse's worth of letters on it would be a lie in
       the other direction. */
    function buildOneLineMask(line, rule) {
      var ws = words(line);
      var lens = [], i;
      for (i = 0; i < ws.length; i++) lens.push(lettersOf(ws[i]).length);
      var counts = rule.scope === 'word'
        ? lens.map(function () { return rule.count; })
        : shareLetters(lens, rule.pct);
      var parts = [];
      for (i = 0; i < ws.length; i++) parts.push(letterMaskWord(ws[i], counts[i], rule.pick));
      return parts.join(' ');
    }

    function drawGame() {
      gBody.innerHTML = '';
      var grp = groupOf(S.gameEdit);
      if (!grp) return;
      if (grp.ids.indexOf(S.gameEdit) === -1) S.gameEdit = grp.ids[0];

      // the two halves of a pair, on a switch
      if (grp.ids.length > 1) {
        var tog = el('div', 'side-toggle');
        for (var s = 0; s < grp.ids.length; s++) {
          (function (id) {
            var b = el('button', 'side-btn' + (id === S.gameEdit ? ' on' : ''),
                       esc(sideLabel(id)));
            b.type = 'button';
            b.addEventListener('click', function () { S.gameEdit = id; drawGame(); });
            tog.appendChild(b);
          })(grp.ids[s]);
        }
        gBody.appendChild(tog);
      }

      var gameId = S.gameEdit;
      var m = modeById(gameId);
      gBody.appendChild(el('p', 'form-hint mt-0', esc(m ? m.blurb : '')));
      if (!isGame(gameId)) {
        // a quiz has no levels - the mask it draws IS its difficulty
        gBody.appendChild(dialCard(gameId, '', m ? m.label : gameId));
        return;
      }
      /* THREE LEVELS SIDE BY SIDE. Stacked, the only way to compare Easy with
         Hard - which is the whole reason you are on this screen - was to
         scroll between them and hold both in your head. Abreast, a dial that
         is meant to climb with the level either climbs or visibly does not. */
      gBody.appendChild(dialGrid(gameId));
    }
    gSel.addEventListener('change', function () {
      for (var i = 0; i < allGroups.length; i++) {
        if (allGroups[i].id === gSel.value) { S.gameEdit = allGroups[i].ids[0]; break; }
      }
      drawGame();
    });
    drawGame();

    /* Options per question used to be one slider shared by every pick-one game
       at every level, which said that four answers at Easy and four at Hard
       were the same question. It is a dial on Build Verses and Build Lines now,
       per level, alongside everything else that makes a level what it is. */

    var gReset = el('button', 'btn btn-outline btn-sm btn-block',
                    'Put every game back to its defaults');
    gReset.addEventListener('click', function () {
      if (!confirm('Reset all eight games, at all three levels, to their defaults?' +
                   (pending ? NL + NL + 'Your unsaved changes go with them.' : ''))) return;
      pending = null;
      pushSettings({ reset: 'games' }, function () { render(); });
    });
    gm.appendChild(gReset);

    var qReset = el('button', 'btn btn-outline btn-sm btn-block',
                    'Put every quiz back to its defaults');
    qReset.style.marginTop = '8px';
    qReset.addEventListener('click', function () {
      if (!confirm('Reset all five quizzes to their default values and floors?' +
                   (pending ? NL + NL + 'Your unsaved changes go with them.' : ''))) return;
      pending = null;
      pushSettings({ reset: 'points' }, function () { render(); });
    });
    gm.appendChild(qReset);
    wrap.appendChild(gm);

    /* ---------------- this machine ---------------- */
    wrap.appendChild(saveBar);
    paintSaveBar();

    var pcard = el('div', 'card-block');
    var phead = el('div', 'flex-between');
    phead.appendChild(el('div', 'card-title', 'This device'));
    phead.appendChild(infoDot(
      'Times are kept per song, per level AND per device. A thumb on glass and ' +
      'ten fingers on a keyboard are not the same measurement, and this app will ' +
      'never average the two together.'));
    pcard.appendChild(phead);

    var devRow = el('div');
    var devBtns = el('div', 'random-row seg-even');
    function paintDevice() {
      var forced = lsGet('device');
      var live = deviceNow();
      devRow.innerHTML =
        '<div class="mastery-head"><div class="mastery-num">' +
        (live === 'desktop' ? '&#9744;' : '&#9634;') + '</div>' +
        '<div><div class="mastery-word">' + esc(deviceLabel(live)) + '</div>' +
        '<div class="insight-song-sub">' +
        (forced ? 'set by hand, on this device only' : 'detected from the pointer, not the screen size') +
        ' &middot; timed as ' + esc(timingLabel(timingDevice())) +
        '</div></div></div>';
    }
    function paintDevBtns() {
      devBtns.innerHTML = '';
      var forced = lsGet('device') || '';
      var opts = [['phone', 'Phone'], ['tablet', 'Tablet'],
                  ['desktop', 'PC'], ['', 'Auto']];
      for (var dv = 0; dv < opts.length; dv++) {
        (function (o) {
          var on = forced === o[0];
          var b = el('button', 'btn btn-sm ' + (on ? 'btn-primary' : 'btn-outline'), o[1]);
          b.addEventListener('click', function () {
            if (o[0]) lsSet('device', o[0]); else lsDrop('device');
            /* The layout follows the answer immediately, because the setting
               you just changed is one you can only judge by looking at the
               screen it changes. */
            paintFormFactor();
            paintDevice(); paintDevBtns();
            toast('Counting this as a ' + deviceLabel(deviceNow()));
          });
          devBtns.appendChild(b);
        })(opts[dv]);
      }
    }
    paintDevice(); paintDevBtns();
    pcard.appendChild(devRow);
    pcard.appendChild(devBtns);
    pcard.appendChild(el('p', 'form-hint',
      'Detection reads the primary pointer, which a touchscreen laptop or a ' +
      'tablet with a keyboard can get wrong - hence the override. It applies ' +
      'to runs from here on; attempts already recorded keep the device they ' +
      'were taken on.'));
    pcard.appendChild(el('p', 'form-hint',
      'Phone and tablet are TIMED TOGETHER - a thumb is a thumb, and splitting ' +
      'them would halve the evidence behind both medians. The two are told ' +
      'apart for layout only: the game picker stacks its eight games into one ' +
      'column on a phone, where there is no room for two side by side, and a ' +
      'tablet keeps the wider layout a PC gets.'));
    wrap.appendChild(pcard);

    /* ---------------- songs still waiting on a chorus ---------------- */
    var flaggedSongs = [];
    for (var i = 0; i < S.songs.length; i++) if (S.songs[i].needsChorusTag) flaggedSongs.push(S.songs[i]);
    if (flaggedSongs.length) {
      var fc = el('div', 'card-block');
      fc.appendChild(el('div', 'card-title', 'Waiting on a chorus tag (' + flaggedSongs.length + ')'));
      fc.appendChild(el('p', 'form-hint mt-0',
        'Open one and tap the block that is the chorus. Or indent it in the doc and re-import.'));
      for (var j = 0; j < flaggedSongs.length; j++) fc.appendChild(insightRowPlain(flaggedSongs[j]));
      wrap.appendChild(fc);
    }

    /* ---------------- destructive things, behind confirmations ---------------- */
    var danger = el('div', 'card-block');
    danger.appendChild(el('div', 'card-title', 'Reset'));

    danger.appendChild(el('p', 'form-hint mt-0',
      'Clears every quiz attempt and score, for every song. Your songs and lists ' +
      'are untouched. To clear one song only, open it and use Edit.'));
    var clearHist = el('button', 'btn btn-danger btn-block btn-sm', 'Clear all quiz history');
    clearHist.style.marginBottom = '18px';
    clearHist.addEventListener('click', function () {
      if (!confirm('Clear all quiz history? Songs and lists stay as they are.')) return;
      clearHist.disabled = true;
      api('clearAttempts').then(function () { return refreshIndex(); })
        .then(function () { toast('History cleared'); render(); })
        .catch(function (e) { clearHist.disabled = false; toast(e.message); });
    });
    danger.appendChild(clearHist);

    danger.appendChild(el('p', 'form-hint',
      'Removes every song and all quiz history, so the doc can be imported clean ' +
      'after wholesale changes. Lists survive but come back empty. There is no undo ' +
      'short of re-importing.'));
    var clearAll = el('button', 'btn btn-danger btn-block btn-sm',
      'Clear all songs (' + S.songs.length + ')');
    clearAll.addEventListener('click', function () {
      if (!S.songs.length) { toast('The library is already empty'); return; }
      if (!confirm('Delete all ' + S.songs.length + ' songs and every quiz score?' + NL + NL +
                   'Your Google Doc is not touched - you can re-import afterwards.')) return;
      var typed = prompt('Type ERASE to confirm.');
      if (typed !== 'ERASE') { toast('Cancelled'); return; }
      clearAll.disabled = true;
      clearAll.textContent = 'Clearing...';
      api('clearAllSongs').then(function (r) {
        dropAllSongs();
        return refreshIndex().then(function () { return r; });
      }).then(function (r) {
        toast('Removed ' + r.removed + ' songs');
        resetTo('settings');
      }).catch(function (e) {
        clearAll.disabled = false;
        clearAll.textContent = 'Clear all songs';
        toast(e.message);
      });
    });
    danger.appendChild(clearAll);
    wrap.appendChild(danger);

    appEl.appendChild(wrap);
    buildFooter();
  };

  function insightRowPlain(s) {
    var row = el('div', 'insight-song-row');
    row.innerHTML = '<div style="flex:1"><div class="insight-song-name">' + esc(s.title) +
      '</div><div class="insight-song-sub">' + esc(s.artist || '') + '</div></div>' +
      '<span style="color:var(--gold)">&#9873;</span>';
    row.addEventListener('click', function () { go('detail', { id: s.id }); });
    return row;
  }

  /* ============================================================
     Boot
     ============================================================ */
  function refreshIndex() {
    var storedN = lsGet('pointsShown');
    if (storedN !== null && !isNaN(Number(storedN))) S.pointsShown = Number(storedN);
    var storedL = lsGet('logShown');
    if (storedL !== null && !isNaN(Number(storedL))) S.logShown = Number(storedL);
    var storedK = lsGet('logKind');
    if (typeof storedK === 'string') S.logKind = storedK;
    var storedW = lsGet('insightWindow');
    if (storedW !== null && !isNaN(Number(storedW))) S.insightWindow = Number(storedW);
    var storedM = lsGet('statMode');
    if (typeof storedM === 'string') S.statMode = storedM;
    return api('init').then(function (d) {
      S.build = d.build;
      S.retired = d.retired || {};
      S.families = d.families || [];
      S.earned = d.earned || {};
      S.firstAttempt = d.firstAttempt || null;
      S.songs = d.songs;
      S.lists = d.lists;
      S.lastImport = d.lastImport;
      S.docUrl = d.docUrl;
      S.docTitle = d.docTitle || '';
      S.sheetUrl = d.sheetUrl;
      S.settings = d.settings || { decay: 1, floor: 75, games: {}, quizzes: {} };
      S.modes = d.modes || [];
      S.timing = d.timing || [];
      S.modeStats = d.modeStats || [];
      /* The index that just arrived was built after every write that has
         finished, so the receipts it covers are redundant - and holding them
         any longer would keep saying "spent" through midnight into a day that
         is genuinely open again. Anything still in flight keeps its receipt. */
      if (S.saving <= 0) S.spent = {};
      lsSet('index', {
        v: CACHE_VERSION,
        build: S.build, songs: S.songs, lists: S.lists, settings: S.settings,
        modes: S.modes, lastImport: S.lastImport, docUrl: S.docUrl,
        docTitle: S.docTitle, sheetUrl: S.sheetUrl
      });
    });
  }

  /**
   * Boot with one automatic retry. A transient Apps Script or Sheets hiccup
   * used to surface as an empty library, which reads exactly like "my data is
   * gone" - so a failure now says so, keeps the real error on screen, and
   * offers a retry instead of silently rendering nothing.
   */
  function showLoadFailure(msg, attempt) {
    appEl.innerHTML = '';
    var box = el('div', 'card-block');
    box.innerHTML =
      '<div class="card-title">Could not reach your songbook</div>' +
      '<p class="form-hint mt-0">Your songs are stored in the Sheet, not on this device, ' +
      'so nothing has been lost - this is the app failing to read them.</p>' +
      '<p class="form-hint" style="color:var(--incorrect)"><strong>Error:</strong> ' + esc(msg) + '</p>' +
      (attempt > 1 ? '<p class="form-hint">Retried once already.</p>' : '');
    var again = el('button', 'btn btn-primary btn-block', 'Try again');
    again.addEventListener('click', function () { boot(1); });
    box.appendChild(again);
    appEl.appendChild(box);
    buildFooter();
  }

  function boot(attempt) {
    // WHAT KIND OF MACHINE THIS IS, BEFORE ANYTHING IS DRAWN. The class decides
    // how the game picker lays out, so setting it after the first render would
    // paint the wrong layout and then correct it in front of you.
    paintFormFactor();
    // Paint from the stored index immediately, then reconcile with the server.
    var cached = attempt === 1 ? lsGet('index') : null;
    // A stale index means the stored SONGS are stale too - they were written
    // by an older build and can be missing fields this one draws with. Bumping
    // the version has to take both, or the songs outlive the index that
    // vouched for them.
    if (cached && cached.v !== CACHE_VERSION) { cached = null; dropAllSongs(); }
    if (cached && cached.songs && cached.songs.length) {
      S.songs = cached.songs;
      S.lists = cached.lists || [];
      S.settings = cached.settings || S.settings;
      S.modes = cached.modes || [];
      S.lastImport = cached.lastImport || '';
      S.docUrl = cached.docUrl || '';
      S.docTitle = cached.docTitle || '';
      S.sheetUrl = cached.sheetUrl || '';
      S.build = cached.build || '';
      render();
      refreshIndex().then(function () {
        repaintIfSafe();
        prefetchBurners();
      }).catch(function () {});
      return;
    }
    appEl.innerHTML = '<div class="loading">Loading your songbook...</div>';
    refreshIndex().then(function () {
      render();
      prefetchBurners();
    }).catch(function (e) {
      if (attempt < 2) {
        setTimeout(function () { boot(attempt + 1); }, 1200);
        return;
      }
      showLoadFailure(e.message, attempt);
    });
  }

  boot(1);
})();
