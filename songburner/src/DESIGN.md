# Song Burner — design notes

Why the app behaves the way it does. Installing and deploying it is
[SETUP.md](SETUP.md); this is everything else.

Ordered by subsystem rather than by when it was built, so the reasoning behind
one part of the app is in one place. Most of it is written as plain description
of how things work — a note only carries a version tag while you might still be
running the build before it, and drops the tag once you are two builds past.

Paragraphs that begin **Generalise:** are the ones worth reading if you read
nothing else. They are the rules that were paid for with a bug.

## Scoring and the economy

Everything below is editable in the app: **gear -> Scoring**. Nothing needs a
redeploy, and changing any of it **rescores every song and its whole history**,
because points are computed from accuracy and mode, never stored. Defaults live
near the top of `Code.gs`; the live values live in the `Meta` tab.

### The ladder

Two shelves. **Quizzes** carry the points; **games** are a few points each and
exist to keep a song from freezing between real sittings.

| Quiz | id | Default points | What is showing |
|---|---|---|---|
| Beginner - Blank Lines | `firstLines` | 5 | Whole lines taken out, with a blank for every letter |
| Beginner - Opening Words | `easy` | 5 | The opening words of each line |
| Easy | `medium` | 10 | Some of the letters of every word - see below |
| Medium | `hard` | 25 | A blank for every letter |
| Hard | `blind` | 50 | Nothing at all |

**THE IDS NEVER MOVE.** That table's second column is not decoration. The ladder
has been relabelled twice — what reads "Easy" today was "Medium" yesterday and
old-Easy before that — but an attempt recorded under `medium` in March has to
keep meaning the same measurement in September. So the id stays put and only the
label and the value change, and `maskForMode` keys off the id. The same applies
to the two Build games, which are still `verseOrder` and `lineOrder` inside.

Every game is worth **1 / 2 / 3** at Easy / Medium / Hard by default, and the
level is chosen on the card when you start it.

A mode is chosen once at the start and **locked** for that run. Quizzes have no
hint button: the ladder itself is the hint system.

**Blank Lines** takes one line out of every verse and chorus and prints the rest
of the section around it. Choosing it asks *which* line: a different one from
each section at random, or the same numbered line throughout (the 1st, the 2nd,
and so on, offered only as deep as the song actually goes; a section shorter
than that gives up its last line instead).

**It shows the blanks, as of 1.31a.** It used to show nothing at all, on the
argument that the section around the gap was help enough. In practice that made
it the only rung on the ladder where you were typing into a void with no idea
whether you were reaching for four words or eleven — which is not the same
difficulty as Hard, it is a different and worse experience of it. The section
around the gap plus the shape of the missing line is the beginner rung it was
always meant to be.

**The settings blob carries a revision number** so a rebalance actually lands. A
blob written before the current revision keeps the dials that are yours — cold
step, floor, hot share, timer swing and gate, options per question — and takes
the new point values and game dials wholesale. Since points are computed from
accuracy and mode rather than stored, **that rescores every song's whole history
on first load**.

Attempts are logged plainly on the song sheet, newest first, with the date, the
mode, the level, the time and the percentage, behind a "how many" dropdown.
Modes that have since been retired still show up under their old name rather
than as a blank.

### The award curve

```
at or below the floor  ->  nothing
100%                   ->  the full mode value
in between             ->  straight line
```

With the floor at 75% and Medium worth 10:

| Accuracy | 74% | 75% | 80% | 87.5% | 90% | 100% |
|---|---|---|---|---|---|---|
| Banked | 0 | 0 | 2.0 | 5.0 | 6.0 | 10.0 |

Scores carry one decimal everywhere except the song-list badge, which rounds.

### Hot, cold, and the compounding decay

A song is in one of two states, and the badge on every card shows which.

**Hot** — resting. It loses nothing. A quiz puts a song here and buys
`hotPct%` of the points it banked, in days, rounded: at the default 10%, a
30-point run buys 3. The flame counts down one a night, and **0 is still
hot** — it is the last day before the song turns.

**Cold** — bleeding. The night a song turns it loses nothing, but it picks up
a rate equal to the cold step `y`. Every night after that the rate comes off
the score and then grows by `y` again: 1, then 2, then 3. The snowflake shows
what tonight costs.

Practising a cold song **pays the rate down before it buys any hot days**, and
**as of 1.53 the payment comes out of the award**. Losing 5 a night and you
bank 3? The rate drops to 2, it stays cold, and the score has not moved — the
three points went where they were owed. Bank 30 and the rate clears for 5,
leaving 25 to go on the score and to convert — 10% of 25 is 2.5, so 3 hot days.

**Generalise: a debt that is forgiven rather than settled inverts the incentive
it was meant to create.** Until 1.53 the whole award went onto the score *and*
cleared the rate, so a song on 20 losing 2 a night answered a 3-point game with
23 points and a free night. The arrears cost nothing to clear, which made the
cheapest run on the most neglected song the best value in the app — the exact
opposite of what a decay model is for. The same song now lands on 21, hot for
today, and the two points are gone.

**The rate is always a whole number.** A game worth 0.3 against a rate of 1
used to leave a song "losing 0.7 a night", which is not a thing anyone wants to
read on a card. What is left after a payment is rounded, and what the payment
*counted for* is derived from the rounding rather than the other way round —
so 0.3 against 5 leaves 5, and 1.9 against 8 leaves 6. That derivation is what
keeps a part-payment honest now that payments cost something: 0.3 cleared
nothing, so 0.3 is charged nothing, and no run can ever be charged more than it
was worth. The cold step is a whole number for the same reason, so the rate
stays whole as it compounds.

The results screen and the attempt log both show **what the score actually
moved by**, with the gross award in the footnote or the tooltip beside it. Two
numbers that were the same until 1.53 are two numbers now, and the arrow
between a before and an after has to agree with the figures either side of it.

Once a score reaches zero the song is **Frozen** and the arrears are wiped.
A song worth nothing owes nothing, so any quiz at all starts it moving again
from a standing start rather than spending its first few points clearing a
debt it cannot see. Frozen songs show a bare snowflake with no number.

Both dials are in Settings: the **cold step** (`y`, default 1) and **hot days**
(`hotPct`, default 10%).

### Medals — 1.50

Four per song — **bronze, silver, gold, platinum** — and they are the only
thing in the app that changes what a run is **worth** rather than what it
unlocks.

The multiplier goes on **hot days**: bronze doubles it, silver trebles it, gold
is four times and platinum five. At the default 10%, a 30-point quiz buys 3 rest
days on a bare song and 15 on a platinum one. A song you have genuinely finished
holds its heat for a fortnight off the same run that buys a stranger a single
day, which is the whole point — the library was rewarding breadth and nothing
else, and there was no mechanical reason ever to finish anything.

| | Bronze | Silver | Gold | Platinum |
|---|---|---|---|---|
| Hot days | ×2 | ×3 | ×4 | ×5 |

**It is deliberately not a points multiplier.** Points are the record of what
you actually did; multiplying them would rewrite your history the moment a medal
landed, and the score-over-time chart would climb for reasons that had nothing
to do with the runs drawn on it. Rest days are a claim about the **future**,
which is the right tense for a reward.

**The multiplier is read as of the attempt, not as of today.** The score walk
replays a song's whole history from nothing, so a gold earned last month must
not retroactively pay for a quiz taken in the spring — the curve on screen would
otherwise bear no relation to the one that was actually lived. `medalMultAt`
answers "what was standing on this date", and the walk asks it once per run.

**Generalise: anything that multiplies a historical replay has to be a function
of the date being replayed, not of the present.**

#### What each one asks for

Every tier is cumulative: silver cannot be held without bronze, and the check is
written that way — the tiers are tested in order and a later one cannot pass
until every earlier one has. That is what makes the dates mean something.

| | Games | Quizzes |
|---|---|---|
| **Bronze** | all eight passed on Easy | both Beginner quizzes at **100%**, Easy passed |
| **Silver** | all eight on Medium; all eight **clean on Easy** | Easy at **100%**, Medium passed |
| **Gold** | all eight on Hard; all eight **clean on Medium** | Medium at **100%**, Hard passed |
| **Platinum** | all eight **clean on Hard** | Hard at **100%** |

"Passed" is **banked**, the same test the ladders use: a run at or under the
floor proves nothing, and a practice run is not in the history at all. "Clean"
is banked **and** 100% — a flawless practice run is still a practice run.

**A song that cannot play a game is not asked for it.** The two verse games need
three sections, so on a shorter song the medals ask for the six that are left.
Requiring all eight would put every medal out of reach of a whole shelf of the
library for a reason that has nothing to do with how well any of it is known.

#### The dates, and why the walk is forward

`medalsFor` walks the history **forward**, accumulating requirements a run at a
time and stamping each tier the first moment it closes — rather than testing the
finished totals, which would be less code. **The date is half the answer.** A
song that has everything a gold needs cannot be told, from the totals alone,
whether that happened last night or eighteen months ago, and the expanded page
promises to say.

#### Where they show

- **Beside the title**, on the library row and on the song page header, at 15px
  and 21px. It is a property of the song in the same way the name is, and it
  rides the cap height rather than taking a band of the card away from the one
  thing on it you actually read. Verified: a card with a medal is exactly as
  tall as one without.
- **Only the highest one.** The tiers are cumulative, so a platinum already
  says the other three were earned; a row of four discs would be four times the
  ink for one fact.
- **The expanded page carries all four**, with the date each landed or, where it
  has not, one line saying what is still outstanding. The unearned tiers are
  drawn in grey rather than hidden: the four of them describe a route through a
  song, and a route with its later stages invisible is not a route.
  Each unearned tier carries a **live checklist** rather than a sentence — 1.52.
  It used to be one line of prose per medal listing everything that tier wanted,
  which is a paragraph you have to re-read and hold in your head every time you
  come back to it. The requirements *are* a list of conditions, each
  independently true or not, and a list with ticks against it can be read at a
  glance. The counted lines carry their count, because "3 of 8" is the
  difference between nearly there and barely started. An **earned** tier drops
  its list and keeps its date: every line on it is ticked by definition, and
  four columns of ticks under a medal you already hold is a lot of ink for
  "yes, still".

  The wording is **passed** and **100%**, never "clean" — 1.52. "Every game on
  Medium and clean on Easy" reads as one condition with a qualifier and it is
  two, and it leaned on a word this app invented for the occasion. Those are the
  only two things a run can be, and the difference between them is the whole
  structure of the medals. The labels are generated from `MEDAL_SPEC` beside the
  rules themselves, so the checklist and the requirement it checks cannot come
  to say different things.

  It sits **below the lyric sheet**, with the Score card and the attempt log.
  The first draft put it above, on the argument that a summary belongs near the
  header; Kyle's call is that the top of that screen is what you came there to
  do — play, quiz, read the words — and the medals are a record of what you have
  already done. They belong with the rest of the record, not between you and the
  song.
- **The run that finishes one says so**, once, in a banner under the outcome
  tiles — and only that run. A banner on every results screen for the rest of
  the song's life would stop being an announcement inside a week.

The disc is drawn in code rather than coloured in CSS. The four differ by two
stops of a gradient and by nothing else, and a class per medal would put those
eight colours somewhere other than the one place that decides what a medal
looks like.

**What a run does with what it banks is the whole balance of the app.** Points
always go onto the score, for a game as much as for a quiz, and they always pay
the nightly loss down first. What happens to the remainder is where the two
shelves part company:

- **A game stops at paying the loss down.** Losing 7 a night and a game banks 3?
  The loss drops to 4 and the song stays cold. Clear the loss outright and the
  song goes hot **for today only** — hot with zero days left. That is worth
  having: it buys back the one free night before the cold bites again, and it
  resets the compounding to the cold step, so a song bleeding 8 a night can be
  ground back to 1 by a few games in a row. But a game can never buy a *day*,
  and a game played on a song that is already hot cannot extend it by so much
  as a night.
- **A quiz pays the loss down and converts what is left into rest days** at the
  hot share. On a song that is already hot the whole award converts and the
  days stack on top of what is there.

One flawless run, at the default cold step of 1:

| Rung | flawless run banks | rest days bought | spent after |
|---|---|---|---|
| any game, Easy | 1 | today only | 2d |
| any game, Medium | 2 | today only | 3d |
| any game, Hard | 3 | today only | 3d |
| First Lines | 5 | 1d | 5d |
| Easy | 10 | 1d | 6d |
| Medium | 25 | 3d | 11d |
| Hard | 50 | 5d | 16d |
| Blind | 100 | 10d | 25d |

Where a song settles after **a year of practice at 90%**, at that cadence and
nothing else:

| Rung | every 1d | every 2d | every 3d | every 5d | every 7d | every 14d |
|---|---|---|---|---|---|---|
| any game, Easy | 219 | 0 | 0 | 0 | 0 | 0 |
| any game, Medium | 438 | 0 | 0 | 0 | 0 | 0 |
| any game, Hard | 657 | 146 | 0 | 0 | 0 | 0 |
| First Lines | 1095 | 364 | 0 | 0 | 0 | 0 |
| Easy | 2190 | 1092 | 365 | 0 | 0 | 0 |
| Medium | 5475 | 2730 | 1695 | 660 | 5 | 0 |
| Hard | 10950 | 5460 | 3630 | 2117 | 1248 | 0 |
| Blind | 21900 | 10920 | 7260 | 4380 | 3120 | 632 |

**That table is the design in one picture.** Games hold a song at a daily
cadence and a Hard game just about holds a two-day one; past that they cannot
keep up with the compounding at all. They are a holding action, not progress.
Quizzes buy real time: Blind survives a fortnight between sittings, Hard about
a week, Medium five days.

It also means **most of a 242-song library will sit at zero and cold**, because
you cannot come round to all of it fast enough. That is not a bug.

**The top of the table is uncapped and always has been.** Quiz something more
often than its rest days and the score climbs forever. Every colour in the app
is percentile-based rather than threshold-based precisely because of this, but a
single runaway song will still flatten the scale for everything else. The dial
is **hot days** (`hotPct`): drop it and rest days shrink, so songs cool between
sittings and the scores settle.

### What a medal is worth is a dial — 1.63

The hot share and the four multipliers were the last numbers in the economy
that could only be changed by editing `Code.gs`. They are in the settings blob
now, tuned in **one** panel, because they are not two settings that happen to
sit near each other — they are a base and its coefficients, and the only figure
that matters is their product. On separate screens you do that multiplication
in your head every time, against a points value you also have to remember,
which is how the medals came to be worth whatever they were worth rather than
what anybody chose.

So the panel states the **product**. Every line is a real sentence about a real
run: a flawless run at the top quiz rung, on a song holding that medal, buys
this many days. Change any dial and every line moves. Days rather than
multipliers, because the multiplier is the input and days are the thing you
actually have an opinion about — "three times something" is not a quantity
anyone can judge; eleven days against fifteen is.

Read **above the revision gate**, with the heatmap dials and for the same
reason: what a medal is worth to you is not part of a balance somebody else
ships, and a rebalance has no business resetting it. Absent from every blob
written before 1.63, so each falls back to its default — which is why this
needed no `SETTINGS_REV` bump, only a `CACHE_VERSION` one.

The page stopped carrying its own copy of the numbers at the same time. `MEDAL_X`
was a second hard-coded table, which was harmless for exactly as long as neither
copy could change. Both can now.

### A 100% carries the rungs under it — 1.62

100% on Hard is not evidence that you could pass Easy, it is a **stricter
version of the same evidence**. Same song, same questions; the only thing Hard
changed was how much help you were given. Asking someone who has just dropped
nothing on Hard to go back and drop nothing on Easy is not a requirement, it is
a chore — and a good share of the medal checklist was made of exactly those
chores.

So a run at 100% now ticks every rung at or below the one it was taken on, for
both the **passed** and the **flawless** books. Anything less than 100% is left
alone: 90% on Hard says nothing certain about Easy, because the ten percent you
dropped might be the whole of what Easy was going to ask.

On the quiz side it is **strictly below**, by the `tier` a rung declares rather
than by its position in the list. The two Beginner quizzes share tier 0, so
100% on either one carries neither — they are two different questions about the
same song, not two heights of one question. Everything above them carries both.

The rule is one function with two callers, and they are callers that must never
disagree: `medalsFor`, which decides what you have earned, and `progressFor`,
which decides what the picker ticks and how wide the pips on a song card are
drawn. Two copies would be two answers to "have I finished Easy". It is
retroactive by construction, like everything else here — both callers replay the
whole history from nothing, so a medal this opens up is dated **the day the
flawless run actually happened**, not today.

### The platinum disc is not just two stops — 1.61

The four medals used to differ by the two ends of one gradient and by nothing
else, which was the right rule and produced one wrong result: at 15px beside a
song title, **platinum and silver were the same badge**. Both are a grey-white
disc with a slightly darker grey rim, and about eight percent of lightness was
all that separated the hardest thing in the app from the middle of the ladder.

Platinum now has a **cold blue rim and ribbon** and two marks the other three
do not carry: a halo outside the disc, and a star where they have an inner
ring. Shape, not only colour — the badge is drawn at 15px on a phone, where a
hue is the first thing to go and a silhouette survives. The end-of-run card
stops sharing silver's paint as well, and takes a ring outside its border.

Its entry in `MEDAL_INK` carries a **third** value, which is the colour the
disc fades to, held apart from the colour of the rim and the ribbon. Everywhere
else those are the same thing and two stops are enough. Platinum needs them
separated because the rim has to be dark enough to be unmistakable at 15px
while the face stays near-white: a disc filled to its own rim colour reads as a
blue medal, which is a different object from the coldest metal on the shelf. A
tier with no third value fades to its rim colour, exactly as all four used to.

**Generalise: a set that varies along one axis is only legible while that axis
is wide enough to carry the whole set.** Four tiers on lightness alone ran out
of room at the top, and the fix is not a darker grey, it is a second axis.

### Colours

Two independent percentile scales, both drawn across the **whole pantry**,
not the list on screen — so a colour means the same thing on a burner, in the
Library, and inside a filtered list. Filtering to eight strong songs used to
re-spread the colours across just those eight, so the weakest of them showed
rust while actually being fine.

- **Score plate** — blue at the bottom, gold at the median, red at the top, so
  it reads on the same axis as the flame and the snowflake underneath it.
  **Every plate in the app is drawn against `libraryScale()` — 1.50a.** The song
  page header was the one that was not: it called `scoreColor` with no scale at
  all, and the no-scale fallback is the frozen blue, which is the right answer
  for a song with nothing on the board and quite wrong for one with 111 points
  on it. So a song that read hot orange on the burner turned blue the moment you
  opened it. The bar chart on Insights had a milder version of the same fault,
  spreading its colours across the ten songs on screen. Bar *lengths* are
  relative to what is shown — that is what a top-ten chart is for — but colours
  never are.

  **Generalise: a percentile colour is meaningless unless every screen spreads it
  across the same population.** If a function takes the population as an
  argument, every caller has to pass it, and the fallback for "none given"
  should be as loud as possible rather than a plausible colour. A
  cold song looks cold and a hot one looks hot, whichever half you glance at.
  Songs at zero are painted blue and **left out of the spread**; leaving them
  in drags the median to zero, and then everything with any points at all
  reads gold-to-green and the rust end becomes unreachable. Untested songs
  stay grey and sit outside the scale entirely.
- **Heat chip** — hot days ramp pale grey through ember to red; cold rates
  ramp pale grey through steel to deep blue. Each has its own spread, so "a
  lot" means a lot compared to everything else you are carrying.
- **The card itself** — a hot song is printed on very pale red paper with an
  ember stripe, a cold one on very pale blue with a blue stripe, and a frozen
  one takes a deeper blue stripe. Untouched songs stay on plain paper. It says
  the same thing the badge does, but it survives a glance while scrolling,
  which the badge does not. On both burners and in the pantry.

### A game attempt with no level is an Easy one — 1.42

Kyle found a song whose Order Verses ladder had Medium unlocked while the
picker showed **0 tries at every level**. Both were reading the same two runs
from 2026-08-18, and disagreeing about them.

Those rows carry an **empty level column** — written before the games grew
levels, and re-labelled onto today's mode ids by `modeOfRow` on the way out.
The two halves of the app then read the gap differently. `levelIndex` has always
defaulted a missing level to Easy, so the runs DID count as Easy runs and DID
unlock Medium. The picker looked up `verseSort|easy`, found nothing under that
key, and reported the level as untried. One run, two answers — and the ladder,
which was right, was the half that looked broken.

It is an inference either way; the only question is whether the whole app makes
the same one. So it is made in one place now, `levelOfRow(mode, raw)`, which
every read of a stored level goes through, and `levelIndex` agrees with it by
construction. A quiz keeps an empty level, because a quiz genuinely has none.

Two details that were easy to get wrong and are worth keeping:

- **Resolve the mode before reading the level.** The raw `mode` column is empty
  on exactly the legacy rows this is for, so `levelOfRow(row.mode, ...)` would
  decline to fix the only rows that need fixing. It has to be
  `levelOfRow(modeOfRow(row), ...)`.
- **Nothing writes a level-less game row any more** — `finishQuiz` stamps
  `level || 'easy'` on every game attempt. This is a read-side repair for
  history, not a patch over a live fault.

**Generalise: when two parts of an app fill the same gap with a default, they
have to share the default.** Two reasonable guesses about missing data are worse
than one, because the disagreement surfaces as a bug in whichever half you
happen to be looking at.

### Legacy attempts

Attempts written before the ladder grew carry the old tier names, which meant
different things. They are remapped on read — old easy to Medium, old medium to
Hard, old hard to Blind — and new attempts record the mode in its own `mode`
column, so the two can never be confused.

## Earning your way up, and the one a day

Two rules arrived together in 1.3a, and they only make sense as a pair: you have
to **earn** the harder levels, and you only get **one scoring go a day** at each
thing. The first stops you jumping to Hard on a song you have never sung; the
second stops a good day of grinding from standing in for a month of practice.

### The ladders

- **Games: one ladder per game, per song.** Eight of them, each on its own.
  Bank points on a game's Easy and its Medium opens; bank on Medium and Hard
  opens. Beating Order Verses says nothing about whether you can hold Scramble
  Words together, so it opens nothing *there* — but it does open the next game
  along, which is the chain below.
- **Quizzes: one ladder per song**, four rungs — the two Beginner quizzes, then
  Easy, Medium, Hard. The two Beginner quizzes are alternatives at the same
  height rather than steps, which is why the picker sets them side by side.

#### The chain — 1.50

**A fresh song offers exactly one thing: Order Verses on Easy.** Everything else
— seven games, three levels each, and the whole quiz shelf — is shut.

Banking on a game opens **the next game in the chain at Easy**, and opens
**Medium on the game you just passed**. Banking on that Medium opens its Hard.
So the eight are walked *across* before they are walked *up*:

```
Order Verses → Build Verses → Scramble Lines → Impostor Lines
             → Order Lines → Build Lines → Scramble Words → Impostor Words
```

The order is roughly how much of the song each one demands: whole sections
first, then lines, then individual words, with the two verse games at the head
because they are the only ones you can play knowing the shape of a song and not
much else. Twenty-four buttons on a song you have never sung was a menu, not a
route; this is a route.

**A song that cannot play a game is not in the chain at all.** The two verse
games need three sections, so on a shorter song the chain starts at Scramble
Lines. Otherwise the head of the list would be a locked door with no key and the
song would offer nothing, forever.

**Both Beginner quizzes are behind the whole games shelf.** Typing a song back
from memory is a different order of ask from tapping cards into order, and going
straight to it on a song you have never played is how a first sitting ends in a
blank page. Every playable game passed on Easy is the receipt for having been
round the song once. `quizTier` comes back as **-1** while that is outstanding
rather than 0, so the ordinary "is this rung above what is open" comparison
already covers it and nothing had to learn a second rule.

**Within a game nothing changed.** The rule is still "one rung above the highest
you have ever banked at", so a song with years behind it arrives unlocked to
wherever it had got to and nobody is marched back down a ladder they had already
climbed.

**Every lock says what opens it**, in the words that say what to do: *Opens when
you bank points on Impostor Lines*. `lockReason` is one function and the picker,
the level sheet and the tooltips all read it, because the two doors into a game
disagreeing about why it is shut is precisely the bug that shape invites. **A
game this song cannot play is not tagged as locked** — the sections message is
the real reason, and two explanations for one absence, one of which implies
there is something you could do about it, is worse than either alone.

Random Game and the strip on the card both know about the chain: the button will
not draw a game it would then refuse you, and a pip for a game not yet reached
sits **below** the Easy height in the border colour rather than painting as an
open Easy, which is the one thing the strip is there to tell you apart.

#### A level cleared without dropping a mark

A **star each side of the level name** — ★Easy★ — and a hairline of gold around
the button: colour and mark twice over, the way the pips do it, so it survives
being read in grey. It is the same fact the medals are built out of, so it is
gathered once in `progressFor` rather than worked out twice from two readings of
the same rows.

A star rather than a tick: a tick already means *done* everywhere else on that
screen — the spent tag, the save receipt — and a second meaning for it would
make both ambiguous. 100% is not "done", it is done perfectly, which is a
different claim and deserves a different glyph.

**One each side, not one trailing — 1.50a.** The level names are centred in
their buttons, so a single star after the name pulled Easy a few pixels left of
where Med and Hard were sitting: three buttons in a column with their labels at
different offsets depending on history. A pair is symmetric and the name does
not move. Measured: the three labels sit at identical centre offsets with and
without the mark.

**Generalise: a decoration on a centred label has to be symmetric, or it is a
layout change wearing a decoration's clothes.**

**Banking is the test, not attempting.** A run at or under the floor earns
nothing and opens nothing. Practice opens nothing either, ever.

### One a day

- **Each game**, on each song, may be taken **once a day for credit**.
- **Each song** allows **one scoring quiz a day** — any rung, you choose which.

Practice is unlimited on anything unlocked, at any time, before or after the
day's credit is spent. It banks nothing, records nothing, and unlocks nothing.

**Backing out of a credit run forfeits it, and the day is spent.** The way out
asks first, and if you take it a forfeit is written. Without the written row
there would be no cost, and a credit run would be re-rollable until the board
looked friendly.

### The receipt, and the race it closes

Both ladders and the one-a-day are **derived from the attempt history**, which
is the right design and had one hole. Between the app writing a row and the
index coming back carrying it, the index still says the day is open. Finish a
run, tap **More practice**, and you are back in the picker inside a
second — well before a Sheets write and a full index rebuild have landed — and it
would cheerfully sell you a second credit run on a day you had already spent.
It even showed the attempt you had just made while doing it.

Two things fixed it, and they are deliberately different in kind:

**The receipt.** `S.spent` is a session-local set of `songId|mode` keys, written
the instant an attempt is *dispatched*, before the network is touched. It is the
receipt in your hand while the shop updates its ledger. It is purely additive —
it can say a day is spent when the server has not caught up, but it can never
say a day is free that the server says is spent — and it is thrown away the
moment a refresh lands with no writes outstanding, so it cannot carry a stale
"spent" through midnight into a day that is genuinely open. If the write
**fails**, the receipt is torn up again: no row was written, so the day is not
spent, and keeping it would lock you out of a credit run you never got.

**Saying so on screen.** The results screen carries a line that reads
*Logging this run...*, then *Logged. That is today spent on it.*, or *Not written
to the sheet* with a **Send it again** button. Nothing is hidden behind a
spinner you cannot see.

**Two structural rules came out of building it**, and both were bugs first:

- **A write's failure handler must only ever see the write failing.** The
  success path was `.then(...).catch(...)`, so anything that went wrong while
  *painting* the success — and the outcome panel reads a dozen fields off the
  reply — fell into the failure branch. A row that was safely written reported
  itself as unwritten, put a retry button under it, and offered to write it a
  second time. A flaky read could have doubled a score. It is
  `.then(onOk, onFail)` now: a throw inside `onOk` cannot reach `onFail`.
- **Refreshing the index is a separate concern with its own catch.** Chained
  onto the write, a failed refresh reported the write as failed. Nothing after a
  successful write can un-succeed it.

### Where all this is stored

**Nowhere.** Every bit of it — what is unlocked, what has been spent today, and
as of 1.50 which medals a song holds and when each one landed — is derived from
the attempt history on read. There is no unlock table to migrate,
no daily counter to reset at midnight, and no way for the two to disagree with
the runs that produced them. It also means a library with years behind it
arrives already unlocked to wherever it had got to.

The unlock rule is read as **"one above the highest rung you have ever banked
at"**, not "did you bank at exactly the rung below". That is deliberate: a song
you once took at Hard does not have to be re-earned from the bottom.

### The card, the header and the results row — 1.43

**A song reads the same way on every screen it appears on.** The library row,
the song page header and the results screen were three different vocabularies
for the same handful of facts.

**The earned-progress block is labelled now.** It was eight unlabelled pips and
four blank bars, which meant knowing which pip was which by counting from the
left in the order the picker happens to lay them out. It is four rows — the
family initial, that family's two pips, and the quiz rung at the same height:

```
O |pips| H      Order      / Hard
B |pips| M      Build      / Medium
S |pips| E      Scramble   / Easy
I |pips| B      Impostor   / Beginner
```

Pip height AND colour both say the level, so it survives being read in grey;
hollow means the day is spent. It sits beside the title rather than under it,
which gave the song name back the room it had been losing.

1.43 labelled the rows with initials — O B S I down one side, H M E B down the
other — and 1.43a took them off again at Kyle's call: eight characters of
scaffolding around a block small enough to learn in a day, when the tooltips
already name every one of them on hover. **The shape is the label.** Worth
remembering as a bias to check: the instinct to annotate a compact visual is
usually the instinct to make it bigger.

**Both sides of the block read the way the menus do — 1.52a.** Order at the top
down to Impostor, Beginner at the top down to Hard: the order the game picker
lays its four family cards out in, and the order the quiz shelf stacks its
rungs.

1.43b had both halves climbing from the bottom instead — Impostor / Scramble /
Build / Order, with Hard at the top — on the argument that the two sides of one
block should agree about which direction was "up". They did agree: with each
other, and with nothing else in the app. **The block is a miniature of two
screens you look at every day, and a miniature that runs the other way up from
the thing it depicts costs a mental flip every single time.** Agreeing with the
menus is worth more than agreeing with an abstraction about difficulty.

Not one colour changed with the flip, and that is the payoff of a rule set
earlier: a rung is coloured by **which rung it is**, never by where it sits or
by how many are lit. Beginner is blue and Hard is red on every card whichever
way the stack is drawn. The cool end is simply at the top now.

**Generalise: encode by identity, not by position, and you can rearrange the
thing later for free.**

**The buttons are one column of three — 1.43b.** Back, front, then lists
underneath rather than off to the side. It reads as one stack instead of a stack
with a passenger, and it costs one column instead of two.

**And that is what let the phone keep the desktop layout.** 1.43 wrapped the
block onto its own line below 560px, because four columns sharing 311px left the
title about 105px — five characters a line. Folding the lists button into the
stack, plus a size down on the gaps and the title, brings the title back to
178px on the same single row. The card now reads the same on a phone as on a
desk, which was the point of it.

**Generalise: measure a desktop mockup at phone width before shipping it — but
reach for a narrower column before a different layout.** The first fix here was
a reflow, and the better fix was 40px.

**The header IS the library row, at full size — 1.43a.** It was a black slab,
which made the screen you spend the most time on the only one where a song did
not carry its own temperature. Same paper, same gold spine, same red-for-hot and
blue-for-cold wash, and no tint at all on a song never played — verified against
the card so the two cannot drift.

**The song page header carries what the row carries.** Opening a song used to
lose every fact the library had been telling you about it and leave a black box
with the title in it. Same plate, same heat chip, same progress block, same
burner and list buttons in the same corner. Underneath, one row of four: Start
Game and Start Quiz wide and equal, Songbook and Edit narrower and equal.

**The results screen is a row of tiles, not a column of sentences.** Three
stacked paragraphs of prose is a lot of reading for a screen you look at for
four seconds on your way to the next game. The same facts fit across one row:
what you played and how long it took, how that pace reads, what it moved the
song from and to, and whether it is in the book. Games get the same row with the
timing tiles absent, because a game is not timed — nothing in the component is
game-specific or quiz-specific, and a tile with nothing to say does not appear.

**The move the song made is the headline — 1.43c**, so it is drawn like one:
the score boxes are display type at 27px rather than 15px. The other tiles are
context for that number, and at the same size it read as one more footnote.

**A game reports what was left on the clock — 1.43c.** A game is not timed in
the sense a quiz is — no seconds are stored, nothing is paced — but it is played
against a countdown, and how close you came to running out is the only pace
figure it has. It sits under the level. The figure has to be captured as the
clock is STOPPED rather than read afterwards, because every finish path tears
the countdown down before it grades; null means there was no clock at all, and
a practice run reporting "0s left" would be inventing a defeat.

**Next game counts what is still on the table — 1.43c.** It draws at random from
the unspent games and gave no sense of how deep that pool still was, so it now
carries 6/8. Two things fell out: the button label is HTML now, so `pressBusy`
had to save and restore `innerHTML` rather than `textContent` or the count chip
vanished the first time you pressed it.

**One view, two names — 1.43c.** The play screen serves both shelves and was
titled Quiz over every game in the app. The title comes from what is on the
screen now, not from the route.

Two structural notes on it:

- **The tiles and the receipt are siblings, not nested.** They are painted by
  different things at different times — the receipt the instant the write is
  dispatched, the tiles when the server answers — so either one owning the
  other means one repaint can wipe the other out.
- **The receipt puts its state class ON TOP of its tile classes.** Assigning
  `className` wholesale was safe while it owned its own div and is not any more.

### Pip width is the third thing — 1.62

A pip on a song card already said two things: **height** is how far up the
ladder that game is unlocked, **fill** is whether today's scoring run is still
there. Neither could say the one fact left over, which is whether the rung you
are standing on was cleared **without dropping a mark**.

So width says it. A pip is narrow until that level has been taken at 100% and
steps out to nearly double when it has — and narrow is now narrower than the
old single width, so the strip reads quieter than it did until there is
something to say. A finished game is a fat bar in a row of thin ones, which is
findable at a glance down a list of forty songs.

**A pip is a stack of segments, one per level — 1.62b.** The width above hung on
the pip as a whole, which could only ever describe **one** level — the top one
unlocked — and threw away the two underneath it. A game sitting at Hard has
three separate answers to "was this cleared without dropping a mark", and there
was room for all three the moment the pip stopped being a single bar.

So: one segment per level unlocked, Easy at the bottom, each carrying its own
width. Clean all the way up is a fat bar; clean only at Easy is a foot with a
thin shaft above it. The shape is the reading — nothing has to be counted.

**The heights are exactly what they were.** Segments are 6px with a 1px overlap,
so one is 6, two are 11, three are 16 — the three heights this strip has always
drawn. A game with nothing at 100% looks precisely as it did before: the
segments share a colour and a width, so they fuse into the single bar they used
to be, and the new encoding shows up only when it has something to say. The
overlap also collapses the borders, which matters because spent pips are drawn
hollow and every seam would otherwise be a two-pixel double line.

**Only the ends of the stack are rounded**, and that one is worth keeping.
Giving every segment its own radius is the obvious way to write it, and it was
fine with one segment and wrong with three: the corners meet at the seams and
pinch the bar into a string of beads, so the pip that was meant to look
*identical* to the bar it replaced came out looking like a caterpillar. Square
seams, rounded ends. **The only edge you can see is one the data put there.**

**Generalise: when one element becomes several, every decoration written for the
single case becomes a seam.** The radius was not wrong when it was written; it
stopped being right when the thing it decorated stopped being one thing.

One colour for the whole stack, taken from the top level unlocked. The segments
are levels, not a second colour key — giving each its own colour would paint a
blue-gold-red flag on every game in the library and drown the thing the strip is
actually scanned for, which is how high the bar goes.

Note that the **wide segments are always a contiguous block at the bottom**, and
not by drawing: the 1.62 cascade means 100% at a level implies 100% at every
level below it, so a gap in the middle cannot arise from the data. The renderer
asks each segment about its own level regardless, so if that rule ever changes
the picture follows it without being touched.

**A narrow pip keeps a wide pip's slot — 1.62a.** Varying the width alone made
the whole block wobble. The grid is right-aligned, so a row holding two narrow
pips is four pixels shorter than a row holding two wide ones and starts four
pixels further in; four rows of that is a ragged left edge on every song card.
The eye reads the raggedness long before it reads the widths, which is the one
thing the width was added to say. A margin makes up the difference now, so every
pip occupies nine pixels whatever it draws inside them and the bar sits centred
in its own slot. Every row is the same width by construction and the block has
one left edge again.

**Generalise: a value encoded in an element's SIZE is also encoded in the
position of everything after it.** Height got away with it because the pips sit
on a shared baseline and nothing follows them downwards. Width did not, and the
side effect was louder than the signal.

### Reading it off a song card

The line under the artist used to say your last percentage and when. The log
says that properly now, so the space holds a **progress strip** instead: eight
pips in family pairs, one per game, then the quiz ladder.

- **Height and colour** are how far you have unlocked: short and blue for Easy,
  taller and gold for Medium, tallest and red for Hard. Two encodings of one
  fact, so it survives being read in a hurry or in grey.
- **Fill** is today. Solid means a scoring run is still there for the taking;
  hollow means you have spent it.

The **quiz ladder** gets a column of its own, standing the full height of the
burner stack opposite it — four rungs, one per rung of the quiz shelf, filling
from the top as far as you have earned. Four, not five: the two Beginner
quizzes are one tier and unlock together, so a fifth rung would be a step you
could never be standing on.

**The rungs are shaded blue at Beginner through to red at Hard** — blue, gold,
orange, red — the same run of colour the score plate and the game pips already
use, so the whole card is read with one key. A rung is coloured by *which* rung
it is, not by how many are lit or by where it sits, so the Hard rung is the same
red on every song and two cards can be compared without counting.

**Once the day's quiz is spent the colour goes and the lit rungs turn a dark
grey**, against the pale grey of the ones you have not earned. They used to
both go to the border colour, which threw away the one fact the ladder is for:
there is nothing on offer today, but how far you have climbed is still true.

Everything has a tooltip spelling it out.

## The games

Eight of them, in four families of two: Order, Build, Scramble, Impostor. Each
family asks one question of two different units — verses or lines, words or
lines — which is why the picker draws them side by side and why the Settings
screen tunes them as pairs.

**The bigger chunk goes on the left, in every family.** Order and Build have
always read Verses then Lines; Scramble and Impostor read Words then Lines,
which put the smaller unit first in half the picker and left the four cards
disagreeing about which way the axis ran. They read Lines then Words as of 1.41.
Only the order in `QUIZ_MODES` moved — the ids did not, so no attempt in the
history means anything different.

### Games and quizzes

**Games** are tapping and recognition. **Quizzes** are typing — the real test.
Nothing is ever averaged across the two: a game that walks six verses and a
quiz that makes you type four hundred words have no common unit.

Games pay down what a song is losing each night and can hold it at today; only
a quiz buys it a day off. See **Hot, cold and the compounding decay** above —
that split is what stops a pile of cheap games standing in for practice.

**Games run against a countdown; quizzes against a stopwatch.** The difference
is what the clock is *for*. A quiz is timed to measure you, and the measurement
only counts if you ask for it. A game is timed to press you, and the limit is
part of the difficulty.

**A game's limit is a rate, not a number.** A two-verse song and a nine-verse
one cannot share a stopwatch, so each game states what it charges per unit of
whatever it walks you through — seconds per verse, per line, or per word — and
the limit for a given song is that rate times what the song actually holds. The
picker prints the resulting figure on every level of every game, so you know
what you are agreeing to before you start.

| Game | Charged per | Easy | Medium | Hard |
|---|---|---|---|---|
| Order Verses | section | 22s | 16s | 11s |
| Order Lines | line | 7s | 5s | 3.5s |
| Build Verses | section | 26s | 19s | 13s |
| Build Lines | line | 11s | 8s | 5.5s |
| Scramble Words | word | 1.6s | 1.3s | 1s |
| Scramble Lines | line | 9s | 7s | 5s |
| Impostor Words | word | 1.3s | 1s | 0.8s |
| Impostor Lines | line | 7s | 5s | 3.5s |

Every one of those is a first guess and every one is tunable under **gear →
Games**, where the dial shows what the rate works out to on a real song from
your library rather than leaving you to do the multiplication.

**When the clock runs out the board is graded exactly as it stands.** Anything
unplaced or unanswered counts wrong. In the section-at-a-time games the section
on screen is graded and the ones you never reached count for nothing — which
matters more than it looks, because an untouched Impostor board would otherwise
score every real line correct simply because you never flagged it, handing out
most of its marks as a reward for running out of time.

The countdown pauses while the app is in the background, like the quiz clock. A
phone call should not cost you the run.

### Build stops telling you — 1.62

Every choice used to mark itself the instant you made it: green if you had it,
red plus the green one if you did not, then the next question arrived on its
own. Two things were wrong with that, and they are the same thing said twice.

**It answered the question it had just asked.** A game whose wrong options are
tampered copies of your own lyrics is asking you to read carefully, and being
shown the right line half a second later means the reading never has to be
finished — you find out rather than work out. By question seven you are picking
quickly and being taught the answers, which is a flashcard deck and not a test.

**And it made the run one-way.** Marking as you go means the score exists before
the run is over, and a score already partly banked cannot let you change your
mind about question three. Every other walking game grades at the end for
exactly this reason — see "Walking back through a section game" — and Build was
the last one that did not.

So the choice records itself and moves on, nothing is coloured, and the whole
run is graded in one pass at the end out of whatever the answers happen to be by
then. Back walks the questions, a question you return to shows what you picked,
and picking again replaces it. The last question does not auto-advance: walking
off the end of a run is a thing you should have to ask for, and the confirm
names how many questions are still blank, because the commonest new way to lose
marks is to walk off the end with one you meant to come back to.

**The options are minted once per question and kept.** They used to be minted on
every draw, which was itself a fix — building them all up front meant one draw
from the ringer pool covered the whole game, so the same borrowed verse turned
up as a wrong answer four questions running. That fix became a bug of its own
the moment Back existed: walking back onto a question would deal a fresh set of
wrong answers under a choice already made, and the thing you picked might not
even be on the board any more.

**Generalise: a fix scoped to "this only ever happens once" expires the moment
it can happen twice.** Re-minting on draw was correct for as long as a draw was
a one-way door, and nothing about it looked wrong afterwards.

### The ring runs both ways — 1.62

Impostor rings walk forward on a tap and **backward on a right-click**. A ring
of four means a word you have gone one past costs three more taps to come back
to, and on the hard levels — where the ring is longest and every seat in it is
plausible — going one too far is the commonest thing that happens. Tapping round
again is not difficulty, it is the long way to somewhere you have already been.

The secondary click is free on a PC: nothing in this app has ever wanted a
context menu over a game board, so suppressing it there costs nothing. A phone
has no second button and keeps the forward tap alone — the ring is short on
Easy, which is what a phone mostly plays, and a long-press already means
something to the browser. The hint on the board is printed only where the
gesture exists; a right-click instruction on a phone is a button that is not
there.

### Walking back through a section game — 1.52

Order Lines, Scramble Words and Impostor Words all walk the song a section at a
time behind a button that says **Next section**, and a mis-aimed thumb on the
last line of a verse used to take the whole run away with no way back to it.

**Grading moved to the end of the walk.** It used to grade each section as you
left it and add the marks to a running total, which made the walk one-way *by
construction*: going back would have meant un-counting a section, and
un-counting is the arithmetic that ends with a board scored twice. Every step
already keeps its own node and its own grader, so the totals are simply taken at
the end, in one pass, from whatever state the boards are actually in.

**What you never reached still counts for nothing**, and that needed care.
Stopping the clock is not the same event as walking off the end, so the game
tracks `seen` — the furthest section you have actually been shown — rather than
where you happen to be standing when time runs out. Go back to verse one from
verse four and expire there, and all four are graded, because you saw all four.
The sections past it go into the total and score nothing, which is the rule that
stops an untouched Impostor board handing out most of its marks as a reward for
running out of time.

**Back is hidden, not removed, on the first section**, so Check it does not move
under your thumb between one section and the next. And the last button — the one
Back cannot undo — asks before it grades, on a for-credit run only.

**Generalise: a wizard that accumulates as it advances cannot be walked
backwards.** If you might ever want a Back button, keep the state and compute
the total at the end.

**Practice mode** is offered every time you pick a level: no clock, no points,
and no record at all — no attempt row, no effect on your accuracy averages, and
nothing towards the runs that unlock the time challenge. Anything less than that
and "practice" quietly becomes a way to pad your own statistics.

Game attempts are written with `seconds` 0 and are skipped by every pace table.

| Family | Verses / Words | Lines |
|---|---|---|
| **Order** | Put the sections back in order, throwing out what does not belong | The same, line by line, one board per section |
| **Build** | One at a time: which section comes next | One at a time: which line comes next |
| **Scramble** | Words lifted out of every section; tap them back | A line or two lifted out of each section; tap them back |
| **Impostor** | A section at a time, a share of the words wrong; tap to swap | The whole song, a share of the lines wrong; tap to swap |

**Impostor Words walks section by section, as of 1.52.** It used to put the
whole song on one page, and on a six-verse song that is three screens of
tappable words — which makes the game scrolling rather than reading. You cannot
hold a whole lyric in your eye at once, so the swapped words in the verses you
were not looking at got found by sweeping rather than by knowing. A verse at a
time is the unit a song is learned in, and it is the unit six of the other seven
games already walk.

**Impostor Lines stays whole**, and the difference is the question each one
asks. A wrong *line* only reads as wrong against the lines around it — that is
the entire game — so cutting the page up would take away what you judge it by. A
wrong *word* is judged against its own line, which fits on a screen.

The share is planted **per section** rather than once across the song. Planting
globally and then cutting the page up would leave some verses untouched and
others carrying most of the fakes, and a verse with nothing wrong in it is a
verse you can only lose on: the only move available is to break something that
was already right. A section too short to plant anything in is dropped from the
walk rather than shown clean, for the same reason.

**The mistakes are reported inside the whole verse — 1.52.** Naming a wrong word
on its own — *you left: bright / the song: night* — is the answer with the
question thrown away. A word in a lyric is only wrong in the company of the
words either side of it, and that is also the only form in which reading it back
teaches you anything. So the verse is printed twice, as you left it and as the
song has it, with the words that differ picked out in both. A results row may
carry an `html` field beside its plain `peek` for this; whatever a game puts
there it escaped itself on the way in, and a game that never heard of the field
is unaffected.

**Scramble Lines walks section by section, as of 1.31a.** It used to be one
board for the whole song. That board asked a question nobody actually has: forty
lines with a dozen gaps and a bank of twenty, where the work is scanning rather
than remembering. A verse at a time is the unit a song is learned in — you read
the four lines you are on, you know which one is missing, and the options
underneath are a short enough list to be a decision.

**How many lines go missing is a coin toss, not a rounding.** A fifth of a
four-line verse is 0.8 of a line, and rounding that up takes exactly one out of
every verse on Easy — a rule you learn once and stop reading the board for.
Carrying the fraction as a chance means **Easy leaves some verses whole**, so
you have to look at each one to find out, while over a long song the share still
lands where the dial put it. If the dice leave the whole song intact, one gap is
forced, because a run with nothing to do in it is not a run.

**The tray refills — but the answer is never in the reserve.** 1.31a held part of
the tray back and released it as you spent chips, so that what was left on it
never counted the blanks down for you. It also meant the line the next gap
wanted could be sitting in that reserve, and since a chip always drops into the
leftmost empty gap, the game was simply **stuck with the answer nowhere on
screen**. Both Scramble games shipped broken.

The count it was protecting was never hidden anyway — the gaps are all on the
board to be counted. So as of 1.31b **every line or word that still has a home is
on the tray, always**, and what rotates is the RINGERS: one comes out of reserve
each time you place something, which keeps the tray full without ever standing
between you and the answer.

**Generalise: a mechanic that hides information must never be able to hide the
answer.** If the two cannot be separated, the hiding goes. **Filling the last gap in a section moves you on by itself** —
waiting for a tap on Next after the board is visibly finished is a beat of
nothing, repeated once per verse. It stops at the last section on purpose:
submitting a for-credit run the instant the final line lands, with no chance to
look back over it, is not a convenience.

**First Lines the game is gone**, and as of 1.50 so are its runs. Scramble Lines
does what it did and more; the game itself went in 1.31a and its attempt rows
were carried afterwards under a retired name so the history did not show blanks.
Kyle's call is that they should never have been there at all, so
`purgeRetiredModes` deletes them from the sheet, once, behind a meta flag — and
`RETIRED_MODES` is empty, because there is no longer a row anywhere for it to
name. It deletes **bottom-up**: a row removed shifts everything under it up by
one, so a top-down pass would take out the wrong rows from the second one on.

Order Verses and Build Verses both show **whole verses**, not first lines.
Recognising a section from its first line alone is a much easier and different
trick, and not the one worth practising. The prompt still quotes only the
previous section's first line, because quoting an entire verse back to ask what
follows it is unreadable.

The two line-level games walk **every section**, not one sample of the song.
Line Sort gives each section its own board; Line Order runs through them in
turn and names the section in each question.

**Sorting cards show their type and nothing else.** They used to be labelled
"Verse 1", "Verse 2", "Chorus" — which is the answer, printed on the cards —
and it also made a ringer labelled plain "verse" obvious without reading it.

**A variant box is outlined in teal while there is still a scoring run on the
table for it today**, and says "today spent" once there is not.

**Each level sits beside a four-quadrant panel**: the clock and this song's
limit top left, tries top right, best and average bottom left, last and when
bottom right. Every panel has the same shape whether or not there is history
behind it — an em dash where a number would go — because the button beside it
stretches to match, and collapsing the empty ones made a column of three rows
ragged.

**The pick-one games answer in one tap.** There used to be a Next button under
every question, which meant two taps to answer one thing and a rhythm that never
got going. The choice marks itself instead — green alone if you had it, red plus
the green one if you did not — and the next question arrives on its own. A wrong
answer holds twice as long as a right one, because that is the one you actually
need to read.

**The sorting games are drag-and-drop.** Grab the dots on the left; the card
follows your finger and the list reorders live as its middle crosses a
neighbour's. Drag near the top or bottom of the screen and the page creeps, so a
card can be taken somewhere off-screen — a line-sort board on a phone is taller
than the window. It is hand-rolled pointer handling rather than HTML5
drag-and-drop, which does not fire on touch at all.

**The up and down arrows are gone, as of 1.31a**, and the grip and the cross
have taken the space: 40px and 44px wide, both the full height of the card. Two
30x22 buttons stacked in the corner of a card that is already dragged meant
three targets in one corner and a coin toss to hit any of them with a thumb.

**Two things about the pointer handling are load-bearing, and getting either
wrong makes a card stick to the cursor:**

- **The capture goes on the list, never on the grip.** Reordering moves the card
  through the DOM and the grip rides inside it, and an element that leaves the
  document loses its pointer capture. Capturing on the grip therefore worked
  exactly once: the first reorder killed the capture and every move after it
  went to whatever happened to be under the cursor. The list itself never moves.
- **The move and up listeners go on the document, in the capture phase.** That
  way a release *anywhere* ends the drag — outside the list, over another
  control, or off the edge of the window — and a window blur ends it too, for
  the case where the button comes up over some other application entirely.

### Three levels, and what a level changes

Every game has Easy / Medium / Hard, tuned in **gear -> Games**, one game at a
time behind a dropdown. **Three** kinds of wrong material get planted, in
numbers you set:

**Borrowed** — a verse or line lifted whole out of another song. Borrowed
verses are **matched on line count** against the shapes the current song
actually uses. A ten-line verse dropped into a song where everything runs four
lines is spotted without reading a word of it, which turns a memory game into a
shape-matching one. If nothing fits, everything is offered rather than
nothing — a ringer of the wrong shape beats no ringer at all. Foreign words in a
foreign voice: the easy catch, and the one that teaches least, because you can
throw it out without knowing this song at all.

**Tampered** — this song's own words, with a share of them swapped for
plausible fakes by the same machinery Word Impostor uses. Caught by reading, not
by recognising.

**Decoy** — new in 1.31a. This song's own line, untouched, in a place it does
not go. Nothing about it is wrong except *where it is*, so the only way to place
it is to actually know the song. In Line Sort a decoy comes from another section
of the same song; in the Build games it is a real line or verse offered as the
answer to the wrong question; in Scramble Lines it sits in the tray beside the
lines that really are missing; in Line Impostor it stands in a slot that belongs
to something else.

**The decoy dial skews the split.** `borrowN` says how many not-here-and-now
units to plant and **Decoys (%)** decides how many of them are decoys rather
than borrowed — 0 is all borrowed, 100 all decoy. It climbs with the level for
the same reason the tamper share falls: **20 / 50 / 80** across Easy / Medium /
Hard, so the easy rungs plant material that announces itself and the hard ones
plant material you can only place by knowing where it really goes.

The split is drawn **per unit** rather than divided out, so a level never
settles into a fixed recipe — the same reason the counts are ranges.

**Order Verses has no decoy dial**, and cannot. Its board is every verse of the
song at once, so there is nowhere for a verse of this song to be that it does
not belong — the only thing a "decoy verse" could be is a second copy of one
already on the board, which is two identical cards where you are meant to throw
one away. Its planted material is all borrowed.

Anything the current section already says is left out of the decoy pool, and no
decoy is used twice on one board. Two cards reading the same, one of which you
are meant to throw away, is a coin toss you can only lose; and the same line
turning up in three wrong places is not three decoys, it is one you have already
spotted.

In the pick-one games the tampered copies are drawn from **both the answer and
the rest of the song**: some are the true line with one word off, so the
right-looking option has to be read rather than recognised, and the others come
from elsewhere in the song, so a wrong option can be both the wrong line *and* a
doctored one. Only ever tampering the answer — which is what it did at first —
made every question the same shape: the true line, its evil twin, and some
strangers.

**All three kinds of wrong answer go into one hat and are drawn from
together**: doctored copies, lines borrowed from other songs, and decoys — plain
untouched lines from elsewhere in this one. The dials decide how much of each
kind is in the hat; chance decides which come out, so the mix moves from
question to question and no kind is guaranteed a seat.

That is deliberate on both counts. Left to themselves the doctored and borrowed
lines filled every seat at the tighter levels, so a question could offer nothing
but the answer, its evil twin and two strangers, and never once ask you to tell
two real lines of this song apart. But handing the plain line a *reserved* seat
every time is its own tell — a fixed recipe is something you learn to read
instead of reading the lyrics.

How many decoys go into the hat used to be "about half the ringer count" and a
shrug. As of 1.31a it is the decoy half of the `borrowN` split, so the dial
actually reaches it: at Easy the hat fills with strangers you can throw out on
sight, at Hard with this song's own words in the wrong order.

**The options are minted when the question is asked**, not when the run starts.
Building them all in advance meant one draw from the ringer pool covered the
whole game, so the same borrowed verse turned up as a wrong answer four
questions running and stopped being a question at all.

**The Build games show what you have built so far**, above the question and
scrolling itself to the bottom. The game is called Build and until 1.31a it
built nothing you could see: each answer flashed green or red and vanished, and
by question seven you had no idea what song you were assembling. Every choice
now stays on the page in the order you made it — right answers reading straight
through, wrong ones sitting in it where you put them. That is the context the
next question is actually asked in.

**A higher tamper percentage is EASIER.** A verse with a third of its words
wrong reads as wrong at a glance; one with a tenth wrong has to be checked
against what you actually remember. Hence 30 / 20 / 10 across the three levels,
which looks upside down until you have played it.

| Dial | Easy | Medium | Hard |
|---|---|---|---|
| Points | 1 | 2 | 3 |
| Tampered planted | 0–1 | 1–2 | 2–3 |
| How tampered | 30% | 20% | 10% |
| Planted (borrowed + decoy) | 0–1 | 1–2 | 2–3 |
| Decoys, as a share of those | 20% | 50% | 80% |

The counts are **ranges**, not fixed numbers — a fixed count is a tell after
two rounds.

Two games have their own dials instead:

| Word Scramble | Easy | Medium | Hard |
|---|---|---|---|
| Points | 1 | 2 | 3 |
| Words missing | 20% | 40% | 60% |
| Extra words in the bank | 0–1 | 1–2 | 3–4 |

The extra words belong to nothing, so a full bank is no longer proof that every
slot has a home.

| Impostor Words | Easy | Medium | Hard |
|---|---|---|---|
| Points | 1 | 2 | 3 |
| Share faked | 25% | 35% | 45% |

| Impostor Lines | Easy | Medium | Hard |
|---|---|---|---|
| Points | 1 | 2 | 3 |
| Share faked | 30% | 40% | 50% |
| Tampered, of those | 0–1 | 1–2 | 2–3 |
| How tampered | 30% | 20% | 10% |
| Decoys, of the rest | 20% | 50% | 80% |

The Impostor games are the odd ones, and their levels run the other way for a
reason: every unit is a judgement, so **doing nothing scores exactly the share
you did not fake**. Below 25% inaction would clear the 75% floor and bank points
for sitting still.

**Both were rebuilt in 1.31a on one mechanic: a ring per cell, over the whole
song.**

- **The whole song, all at once.** A verse read on its own is a different and
  much easier problem — a wrong word is odd against three lines of context, and
  you knew before you started that this screen had something in it. Reading the
  song end to end is the thing you actually have to be able to do, and it is the
  only view where a line can be wrong because of what came four lines earlier.
- **No extra rows.** If the song is fourteen lines the board is fourteen lines.
  Line Impostor used to pad the section out with added fakes, so counting the
  rows told you how many had been planted before you read one of them.
- **Tapping swaps, it does not strike out.** Every cell holds a small ring of
  candidates with the true one somewhere in it, and a tap moves to the next —
  which may be the right one, and may be another impostor. A suspicion is not a
  verdict: you tap through until what is on the page is what the song says, and
  then you leave it. Tapping something already right takes it *away* from right,
  which is what stops the board being cleared by tapping everything twice.
- **A cell you have moved is outlined.** It says nothing about whether you were
  right, only that this one is not as the board first showed it, which on a
  two-hundred-word screen is the thing you cannot hold in your head.

**The ring is shuffled — 1.53.** It was not, and that was a real bug: the ring
was built as `[truth, fake, fake, …]` and left in that order, and since a tap
steps forward and wraps, starting on a fake put the truth at the far end of
every walk. On Medium and Hard, where the ring is three and four deep, the game
stopped being *which one is right* and became *tap this until it stops
changing* — the answer was reliably whatever came up just before the board
repeated itself. Kyle noticed the pattern, tested it deliberately, and it held
on every wrong line. The truth now sits anywhere in the ring, and the starting
position is drawn uniformly over the *fakes* rather than over the indices, so
the slot beside the truth is not favoured either.

**Generalise: if a shuffle is only ever observed through a walk, shuffling the
starting point is not the same as shuffling the ring.** Callers must not assume
index 0 is the truth any more — they ask for it by value.

Grading is what is on the page when you submit, cell by cell. That also means
**Line Impostor had to move from a count to a share**: the board is the whole
song now, and a fixed count of three wrong lines is 8% of a long song and 60% of
a short one — on the long one, doing nothing would score 92% and bank points.
`editN` is what is left of the old count, and it now means *how many of the
wrong lines are this song tampered with*; the rest split borrowed/decoy on the
decoy dial.

**The results card shows the LINE the mistake is in — 1.53.** Reporting a wrong
word on its own — "you left: bright / the song: night" — is the answer with the
question thrown away: a word in a lyric is only wrong in the company of the
words either side of it, and that is also the only form in which reading it
back teaches you anything. 1.52 printed the whole verse for that context, which
was too much of a good thing — the card clamps a long block, so a mistake in
the fourth line of a six-line verse was reliably clamped away and the card
showed two clean lines and an ellipsis. One row per wrong line, and the mistake
is always on screen.

**Generalise: context that is clipped is not context.** The line either side of
a word was the argument for showing the verse; the verse was only the cheapest
way to include it.

**Options per question** is a dial on Build Verses and Build Lines, per level
(4 / 4 / 4 by default). It is a floor, not a cap — if a level asks for more
tampered and borrowed answers than will fit, the list grows to hold them. It
used to be one slider shared by every game at every level, which said that four
answers at Easy and four at Hard were the same question.

### The floor is per level, as of 1.31b

**Every game level and every quiz carries its own floor**, set on its own card
under **gear → Games and quizzes**. There is no global floor slider any more.

One number for the whole app said that 75% of an Easy board — which you can
half read off the page — was the same achievement as 75% of a Hard one. A floor
is a statement about how hard the thing is, so it belongs with the rest of that
level's difficulty rather than sitting above all of them.

The old global number is not thrown away: on the upgrade it is copied onto every
game level and every quiz, so nothing changes until you move one. It survives in
the blob as the seed anything new inherits, and `floorFor(mode, level)` falls
back to it, but nothing reads it at scoring time any more.

### Ringers, and where they come from

The games need material from other songs. `getDecoys` reads the id column,
shuffles it, and pulls only a few rows — the point is not to read 242 lyric
blobs to get six verses.

**It is asked fresh for every single game, as of 1.31a.** It used to be pulled
once and kept for the session, which is invisible until you do the thing this
app is for: play four games on one song in a row. Every one of them then cribbed
off the same handful of other songs, and by the third you were not recognising
your own lyrics any more, you were recognising the intruder from last time. That
is the "Setting the board" beat, it is over in well under a second, and a new set
of strangers each time is worth it.

Whatever comes back can still contain lines the current song says, so
`usableDecoys` filters anything the song already has rather than trusting the
server's exclusion. A "wrong" option that is actually in this song would be
marked wrong when you picked it, which is the worst thing a memory game can do.

### The impostor swap

Words are replaced by preferring the same **length** and keeping the same
**class** — function words swap with function words, content words with
content words. So "road" becomes "john", and "the" never becomes "mountain".

This is **not part-of-speech tagging**. Nothing available in Apps Script can
do that, and the honest approximation is a function-word list plus a length
match. It is enough to stop the fakes announcing themselves.

**Case the fake the way ENGLISH would, not the way the word it replaced
happened to be cased — 1.43.** Copying the sample's case is right almost
everywhere and wrong in exactly one place, which Kyle caught: the pronoun *I* is
capitalised wherever it stands, so it carries no information about its position,
and it is the only common one-letter word besides *a*, so those two swap for
each other constantly. Copying the case handed you both halves of the tell at
once — *I wont cry, A wont cry, no I wont shed i tear*. A mid-line capital A is
not how anyone writes and a lone lower-case i is not either, so you could find
both without knowing a word of the song.

So the pronoun always comes out capitalised, and when the word being REPLACED is
the pronoun its capital is ignored in favour of where the word actually sits —
the only position that licenses a capital is the start of a line. Everything
else still copies the sample. Verified over 254 ring values on a song saturated
with both: 30 capital I, 22 lower-case a, 8 capital A all line-initial, zero
lower-case i.

**Generalise: a word whose case is fixed by grammar cannot be used as evidence
of what the case in that position should be.**

**How many hide behind each one goes to 8 — 1.43.** The old ceiling of 4 was
arbitrary. Building a ring is cheap; what runs out is CANDIDATES, since a fake
must match its word for class and come within three letters of its length, and
duplicates are dropped. Ask for eight and a short song will often give you four
— fewer options rather than worse ones, which is the right way for it to fail.

Grading is per word: flag it or leave it, each is a judgement. Which means
doing nothing scores exactly the share you did not swap — at the default 25%
that is 75%, which is the floor, which banks nothing. Sitting on your hands is
worth precisely what it should be.

**How many hide behind each one is a dial — 1.31c.** Every tappable word or
line is a RING: the truth plus some fakes, and a tap walks it. That count used
to be hard-wired at two everywhere. It is **Behind each** now, per level, and
it defaults to one at Easy, two at Medium, three at Hard.

It is a real difficulty dial rather than a cosmetic one. With **one** behind a
word, a tap on something you know is wrong lands straight on the answer — spot
it and you have fixed it. With **three**, spotting it is only the first half:
you still have to pick which of the three the song actually says. Every cell
gets the same ring whether or not it was planted, because a word whose tap has
nowhere to go has just told you it was already right.

The ring can come up short of what you asked for on a small library — the fake
has to match the word for class and roughly for length, and duplicates and
misses are dropped — which is the right way for it to fail: fewer options, never
a wrong one.

### One thrown-out line is one mistake — 1.31c

The bug: order a section correctly, submit, and be told a couple of lines are
wrong **and that a position was left empty** — in a game that has no way to
leave a position empty.

It was the grading. The board's real cards were zipped straight onto the song,
first against first and second against second, so a card you had thrown out
shifted every card below it up a slot. One line binned out of a four-line
section marked all four wrong: three mismatches and, at the bottom, a position
with nothing left to put in it. **One mistake, reported as the whole board.**

The fix is to take the thrown-out ones off the expected list first, mark each
one wrong exactly where it belongs, and grade the ORDER on what is actually
still on the board. Verified: a correct four-section play-through of the test
song scores 36 of 36; the same run with one real line thrown out of the first
section scores **34 of 35, with the single row naming the line you threw out**.
Under the old grader that was four wrong and a phantom empty slot.

Three things go with it:

- **The screen and the grader cannot hold different orders.** Rebuilding the
  order after a drag used to bail out if the DOM and the list disagreed on
  length, leaving the board showing one order and the grader holding another
  with nothing to say so. It now takes the DOM order for every card it names
  and puts anything it missed back on the end. A card on the board is graded,
  always.
- **No ringer may read the same as a card that belongs.** A tampered copy is
  built by swapping words out of a real line, and nothing stopped a swap landing
  on the word that made it read as some other line of the same section; a
  borrowed line out of another song can arrive as a phrase this song also
  sings. Either way you are shown two identical cards, told one does not belong,
  and there is no reading of the board that tells you which. Any colliding
  ringer is dropped: a board with one ringer fewer is slightly easier, a board
  with an unanswerable card on it is broken.
- **A throw-out announces itself.** The cross is a 44px target beside the drag
  grip, and the tray it lands in can be a screen below on a long section, so a
  card thrown out by a thumb that meant the grip just vanished in silence. It
  toasts now, and the tray says you can tap anything in it to put it back.

**Generalise: one wrong move must cost one mark.** A grader that turns a single
slip into most of the board is not strict, it is lying about what happened.

### Scramble Lines is one board — 1.41

It used to walk a section at a time: four lines on screen, one gap in them, a
short list underneath. That is a much smaller question than it looks. With the
verse in front of you and one hole in it, the answer is usually the only option
that scans — and because the board never left the section, the thing the game
is actually for, *where a line sits in the song*, was never asked at all.

Now the whole song is on the board with every gap open at once, and the bank
sits at the foot of the screen and stays there while the song scrolls past it.

**Tap a line then tap its gap, or a gap then its line.** The old board dropped
every chip into the leftmost empty gap, so on a board with more than one gap you
could not aim: the game chose where your line went and then marked you wrong for
its own choice.

Three things fell out of the rebuild.

**The scoring bug was a race, and Kyle found it before I did.** Fill the last
gap in a section and the old board scheduled an auto-advance 320ms later. Tap
**Next section** inside that window and you advanced TWICE — the second advance
grading a section you were never shown, untouched, nothing placed. The results
screen then told you that you had failed to place lines you had never seen,
which reads as a scoring fault and is really two things driving one transition.
Scramble Lines was the only game that used the auto-advance, so the whole
controller went with the rebuild rather than being fixed.

**Generalise: never let a timer and a button drive the same transition.** If
both can fire, both will, and the second one lands on a state that has already
moved.

**No decoy dial any more**, for exactly the reason Order Verses has never had
one: the whole song is on the board, so one of this song's own lines from
somewhere else is sitting there in its real place for you to see. It stops being
a question. What is left is BORROWED — foreign lines, the easy reject — and
TAMPERED copies **of the lines that are actually missing**, which is the hard
one, because the only way to tell them apart is to know the line.

**One chip per gap, duplicates and all.** A song that sings the same line twice
can have both copies lifted out, and then the bank needs two chips reading the
same. The first cut of the rebuild de-duplicated the bank by text and produced
an unwinnable board — one chip, two gaps, and nothing on screen to explain it.
De-duplication belongs on the ringers only. That is the third time this session
that a repeated line has broken something built as though lines were unique.

### The tray is a window, not the deck — 1.63

Both Scramble games used to put the **whole** deck on the tray. On a long verse
on Hard that is thirty-odd chips, and somewhere around twenty the game stops
being about the song and becomes about scanning a wall of words. The deck is not
the problem — every missing word does have to be reachable — so what is capped
is how much of it you can see at once. `trayN`, per level, defaulting to
**8 / 12 / 16**: more is harder, because the haystack is bigger and less of the
song is confirmed for you at any one moment.

It cuts the other way at the end of a board, which is worth knowing. The old
tray shrank as you spent it, so the last few words were a choice of three — the
endgame was free. A window stays the size it is until the deck itself runs out.

**Four rules, and each one exists to stop a specific unfairness a window can
introduce:**

1. **The chip you tap does not move the others.** A tap takes the word out of
   its own position and the deck refills *that position*. A tray that reflows
   under your finger means the second half of a board is spent re-reading chips
   you had already dismissed, and it makes a mis-tap the tray's fault rather
   than yours.
2. **The word the next gap wants is always there.** A chip drops into the first
   unfilled gap in reading order, so that gap is the only one the board owes an
   answer for. Before every draw it checks, and swaps the answer in if it is
   sitting in the unseen part of the deck. A window that can hide the one word
   you need is not a harder game, it is a stuck one.
3. **A swap moves several chips, not one.** Replacing exactly the chip that was
   needed would point straight at it — one thing changed, and the changed thing
   is the answer. So a quarter of the tray turns over at once, the answer lands
   in a random one of those positions, and the rest come off the deck.
4. **What you take back out comes back into view.** Lifting a word out of a gap
   puts it on the tray — a free position if there is one, otherwise in place of
   something the deck takes back. A word that vanished when you un-placed it
   would look like the game had eaten it.

**The honest caveat on rule 3:** a swap still tells you the answer was *not*
there a moment ago, and that it is among the few that changed. Tracking which
three of twelve similar words turned over, every turn, is harder work than
knowing the verse — that is the bet this makes, and it is a bet rather than a
proof.

**Scramble Lines anchors the guarantee to the first unfilled gap too**, even
though that board lets you aim anywhere. Anchoring it to the *selected* gap
would have been the more responsive rule and a much worse one: a reshuffle you
can trigger by tapping a gap is a reshuffle you can tap every gap in turn to
trigger, and the chips that change each time are the answers. A fixed anchor
cannot be probed, and the board stays winnable either way, since the gaps can
always be filled in order.

**Generalise: any reactive behaviour is a probe if the player controls when it
fires.** The rule was not wrong about being helpful; it was wrong about who
decides when it happens.

**The one case it cannot fix, and does not pretend to:** put a word in the wrong
gap when the song only sings it once, and the answer the current gap wants is
now in a filled gap rather than in the deck. There is nothing to swap in. The
board is not stuck — tap that gap and the word comes back — but no amount of
reshuffling produces a copy that does not exist, so `ensure` returns quietly
rather than inventing one.

A position the deck can no longer fill is drawn as a **hole**, not closed up:
closing it would slide every chip after it along one, which is precisely what
rule 1 exists to prevent. Holes at the *end* are trimmed, since nothing follows
them to be moved.

`makeTray` is shared by both games, because they are the same board asked of two
units and two copies of four rules is two places to get rule 3 wrong.

### The dials read against the unit — 1.41

`missPct` is one dial and not one question: Scramble Words lifts words out of
each section, Scramble Lines lifts lines out of the whole song. The Settings
grid reads the label against the game's own `unit`, so the same table entry
prints **Words missing** on one and **Lines missing** on the other.

Both of the numbers you actually tune by are now computed under the boxes,
against a real song, the way the seconds rate always has been:

- under **Lines missing**, *about 6 of 16* — how many gaps that share makes;
- under **Planted** on Scramble Lines, *9 in the bank* — gaps plus borrowed
  plus tampered, which is the size of the list you will be choosing from.

**Generalise: a percentage of a song is not a quantity until you say which
song.** A share on its own tells you nothing about what the board will look
like.

### When a song repeats itself

A song that sings the same line twice puts two identical cards on an ordering
board, and there is no way on earth to tell which copy the app meant to go
first. Graded on card identity, that was a coin flip you could only lose.

**Ordering is graded on what the card says, not which card it is.** The two
become interchangeable, which is the only honest reading: you still have to know
the line belongs in both those places. A board holding twins says so, so an
apparent duplicate does not read as a bug.

The same thing bites one screen along: if a line appears twice, "what comes
after it" has two true answers. **Every one of them is accepted.**

## The quizzes, and the masks

Five rungs sharing one ladder, told apart entirely by how much of the line they
show you. The mask IS the difficulty, which is why a quiz has no levels to
tune.

### What the Easy rung shows — 1.51

It used to be the first letter of every word, full stop. **It is one random
letter per word now, and four dials underneath that.**

**The first letter is the worst letter to give away.** It is the one you are
most likely to be able to guess from the line before it, from the rhyme, or
from the grammar — so a first-letter mask quietly turns a memory test into a
crossword that can often be solved without knowing the song at all. A letter
from the *middle* of a word is a far better prompt for the same cost: it tells
you the shape you are reaching for without handing you the way in.

The dials:

| Dial | What it does |
|---|---|
| `letterPick` | `random` (default) or `first` — which letters of a word get shown |
| `letterScope` | `word` (default), or `line` / `verse` / `song` |
| `letterCount` | the flat count per word, when the scope is `word`. Default **1** |
| `letterPct` | the share, when the scope is anything else. Default 20% |

**`letterCount` and `letterPct` are two dials, not one field read two ways.**
"2" and "20%" are not the same number wearing different hats, and a single
field would silently reinterpret whatever was in it the moment you changed the
scope. The one not in force is **greyed rather than hidden** — hiding it would
make the scope look like it had changed the shape of the panel rather than the
meaning of one dial, and you would lose the pairing that shows what it switched
between. It stays editable, because setting it before switching scope is a
perfectly reasonable order to do things in.

#### A share is apportioned, not divided

At a scope of line, verse or song, the budget is `round(letters × pct)` and it
is spread across the words **in proportion to their length**. Handing every
word the same count would be a flat rule wearing a percentage's clothes, and it
would give a three-letter word the same help as a nine-letter one.

The remainder after each word's floor goes to the largest fractional parts —
standard largest-remainder apportionment — so the total lands *exactly* on the
budget rather than drifting a few letters under it on every verse. It walks the
list repeatedly rather than once, because a word already at its full length
cannot take another letter, and a single pass can finish with budget unspent
while other words still have room. Measured on a real song at 20% per verse:
26/128, 16/78, 20/99, 20/100 — every one on the nose.

#### Two things that forced the shape of the code

- **The masks are built for the whole song up front**, keyed `section|line`,
  rather than per line on the way past. At verse or song scope, how many letters
  a line shows depends on every other line in its unit, so *there is no answer
  to "mask this line" taken on its own* — which is exactly what `maskForMode`
  sees. It takes the precomputed string as an argument now and falls back to the
  old first-letter rule if one is missing, because a stale key should cost you
  the new behaviour, not the whole rung.
- **Random letters are drawn once per run.** Re-rolling on a repaint would move
  the visible letters under a half-typed answer.

Within a word the positions come off a partial Fisher-Yates shuffle rather than
"pick a random index n times". Repeated draws collide, and a collision silently
shows **fewer** letters than the dial says — a dial that under-delivers at
random is worse than one that is simply wrong.

#### Number('random') is NaN

`apiSetSettings` ran every quiz dial through `Number()`, which was fine while
they were all numbers. A NaN written into the blob would have come back out as
a mask showing nothing at all — a silent, total change to what a rung looks
like, from a coercion nobody asked for. Choice dials are declared in
`QUIZ_CHOICE_DIALS`, take only the values they list, and anything else is
dropped.

**The harness could not have caught that either.** Its `setSettings` stub stored
whatever it was handed, so it was strictly more permissive than the server — and
a stub more permissive than the thing it stands in for will pass payloads the
real one mangles. It applies the same coercion now.

**No `SETTINGS_REV` bump.** These are read above the revision gate with the
heatmap's dials, because they are a *preference* rather than part of the
balance: a rebalance has no business deciding how much of a word you like to
see. Absent from any blob written before 1.51, they fall back to the defaults.

The settings panel prints the rule as a sentence and **draws it against a real
line from your library**, because "2 letters at random" is not a picture until
you have seen one. The preview re-rolls on every repaint by design: a random
rule that showed the same letters every time you looked would be
misrepresenting itself. The quiz itself prints the same sentence, from the same
function, above the first verse — and the mode's blurb went deliberately vague
("Some of the letters of every word are showing"), since a blurb naming one
setting would be wrong the moment any of them moved.

### A wrong word is not always wrong by the same amount — 1.52

A word graded right or wrong and nothing in between makes one slipped finger
cost exactly as much as not knowing the line at all, and those are not the same
failure. Typing *wistle* for *whistle* is a typo; typing *window* is a blank.

So a wrong word keeps a share of its mark: **one minus the edit distance over
the length of the word the song has.**

| the song | you typed | edits | worth |
|---|---|---|---|
| whistle | wistle | 1 of 7 | 0.86 |
| whistle | whistled | 1 of 7 | 0.86 |
| whistle | window | 6 of 7 | 0 |

Two guards, and both were the first thing to get wrong:

- **At most two edits.** Past that it is not a typo, it is a different word, and
  letters two words happen to share are not partial knowledge.
- **At least half the word.** Short words are where the formula gets silly — *he*
  against *me* is one edit of two, and half a mark for a word you did not know is
  a great deal more than a typo is worth. The floor throws those out rather than
  pretending the formula scales all the way down.

**It is still marked wrong.** The token reads amber rather than green on the
results screen, carries the correction, and prints what it was worth beside it —
because "wrong, but it only cost you a fifth of a word" is the entire point and
is otherwise invisible. And **the heatmap still records a miss**: the credit is
about scoring proportionately, not about deciding you knew the word. A heat map
that forgave typos would slowly stop pointing at the lines you fumble.

Distance is measured over the *normalised* forms, so case and punctuation are
out of it before the count starts — *Don't* against *dont* is a distance of
nothing, which it should be.

### A mark standing on its own is not a word — 1.52

A songbook line can carry a mark with spaces either side of it: a dash between
two thoughts, a stray question mark, an ellipsis. Those were coming through as
**words** — counted in the line's total, waited for, and marked missing when you
did not type them. You cannot type a word that is not one, so it was an
unanswerable question worth a real fraction of a verse. Kyle found it as a
question mark he was graded on omitting.

It is dropped in `words()`, the one splitter the mask, the grade and the heatmap
all share, rather than in the grader — three places filtering separately is
three places to forget to. The server's `heatWordCount` had to learn the same
rule in the same commit, or the heat address space would be off by one from the
run that filled it and every tint after a stray dash would land on the wrong
word.

**The test is `isLetterCode`, not `normWord`.** That was the trap in the fix:
`normWord` keeps a-z and 0-9 only, so a word written entirely in accented
letters normalises to nothing and would have been thrown out as punctuation —
a worse bug than the one being fixed. The mock library carries a verse with a
lone `?`, a lone `-`, and *Café* and *déjà* in it, so neither half of that can
regress quietly.

### Nothing you are shown carries a mark — 1.52

**No punctuation appears in an opening word or in a blank.** The blanks never
had any — `maskOf` only ever draws a letter — but the opening words were handed
over exactly as the song spells them, elision marks included: *ol'*, *walkin'*,
*'em*, and the quotes around *"Hello,"*. A mark you are shown is a mark you will
try to reproduce, and the grader has never wanted one.

**Every apostrophe goes, interior ones included — 1.52a.** *don't* is handed
over as *dont*, *That's* as *Thats*.

1.52 kept the interior one, on the argument that "dont" is not a word and reads
as a mistake in the songbook rather than as a hint. Kyle's call, and the right
one: **the songbook is full of words that are not words** — *walkin'*, *ol'*,
*ain't*, *'79* — and an opening-word prompt is a fill-in-the-blank, not a
printed lyric.

The rule is about **what you are being asked to type**, not about spelling. The
grader normalises every apostrophe away before it compares anything, so showing
*don't* while silently accepting *dont* was the app asking for a character it
then ignored. Nothing about what you can type changes either way.

**The lyric sheet is untouched** and still prints every apostrophe the song has.
That is the screen where spelling is actually on display; the quiz prompt is
not.

### Punctuation, and the elided-word wildcard

**One definition of what a letter is, used by every mask and every grader.**
`isLetterCode` used to count everything above ASCII as a letter, to keep
accented ones. It also kept every curly mark a word processor makes — and the
songbook comes out of Google Docs, so nearly every apostrophe and quote in it is
curly. That is where punctuation was creeping into the quizzes: a straight
apostrophe was dropped from the mask and a curly one drew an underscore, so the
same word blanked out to two different shapes depending on which key had typed
it. The curly quotes, dashes, ellipses and primes are now named and excluded;
the accented letters still pass.

**A word is split into lead / core / trail in one pass**, so the three can never
disagree about where the word starts. The whole difficulty is that an apostrophe
is sometimes a mark and sometimes a letter, and only its neighbour says which:

| Token | Lead | Word | Trail | Why |
|---|---|---|---|---|
| `'em` | | `'em` | | a mark with a letter behind it opens an elision |
| `ol',` | | `ol'` | `,` | one with a letter in front of it closes one |
| `"Hello,"` | `"` | `Hello` | `,"` | nothing next to a letter; all marks |
| `don't` | | `don't` | | interior marks are never touched |

That last row is the one that was visibly wrong before. The opening words handed
to you on the Beginner rung were run through a letters-only filter, so a line
starting "Don't look back," was handed over as **"Dont look"** — not a word, and
it reads as a mistake in the songbook rather than as a hint.

**The elided-word wildcard.** A songbook writes "ol' devil" and "walkin' home",
and what you type back is whatever you sing. Normalising both sides already made
`ol` and `ol'` the same thing — the apostrophe is stripped either way — but
`old` was a different string and was marked wrong, which is the one thing a
memory quiz must never do to a right answer.

An apostrophe on the **outside** of the song's word is a wildcard for the
letters it stands in for: leave it out, or fill it in, and either is right.
`movin'` takes movin, moving (and movin', for anyone who types the mark).

**Filled in with the right letters, not any letters — 1.64.** It used to be
purely positional: an end apostrophe took *any* one more letter, a front one
any two. So `movin'` accepted movind and movinz, which nobody sings. What may go
back is now read off the word itself:

| The song's word | What may fill the apostrophe | e.g. |
|---|---|---|
| ends `in'` | g | `movin'` → moving |
| ends `n'` / `l'` | d | `an'` and, `ol'` old, `roun'` round, `tol'` told |
| ends `s'` `f'` `p'` `c'` `k'` | t | `jus'` just, `lef'` left, `kep'` kept |
| a few whole words | their own | `o'` of/on, `th'` the, `yo'` you, `fo'` for, `don'` don't |
| starts `'` — a short table | the dropped front | `'em` them, `'til` until, `'bout` about, `'cause` because, `'neath` beneath, `'cept` except, `'nuff` enough |
| starts `'` — anything else | a or be, only if that makes a common word | `'live` alive, `'side` beside |

**Interior apostrophes are never wildcards.** `couldn't` is couldn't or
couldnt; couldnxt is wrong. `splitWord` keeps those inside the core and only the
two ends are ever read.

It only ever loosens a word the song itself wrote with a letter dropped, so
nothing else in the library gets easier, and it is deliberately **one-way**: the
song says `ol'`, you may sing `old`; if the song says `old`, `ol` is still wrong,
because there the full word is what is written.

The spellchecker asks the same question first: moving where the line says
`movin'` is one letter from a word on the line, which is exactly what a typo
looks like, so before 1.64 it was marked. A typed word the wildcard accepts is
never marked.

A new elision that the table misses is still accepted *without* the letter —
the omission is always right — so a gap in the table costs a fill-in, never a
right answer. Adding one is a line in `ELIDE_TAIL_WORDS` / `ELIDE_HEAD_WORDS`.

**In the games it matters too.** The word pool the fakes are drawn from now
holds bare words rather than raw tokens, so a fake can no longer arrive as
"night," — comma and all — and be planted mid-line where no comma belongs. A
planted word keeps the marks the song put around the word it replaced.
Punctuation that moves is a tell you can read without knowing a word of the
song.

### The spellchecker — 1.61

The grade bar is two buttons now: a quarter of it is **Spell check**, and the
rest is still Grade my lyrics. The grader compares words, and a word with one
letter out of place is a word you got wrong — the right call for a memory test
and the wrong one for a keyboard. 99.9% on a long song because a thumb landed
between two keys is a measurement of the phone, not of the song. So the typos
can be marked **before** the run is scored, and you fix them yourself.

A typed word is marked only if it fails all three of these:

1. **It is not a word this song uses.** The song is the dictionary, so every odd
   spelling the songbook actually writes — a dialect form, a name, an elision —
   is correct by definition and can never be marked. Checked against the whole
   song and not the line, so a word borrowed from the wrong verse is a wrong
   answer rather than a misspelling.
2. **It is not a common English word.** This is the test that keeps the button
   honest. Writing "the" where the song says "she" is a wrong word, not a
   misspelled one, and marking it would turn the checker into a hint. A real
   word stays unmarked however wrong it is.
3. **It is within a typo of a word on the line you typed it on.** This is what
   makes a mark mean something rather than "I do not know that word".

Transpositions count as **one** edit, not two. Swapping two letters is the
single commonest way a typed word goes wrong, and plain edit distance calls
`hse` / `she` two substitutions — outside any threshold tight enough to be
trusted, which would have made the checker blind to exactly the case it was
built for. So it is optimal string alignment rather than Levenshtein, bounded,
because the answer is never wanted and only whether it is small. One edit is
allowed on a word under seven letters and two at or above it: a short word has
too few letters for two edits to mean anything, and at three letters two edits
reaches most of the alphabet.

**It never names the word it thinks you meant.** The mark says "this is not a
word", which is all you need to find your own mistake, and it is the most the
app can say without answering the question. A suggestion would make every
near-miss a free letter-by-letter probe of the lyrics; the ladder is the hint
system. Two-letter words are never marked either — there is not enough word
there to tell a typo from a different word.

The guard list is about fourteen hundred common English words, stored
normWord-shaped — lowercase, apostrophes already gone, so `dont` and `youre`
are the entries. It does not have to be a dictionary, because the song supplies
its own; it only has to catch the **real** word typed in the wrong place, and
those are overwhelmingly short and common ones — your/youre, hear/here,
mine/mind. A near-neighbour rare enough to be missing from it is a wrong answer
nobody would mistake for a slip of the thumb. All of it runs on the page: no
dictionary is fetched and nothing is sent to the server.

The marks are a **third layer** inside `.fillin-line`, holding the same text in
the same monospace at the same size with the same padding, every word but the
marked ones invisible. An input cannot paint one of its own words, and the
three layers line up for free because they are all `white-space: pre` in one
font — which is the only reason this is a few lines of CSS rather than a text
measurer. It sits **below** the input, so what is painted is a block of colour
behind the letters rather than a copy of them over the top.

**Typing clears the marks on that line.** A mark is a statement about the text
it was drawn on, and the moment that text changes it is a statement about
something that is no longer there. A stale mark on a word you have already
fixed is worse than no mark at all.

The input keeps `spellcheck="false"`. The browser's own checker does not know
this song, so it would red-line every dialect spelling and every name in the
songbook — and it cannot be read from script, so it could be neither trusted
nor counted.

### The stopwatch is opt-in

Every quiz is timed, with the clock stopped whenever the app is in the
background — one walk-away run would otherwise poison a median for good. The
time is recorded and reported either way.

What changed in 1.1a is that the clock only **moves your points** on a run
where you asked it to. Each quiz card carries a timer icon and a tick box on
its right. It is locked until you have **five** runs at that level on that machine — a
median of two runs is a coincidence, not a baseline — and once unlocked it also
shows your average time there. The five is tunable under **gear → The timer**.

Tick it and the run is graded against that average: twice as fast earns the
full swing (20% by default), twice as slow gives it all back, running at your
average changes nothing. Leave it and the run is scored on accuracy alone. The
choice is stored on the attempt, so replaying the history always lands on the
same numbers.

Symmetry is why it works in log space rather than as a plain ratio: "half the
time" and "double the time" are the same size of change, which a percentage
difference gets wrong.

## After a run

**Only the mistakes are listed.** A flawless Word Scramble used to print every
word you placed beside the word it already was — forty rows of "you put willows
/ the song says willows", which is a lot of scrolling to learn nothing. A run
with nothing wrong gets one line saying so.

### The end screen is the menu — 1.50

It used to be three shortcuts over two ways out: **Try again**, **More
practice**, **Next game**, with *Back to song* and the burner underneath. All
three are gone.

Every one of them was a guess at which of twenty-four buttons you wanted,
made by a screen that could not possibly know — and two of the three opened a
sheet or a picker to ask you the question anyway. Try again could only ever
offer the game you had just played. Next game drew at random and told you
nothing about what it had drawn from until it landed.

So the whole games shelf is printed on the end screen instead, Random Game
included: the same block the picker draws, **from the same function**, so what
is locked and what is spent today read identically on both. One tap to any of
the twenty-four, rather than two taps to a guess.

**Generalise: when a shortcut's job is to guess which menu item you wanted,
show the menu.** The shortcut is only worth its space when it knows something
the menu cannot say.

What is left above it is one row of three:

| | | |
|---|---|---|
| **Try Quiz** | **Back to song** | **Front burner** |

**Try Quiz goes on the left** because it is the one shelf the block underneath
does not cover. The third button is named after **wherever you actually came
in from** — Back burner, The Pantry — rather than assuming the front.

`pressBusy` and `pressDone` went with the buttons that needed them. Nothing on
this screen waits on the network before it moves any more; the games block
carries its own placeholder while the song loads, and a failure to load it
leaves the three buttons above perfectly usable.

#### The menu is drawn twice, and that is the point — 1.50b

**The run you have just finished is the one thing the menu cannot see.** The
ladders and the tries counts are both derived from the attempt history, and at
the moment this screen is built the row is still in flight — the write was
dispatched milliseconds ago and the index that will carry it has not been
rebuilt. So the first paint showed the song as it was *before* the run: a level
you had just unlocked still locked, and a tries count one short. Going back to
the song and in again fixed it, which is the tell that the data was fine and
only this screen was early.

Waiting for the write before drawing anything would be worse — a blank band
under the buttons for as long as Apps Script feels like taking, on a screen you
look at for four seconds. So it **paints what is true now, then paints again
when the truth arrives**.

`onSaveLanded` is the register and `fireSaveLanded` runs it, from inside
`bankAttempt`'s success path and **after `refreshIndex` resolves**, not after
the write. The row being in the sheet is not the same as the app knowing what it
did: the ladders are derived in `apiInit`, so anything repainting from them has
to wait for the index built around the new row.

Three things that were easy to get wrong:

- **The song cache has to be dropped on the second pass.** `finishQuiz` drops it
  before dispatching the write, but the first paint refetches immediately and
  repopulates it with the pre-run history — so by the time the row lands, the
  cache holds a stale copy fetched *after* the drop, which would be served
  straight back.
- **Listeners say whether they are still worth calling** rather than being
  unregistered on the way out. A results screen you have navigated away from
  returns false and is skipped. **Deregistration you have to remember is
  deregistration you will forget.**
- **A practice run registers nothing**, because nothing is coming. An entry left
  waiting for a write that never happens is one that fires on somebody else's
  save later.

#### What the run just opened

Repainting silently is not enough: the screen should *say* that the run bought
you something. A snapshot of the ladders is taken while `S.songs` is still the
pre-write index — a flat copy, because `refreshIndex` replaces those objects
wholesale and a reference into it would quietly become the after-state, making
every difference vanish — and the second paint diffs against it.

The difference is keyed two ways, because they are different events: **by mode
id** for a game that has just become reachable along the chain, and by
**mode|level** for a rung opening inside a game you already had. One is a new
door on the shelf, the other a step up a ladder you were already on. A newly
opened game marks its column *and* its Easy rung, since that rung is the point
of it.

A banner above the menu says the count in words — *That run opened a new game
and a new level* — and the affected buttons carry **just unlocked** where the
points figure normally sits, for exactly this one screen. If the run was the
last game needed on Easy, the banner also says the quiz shelf is now open.

**It is teal, not gold.** Gold already means "cleared at 100%" on these very
buttons and "there is credit on the table" on the boxes around them; a third
gold thing in the same block would mean "look here" and nothing more precise.

**The harness could not have caught this, and now can.** Its `saveAttempt` stub
accepted every run and forgot it, so a refreshed index came back identical and
everything derived from history — ladders, tries, medals, what a run unlocked —
was untestable by construction. The stub folds the row into the mock history
now. **Generalise: a stub that swallows writes cannot test anything that reads
them back.**

### Your record, before you choose

The picker shows what you have already done to that song at each level: average
and best accuracy, and — for quizzes — median and best time. Times are **this
device only**: a phone run and a keyboard run are not the same measurement, and
one merged figure would be neither.

**Every screen that asks the same question gives you the same answer — 1.31c.**
The level sheet — what you get when a game is drawn for you, and what **Next
game** puts up on its way to the following game — was three bare buttons reading
Easy, Med, Hard. It is the picker's question exactly, so it now carries the
picker's panel: this song's time limit, tries, best, average, last and how long
ago, per level. `songRecord` / `statsIn` / `statPanel` came out of the picker to
sit at module scope so both screens read the same numbers off the same code.
The song is loaded before the sheet is drawn, because that history is what the
panels are made of.

## The heatmap — what the app has learned about you

*Phase 1 shipped in **alpha 1.40**: the five quizzes paint, and games do not
yet. Phases 2 and 3 are at the foot of this chapter.*

A toggle beside **show chords** on the lyric sheet washes the song in blue
wherever you have been getting it wrong. Nothing else on the page moves; the
lyrics stay readable and the tint sits under them.

The point is to answer a question the score cannot: not *is this song cold*,
but **which part of it is the problem**. A song at 82 tells you to practise it.
A heatmap tells you it is the third verse, and inside it the two lines you
always swap, and inside those the one word you never get.

### It never gets a score

**The heatmap is allowed to POINT and forbidden to AGGREGATE.** It can show you
where the weak spots are and name the verse worth running. It must never
produce a total, a percentage, a "this song is 78% clean", or a league table of
your worst songs.

The reason is that the app already has a meter telling you what to practise —
the score, and hot and cold. A second number covering the same ground would
compete with it, and the cheaper one always wins: you would start playing to
clear blue rather than to learn songs. That is the same failure as 1.1a giving
every run a one-rest-day floor and making games too valuable, arriving through
a different door.

It is a picture to study before you play out, not a meter to clear.
**Generalise: a diagnostic that gets a score stops being a diagnostic.**

### The model: one formula, three grains

Every word, line and verse carries a **standing** from 0 to 100. Everything
starts at 100 and decays only when you get it wrong; getting it right pulls it
back up. One line does the whole job:

```
standing += (target - standing) x rate x weight
```

- `target` is what this run says the item is worth, 0 to 100.
- `rate` is `sting` when the target is below the standing, `mend` when above.
- `weight` is how much this source is trusted.

Because the move is always a fraction of the distance remaining, a standing can
never leave 0-100 and never needs clamping, and an item that has been wrong ten
times does not sit on a floor pretending it is as bad as it can get.

**The three grains differ only in what `target` is:**

| Grain | Target |
|---|---|
| **Word** | 0 or 100. You had it or you did not. |
| **Line** | the share of *that line's* words this run got right |
| **Verse** | the share of *that verse's* words this run got right |

So a fluffed word out of eight dents its line to 87.5 rather than condemning
it, and barely touches a thirty-two word verse. Ten fluffed words in that verse
sink it properly. The placement games feed the line and verse grains directly
with a target of 0 or 100, through the same formula, with no special case.

**Generalise: a continuous target turns three separate models into one.** The
first sketch had words be right-or-wrong, lines be right-or-wrong and verses be
something else again — three sets of rules to keep in step. A share between 0
and 100 makes them the same rule at three sizes.

### Where the evidence comes from

| Grain | Sources | Trusted |
|---|---|---|
| **Word** | all five quizzes, Scramble Words, Impostor Words | most |
| **Line** | Blank Lines, Scramble Lines, Impostor Lines, Order Lines, Build Lines | less |
| **Verse** | Order Verses, Build Verses | least |

Word evidence rolls up on the server: a run reports only the words it tested,
and the updater derives one line observation and one verse observation from the
share of *those* words that were right. The client never computes the rollup,
so the two can never disagree.

### Three rules the evidence has to obey

**Shown is not recalled.** Beginner prints the opening words of every line;
typing them back proves nothing. A run reports only the words that were
actually **masked**. By the same argument a word recalled under Hard's blank
page is stronger evidence than the same word under a first-letter mask — a
per-rung weight is the obvious later refinement, but v1 simply drops the words
that were given to you.

**Unreached is not wrong.** When a timed run expires, the sections you never
reached score zero *for points*, deliberately, so that running out of time
cannot be a strategy. Heat does the opposite: an item that was never put in
front of you produces **no observation at all**. Otherwise one lost clock
paints the back half of a song blue. Same for backing out of a practice run
halfway.

**Practice counts here, and nowhere else.** Practice still writes no attempt
row: no points, no unlock, no effect on any average, no spending the day. It
reaches the heatmap through its **own route**, `updateHeat`, which takes
observations and nothing else — so the rule that practice never creates a record
of a *run* stays true in the code and not merely in spirit. A credit run sends
its observations along with `saveAttempt`, inside the same lock, in one round
trip. Both call the same updater.

The reasoning: practice is most of your repetitions, and a picture of your
memory that ignored most of your repetitions would be a poor picture. Heat is
not a reward, so there is nothing to farm.

### Confidence is age, and nothing else

Each item stores **the day it was last observed** alongside its standing, and
the tint is scaled by how fresh that is:

```
freshness = 0.5 ^ (days since last seen / fade)
```

An observation counts for half as much after `fade` days, 90 by default.

**There is deliberately no count-of-observations term, and getting that wrong
first is worth recording.** The first draft scaled the tint by
`min(observations, 3) / 3` as well, on the reasoning that one sighting is thin
evidence. Working through what a first-time user would actually see killed it:
a word you had just got wrong would paint at **3.7%** — invisible — and the map
would stay blank through two full quizzes. You would conclude the feature was
broken, and you would be right to.

Two things were wrong with it:

- **It double-counted.** The standing ALREADY encodes how much evidence there
  is, because repeated misses drive it down: wrong once is 65, wrong four times
  is 18. Multiplying by a count as well charged twice for the same fact.
- **It was not what hid the untested items anyway.** A word nobody has tested
  sits at 100, and 100 has zero weakness, so it paints nothing whatever its
  confidence. The count term was solving a problem that did not exist.

The observation count is still stored, because the coverage line needs it and
because tapping a word to read *missed 3 of 5 times* is exactly the kind of
plain data this screen is for. It just does not dim anything.

**Generalise: before tuning a display, walk the first three sessions of a new
user through it with real numbers.** Both of this chapter's worst ideas died
that way and neither would have shown up in a review of the formula.

**Why the age half is not optional.** Beginner prints the opening words of every
line, so those words are never tested by it. Fight with a verse in March, learn
it, then spend six months playing only the low rungs, and the blue sits there
with no way to correct itself — the rung you enjoy cannot reach the words it
marked. Fading the confidence lets it go **pale** instead of either sitting
there forever or being falsely healed. Pale is the honest rendering of *I have
not checked lately*.

**Note what fades and what does not: the standing never moves on its own.**
Inventing a value nothing measured would be a lie of a different kind. What
decays is how much ink the app is willing to spend on a claim it can no longer
support.

**Stale evidence yields to fresh evidence twice as fast.** The rate is scaled by
`(2 - freshness)`, so a correct answer against a six-month-old standing of 40
moves it much further than the same answer would against one from last week.
Old evidence should not be sticky.

One consequence worth expecting rather than treating as a bug: a pale item you
then test can come back **darker**, because the app has gone from "I do not know"
to "I checked, and you are shaky on this". The tint is confidence in a claim,
not the size of the failure, so it deepens whenever evidence arrives — in
whichever direction the evidence points.

For the same reason the toggle carries a quiet coverage line: *painted from 61
of 214 words*. If you mostly play the low rungs, large parts of a song will
genuinely never have been tested, and blank space must not read as "all fine".

### The weakest verse is named, not shaded

A verse's target is a SHARE of its words, and shares are rarely extreme — miss
fifteen words of twenty-eight and the verse still only reaches 61 after three
runs, painting about 3%. The verse wash is therefore a background at best, and
"which verse needs work" is a question it cannot answer for weeks.

So the answer is given in words rather than ink. The line under the toggle
carries it: *painted from 112 of 112 words · weakest: verse 3*.

**Ranking works from the very first quiz, because ranking is scale-free** — it
does not matter that every standing is still near 100, only which is lowest. And
naming the weakest verse POINTS without AGGREGATING, so it stays inside the rule
above: it is a finger, not a percentage.

### Painting it

Blue only, at the weak end. A word that has never been missed sits at exactly
100 and paints nothing, so a song you know cold is clean paper.

The three layers **stack**, deliberately:

| Layer | Strongest tint |
|---|---|
| Verse wash | 8% |
| Line wash | 16% |
| Word tint | 32% |

A weak word in a solid verse gets a light tint. A weak word, in a line you keep
misplacing, in a verse you have never got through cleanly, gets all three and
becomes the darkest thing on the page — which is exactly where the eye should be
pulled. The finest grain is also the most confident, so it earns the most ink.

```
weakness  = (100 - standing) / 100
freshness = 0.5 ^ (days since last seen / fade)
alpha     = weakness x freshness x layer maximum
```

What that looks like on a word, at the default dials: miss it once and it is at
65, painting **11%** — soft, but enough to find. Miss it twice, 42 and **18%**.
Three times, 27 and **23%**, which is unmistakable. About seven clean runs takes
it back to invisible.

Words need wrapping in their own spans to be tinted, and that split goes
through `splitWord` like everything else, so a comma never gets painted as
though it were part of the word in front of it.

### Addressing, and surviving an edit to the lyrics

Standings are addressed **positionally**: section index, then line index, then
word index, over `realSections(song)` — so repeat markers are skipped, being
pointers rather than sections — and over `words()` within a line.

Positional addressing is compact and needs no keys, and it breaks exactly once:
when the lyrics are edited. So `apiSaveSong` re-anchors before it writes.

1. Build a map of the **old** lines by normalised text.
2. For each new line, claim an unmatched old line with the same normalised
   text. Carry its line standing across. Carry its word standings too **only if
   the word count matches** — otherwise keep the line and reset its words.
3. A new section inherits the verse standing of whichever old section it shares
   the most lines with.
4. Anything unclaimed starts fresh at 100 with no observations.

Fixing a typo therefore keeps the history for the whole song. Rewriting a verse
resets that verse and nothing else. Reordering the song costs nothing at all,
because nothing is keyed on position across an edit.

### Storage

One new column on the Songs tab, `heat`, holding a blob shaped like:

```json
{ "v": 1,
  "sections": [
    { "verse": [82, 6, 20320],
      "lines": [ [95, 4, 20331], [61, 5, 20320] ],
      "words": [ [[100,4],[88,4]], [[54,3],[100,2]] ] } ] }
```

Verses and lines carry `[standing, observations, lastDay]`; words carry
`[standing, observations]` and **inherit their line's day stamp**, because any
run that tests a word necessarily tests its line. That is one day-index per
line rather than per word — about 120 characters on a forty-line song.

The observation counts drive the coverage line and a tap-to-inspect readout;
they do not scale the tint. See above.

`lastDay` is a day index from the same `dayIndex()` the one-a-day uses, so
there is one definition of what a day is in this app.

The standing is rounded to a whole number and the count is capped — it only
drives confidence, so there is no reason to let it grow forever. A 214-word song
comes to roughly 2.5KB, comfortably inside the 50k cell limit.

It rides on the **loaded song**, never on the index. The index is read for all
242 songs on every boot and has to stay small.

A new column means bumping **`SCHEMA_VERSION`**, and a song gaining a field the
page draws with means bumping **`CACHE_VERSION`**. Both are standing rules.

### The dials

Under **gear -> Scoring**, expressed in the units you actually think in rather
than as raw constants, with a computed sentence underneath in the same style as
the floor dial:

| Dial | Default | Means |
|---|---|---|
| `sting` | 35 | how far a miss pulls the standing toward 0 |
| `mend` | 18 | how far a hit pulls it back toward 100 |
| `gameWeight` | 40 | what a game is worth against a quiz's 100 |
| `fade` | 90 | days after which an observation counts half as much |

At the defaults: **a word at 100 that you miss drops to 65, and takes about
seven clean runs to climb back over 90.** That sentence is computed and printed
under the dials, because the asymmetry decides whether the map nags you or
forgives you too quickly, and that is much easier to feel than to reason about.
Every one of these four numbers is a first guess.

### The cost, stated plainly

Everything scoring-related in this app is **derived, never stored** — ladders,
the one-a-day and the decay all recompute from the attempt history, which is why
they have never needed a migration and cannot disagree with the runs behind
them. **This is the first thing that is not.** If the weights change later they
cannot be applied backwards, and a bug in the updater quietly corrupts data
nothing can rebuild.

Two things buy that back, and both are cheap:

- The blob carries a **version stamp** (`v`), so a change to the model wipes
  standings rather than silently reinterpreting them.
- **Clearing a song's data clears its map.** Not a new button — the existing
  **Song sheet -> Edit -> Clear song data** already does the job, and leaving a
  map behind that was built out of runs which no longer exist would be
  incoherent: the ladders would reset while the heatmap went on remembering.

Note what that costs. That control currently clears **quiz data, game data, or
both**, separately. A map cannot be partially unwound, because the individual
results were never kept — only the running standings. So **any** of the three
clears the map, said plainly on the confirmation, which makes the partial clear
less partial than it is today. Most of the standings are quiz-driven anyway.

Everything else that looks like it would need a reset is already handled finer
than a reset could manage. Fix a typo and only that line re-anchors; rewrite a
verse and only that verse resets; change the dials and nothing resets at all,
because the standings simply carry on evolving under the new rate.

Held in reserve if it ever proves necessary: keep the last ten runs' results as
one character per word, about 3KB, and the standings become rebuildable. Not
worth it until something makes it worth it.

### How it gets built

Every grader already computes the right-or-wrong half of this — they all end in
`{right, total, rows}`. What none of them carry is an **address**, and the
results screen keeps only the mistakes. So the bulk of the work is a pass over
all thirteen modes to attach addresses to observations. Mechanical rather than
clever, but it touches every game, which is why it is phased:

1. **The five quizzes** — DONE, 1.40. They already grade word by word, they are
   the evidence that should count most, and words feed lines and verses through
   the rollup. This phase built the column, the updater, the re-anchor, the
   route, the toggle, the coverage line and all three shading layers.

   Measured on the test song, one quiz at a time, three deliberate mistakes in
   112 words: after one run those three words sit at **65** and paint at 11.4%,
   their lines at 92 and 94, the verses at 98 and 99. After a second run with
   the same three mistakes, **42** and 18.4%. Fix one on the third run and it
   climbs to 52 while the other falls to 27. Re-anchoring was checked against a
   punctuation-only fix (everything kept), a word added to a line (that line
   reset, nothing else), and two sections swapped (standings followed the text).
   A stale standing takes a correction further than a fresh one does — 42 goes
   to 52 today and to 60 after six months of silence — and a first-ever miss
   correctly does not get that boost.
2. **Scramble Words and Impostor Words** — two more word-level collectors into
   machinery that already works.
3. **The five line games and the two verse games** — placement evidence, the
   coarsest, last.

## The library, and finding your way round it

### The pantry shelves

Four lists the app works out for itself, from the state of each song rather than
from anything stored. A song moves between them on its own, overnight, and that
is the point — they are a reading of the library, not a filing system.

| Shelf | What is on it |
|---|---|
| **Plate** | Hot, with more than a week left. Nothing to do here. |
| **Counter** | Hot, but a week or less. The ones about to turn. |
| **Fridge** | Cold, still worth something, losing a little every night. |
| **Freezer** | Worn all the way to zero. A single run restarts them. |

They live in a menu that also holds Everything, the two burners, and your own
lists — reached by **tapping Pantry while already on the Pantry**. Since a
gesture like that is invisible, the Pantry tab wears a small chevron, and the
same menu hangs off a bar at the top of the page that names what you are looking
at and counts it.

Never-opened songs are on none of the four. Never quizzed is not a temperature.

### Burners and lists

**Front Burner** and **Back Burner** are two ordinary lists flagged with a
`role`. They are mutually exclusive — moving a song to one takes it off the
other; tapping the burner it is already on drops it back to library-only.

On any song row the two burners are stacked, back above front, as two beamed
eighth notes: stems up = front burner, inverted = back burner. The page icon
is custom lists, with a count when the song is on any. Any list can be promoted to either
burner from Library → select the list → *Make this the Front Burner*.

**A custom list has its own order — 1.70.** "Custom order" used to be the
songs' `sortIndex`, a single order for the whole library, so the same song
could not open one set and close another. A custom list now carries its own
running order (`order` on Lists, a JSON array of song ids). Songs it does not
name yet — added since it was last arranged — follow on, in library order. On a
custom list, *Custom order* and the ▲▼ arrows read and write the list's order,
moved within the whole list so a filter cannot reshuffle what it hides. The
burners keep `sortIndex`.

### Set List View — 1.70

A custom list's **Set List View** button opens a stage screen for playing a gig
off, not for practising. It covers the whole app (no header, no tab bar) and
closing it lands you back on the list.

- **One song at a time**, in the list's order: number, title, artist, the
  capo/key pills, then the **first line of every section** in song order —
  enough to find your way in, never the whole lyric. Choruses are offset in gold;
  a repeat marker shows where it falls, with the chorus's first line when there
  is exactly one section it can mean.
- **The capo pill lights up when it changes** from the song before — a capo
  change between songs is the thing most worth seeing coming. "No capo" shows
  when the capo comes *off*, or when it was explicitly set to none.
- **Moving on:** two big buttons (Next is the wide teal one and names the next
  song and its capo), a horizontal swipe, or the keyboard — arrows, Page
  Up/Down, space. That covers a Bluetooth page-turn pedal, which sends one of
  those.
- **Order** opens the running order over the stage: played songs dimmed, the
  current one highlighted. Drag the ≡ handle to move a song; tap a song to go
  straight to it. A drop saves the list's order at once, and the song on stage
  stays on stage whatever moved around it.
- **Aa** cycles three text sizes, remembered on that device.
- Asks the browser to keep the screen awake. Inside the Apps Script frame that
  may be refused; it fails quietly. Set auto-lock off for a gig if it is.
- Capo and key come from the song index (which carries both since 1.70), so
  every song shows them before any lyrics have arrived; the first lines fill in
  from the cache, the rest in one `getSongs` round trip.

The drag listens for the release on the **window**, not the handle, and moves
as many places as the pointer travelled in one event. Both were bugs in the
first pass: a quick flick crossed several rows between two pointer events and
moved one place, and a release the handle never saw left a row stuck mid-drag.

### A run you cannot take is not a run left — 1.52

**Games left today** and **Quiz left today** are sort keys, and both counted
everything on the shelf. That was right until 1.50 put locks on it: afterwards a
song nobody had ever opened reported eight games and a quiz still available, so
the sort floated exactly the songs with *nothing playable on them* to the top of
the list, above the ones actually waiting for you.

The quiz one was the louder bug because it is one-or-nothing: every song with
the whole shelf locked scored the same 1 as a song sitting there ready, and the
accuracy tie-break then sent the untouched ones first. Both count only what is
open now — no locked game, no game this song has too few sections for, and no
quiz at all while the beginner gate is shut.

**Generalise: when you add a gate, go and look at everything that was counting
what is now behind it.** A count that silently starts meaning something else is
worse than one that breaks.

### Phone, tablet, PC — 1.62

Detection used to be one threshold: a coarse-pointer touchscreen whose **short**
side is under 820px is a phone, anything else is a PC. That threshold runs
straight through the middle of the iPad range. A 9.7 or 10.2 inch iPad is 768
across and was counted as a **phone**; an iPad Air or an 11 inch Pro is 820 or
834 and was counted as a **PC**. The same tablet family landed in both buckets
depending on which one you picked up, and their times were being averaged into
two different populations.

Now the coarse-pointer test decides touch device or not, and a second threshold
splits phone from tablet at **600px**. That is the gap it belongs in: phones top
out around 430 across and tablets start at 768, so there is nothing near it to
get wrong. Modern iPadOS lies in its user agent and claims to be a Mac — none of
this reads the user agent, so it does not matter.

**Phone and tablet are timed together.** The reason times are never averaged
across devices is that a keyboard and a thumb are not the same measurement; a
tablet and a phone are the *same* measurement, taken on a bigger pane of glass.
Splitting them would buy a distinction nobody needs and pay for it by halving
the evidence behind every median on both — and by putting a third value into the
Attempts sheet that every row already written would not have. So `timingDevice`
collapses the three answers back to two, and **nothing new is ever stored**: the
sheet still only sees `phone` or `desktop`, and the third answer lives entirely
on the page.

**What the third answer is for is layout, and only layout** — one thing, so far.
The game picker lays its two variants side by side, which is right everywhere
there is room for it and wrong on a phone: each half is about 150px and has to
hold a name, a lock or spent tag, and three level buttons each carrying a label,
a points line and a stat panel. It was legible only because everything in it had
already been shrunk twice. On a phone it stacks — one column of eight instead of
four rows of two. A tablet has a PC amount of room and keeps the PC layout,
which is the whole reason the split was needed.

It is driven off a class on the body rather than a width query, because the
thing that is short of room is the **device**: a narrow window on a desktop is
not the same problem, since you can widen a window.

The Settings override is four ways now — Phone, Tablet, PC, Auto — and changing
it relays the page immediately, because it is a setting you can only judge by
looking at the screen it changes.

### The sort bar

Sort is a dropdown on the left, a **direction button** beside it, and the
filter box on the right — on both burners and every shelf of the Pantry. The
Library's old separate search box is folded into it. Each screen keeps its own
filter text, so typing in the Library does not silently narrow a burner.

**One entry per measurement, and a button for the direction — 1.53.** The menu
used to carry both ends of three sorts: Hottest and Coldest, Strongest and
Weakest, Most and Least practiced. Twelve options, half of them the same sort
read backwards, and a pair was never adjacent to its own opposite in your head
— you went looking for "coldest" under H. Naming the measurement once and
putting the direction on a button is six options with no lost pairs, and it
gives the other five sorts a reverse they never had: oldest-added, Z-A, fewest
games left. **Custom order** is the exception and the button hides for it: a
hand-made order has no opposite worth offering.

Changing the sort **resets the direction**. Picking "Strongest" off the menu
and being handed the weakest, with only a small arrow to explain why, is not a
setting anyone asked to carry over.

One sort comes from the heat model:

- **Hottest** — highest hot numbers down to 0, then cold songs with the
  gentlest rates, down to the ones bleeding hardest. Reversed, it is coldest
  first.

Never-quizzed songs sit at the bottom **in both directions**. They are not hot
or cold, they are unknown, and floating them to the top of a reversed Hottest
would bury the songs that are actually losing points tonight. The null tests
sit outside the direction multiply for exactly that reason.

**Each shelf has its own sort, and its own default — 1.53.** The Pantry used to
share one sort across Everything, all four smart shelves and every custom list,
which is one answer to seven different questions. The scope key is the shelf
now, and a shelf takes its default the first time it is asked:

| Shelf | Opens on |
|---|---|
| Front and Back burners | Weakest first |
| Pantry — Everything | Strongest |
| Plate, Counter, Fridge | Coldest first |
| Freezer | Most practiced |
| Custom lists | Strongest |

A burner is a to-do list, so the weakest song is the one you came for. The
Pantry is a trophy cabinet. Plate, Counter and Fridge are all "what is closest
to turning". The Freezer is already at zero, where heat says nothing at all and
the only thing left to rank on is how much work is in each song.

Because the bar is bound to a shelf rather than to the Pantry, **switching
shelves rebuilds the bar**, not just the list under it.

**Medals — 1.61.** Platinum, gold, silver, bronze, nothing; and inside each
of those five bands, whichever song has the **least left to do before the next
medal up**. So the gold at the top of the golds is the one a single run would
turn platinum, and the list reads as a queue rather than as a trophy cabinet
sorted by size. Every platinum has nothing above it to reach for, so the whole
band falls through to the alphabet — which is the only honest order for a set
of songs that are all finished.

"How much left" is a number, summed from the checklist the expanded page
already draws: every requirement of the next tier that is not ticked, weighted.
The weights are four **bands** rather than four multipliers —

```
passing a game  <  100% on a game  <  passing a quiz  <  100% on a quiz
```

— and the rung or the level adds one to four inside a band, so Hard outranks
Easy without ever outranking the class above it. A multiplier would let them
cross over, and five games coming out as a quiz is the one thing this must
never say. A counted line is **prorated**: "every game passed on Medium" at 7
of 8 is one game from done and sorts ahead of the same line at 1 of 8, which is
the only number on the checklist that says how far in you already are.

The weights live in `MEDAL_COST_BAND` on the **server**, beside `MEDAL_SPEC`
and the labels, and ride to the page on each checklist line. The page adds up
the lines that are not ticked and never decides what one of them is worth, so
the sort and the checklist cannot come to disagree about which song is nearer.
They are a ranking and not a currency: nothing is paid out of them, nothing is
stored, and changing one reorders a list and does nothing else anywhere.

A song whose checklist never arrived scores as unknown rather than as zero, and
sinks within its band. Reversed, the sort reads "fewest medals, most work
left" — but the alphabet stays A-Z, like it does on Hottest, because a tie is
still a tie and not a reason to run the alphabet backwards.

Two more sorts come from the one-a-day rule, added in 1.31a:

- **Games left today** — how many of the eight still have a scoring run in them.
- **Quiz left today** — whether the day's one quiz is still there.

They are the one thing the progress strip says that nothing could sort on, and
a song is worth opening in the evening exactly as far as it still has credit
runs in it. Ties break to the weakest song, and a never-opened song has every
run available so it honestly belongs at the top of both.

`filterBar`'s `onChange` must redraw **only the song list**. Redrawing the bar
itself rebuilds the input and drops focus after every keystroke, which makes
it impossible to type more than one letter.

### The back arrow owes you the place you left — 1.62

Forty songs is several screens. Opening the thirty-first, looking at it and
coming back used to put you at the top of the list with the thirty-first
somewhere below the fold, so every song you opened cost a scroll back to where
you already were.

The offset is written onto the **stack entry**, not into one variable per view,
because the stack is already the thing that knows what you have come through.
Push a screen and it starts at the top by construction — a fresh entry has no
offset on it — and pop back to one and its offset is still sitting there. Two
visits to the same list from different places therefore keep their own places,
which one variable per view could not do.

It is stashed **at the moment of navigation**, not on a scroll listener. The
listener is the tidier-looking version and it was written first: record
continuously, and the restore needs nothing but a read. It is also the version
that could not be checked, because **scroll events do not fire in the harness
browser at all** — and the listener has a real failure mode that needed
checking, since emptying the container collapses the document, the browser
clamps the offset to zero, and the event for that clamp would overwrite the
position a moment before it was going to be restored. The guard against it was
four lines and a `setTimeout`, and no way to tell whether any of it worked.

**Generalise: prefer the version you can verify over the version that is
tidier.** An untestable guard against an invisible bug is not a thing to ship,
and "it is obviously correct" is what everything in this file said before it was
written down.

Stashing at the two functions that navigate is deterministic and needs no guard.
It costs one thing — a repaint nobody asked for would restore a stale offset —
so `repaintIfSafe` stashes for itself before rendering. Those are all the
callers there are.

### Clearing one song

**Song sheet -> Edit -> Clear song data.** Three choices, with live counts:
quiz data, game data, or both. Games and quizzes go separately because they
mean different things — a pile of easy game runs is noise you may want gone
without losing the record of the Blind quizzes that actually cost you
something.

The score is derived from the runs, so clearing them takes the points with
them. The words, the lists and the burner placement are untouched. The
whole-library button under **gear -> Reset** is still there and is still far
blunter.

### The flagged songs

These say "Chorus" further down but the chorus was never indented, so it came
in as an ordinary verse and there is no reliable way to tell which block was
meant. They carry a flag in the library. Open one, and each verse gets a
**"This is the chorus"** button — tap the right one, once. Or indent it in the
Doc and re-import.

Listed under gear → *Waiting on a chorus tag*.

---

### Insights

Everything at the top of the page answers to **one window**, chosen once and
remembered: today, 3, 7, 15, 30, 90 or 365 days, or all time. Points banked is a
fact about a stretch of time, and a figure with no stretch attached tells you
nothing about whether you are keeping up.

- **Points per day** — what you banked in the window over the days it covers.
  The span is clipped to how long you have actually been playing, so a
  fortnight-old library asked for its yearly rate does not divide by 365 and
  report roughly nothing.
- **Points banked**, **On the board now**, **Earned all time**.
- **Quizzes per song** and **Games per song**, averaged over the songs you have
  actually opened.

The windows are aggregated on the server and shipped as seven numbers. A library
with a few thousand runs behind it would otherwise pay for its whole attempt log
on every load just to draw six figures.

**State of the repertoire** reads Steaming / Hot / Cold / Frozen / Never opened,
coloured on the same ember-to-blue axis as the score plate and the heat chip, so
hot looks hot everywhere in the app.

**Steaming split off from Hot in 1.50.** One bucket for everything with the
flame lit put a song resting until Thursday in with one resting until a
fortnight on Friday, and those are not the same standing at all — the second is
a song you have genuinely banked. Seven days is the line, because that is a
week: a song you do not have to think about between one sitting and the next.
The steaming songs are **named rather than counted**, since it is the one bucket
that is an achievement rather than a warning, and a handful of titles is worth
more than the number five.

**Games and quizzes** is one game-and-level or one quiz at a time, behind a
dropdown, counted across the whole library. Everything else on the page is about
songs; this is about the app.

The figure it exists for is **time left, as a share of the clock rather than in
seconds**. Every game's limit is a rate times the length of the song it is played
on, so forty seconds left on a nine-verse ballad and forty on a two-verse one are
not the same fact and cannot be averaged. The share can, and it reads straight
off as a verdict on the dial: a level finishing with two thirds of its clock
unspent is one where the countdown is doing no work at all, and one finishing
near zero — or expiring outright on a fifth of its runs — is a level being
decided by how fast you tap rather than by what you remember. The tile is
coloured on that reading: green, gold, red.

**It is a mean, not a median, and that is deliberate.** The runs that end at zero
left are exactly the ones a timer dial has to hear about, and a median quietly
throws them away. `expiredPct` sits beside it for the same reason: the average
can look healthy while a fifth of the runs are being graded mid-board.

Both ends of the countdown are stored on the attempt row as of 1.50 —
`secsLeft` and `secsLimit` — because neither is any use without the other.
Quizzes leave both blank; a stopwatch has nothing left on it. Practice runs
build no clock at all, so they store nothing, and neither do forfeits: a forfeit
is a fact about a day, not about how hard a level is.

Every row of the panel draws whether or not there is history behind it, with an
em dash where a number would go. An untouched level is exactly the thing you
want to notice, and a panel that hid its empty rows would be one that quietly
stopped mentioning them.

**How you quiz** is a pie — one circle with a dash pattern per slice, offset by
everything before it, which is far less arithmetic than building arc paths and
cannot produce a sliver that fails to close. Retired modes still in your history
get a slice under their old name.

The key is names only, down the left. **The numbers live on the chart**: hover a
slice and the hub reports its count and share. Printing every figure in the key
as well made the key the widest thing on the page, and the hub was sitting there
saying "18 runs" regardless. Each slice also carries a native tooltip, which is
what touch and keyboard get instead of hover.

The **attempt log** on a song sheet has two dropdowns sharing a line: what kind
of run to show — everything, games only, quizzes only, or one named mode — and
how many. Only modes that appear in that song's history are offered.

Each row carries **what the run banked — 1.53**, between the clock and the
percentage. The log had never said, and the percentage does not stand in for it:
90% on a game is worth less than 78% on a Hard quiz, and since 1.53 a run
against arrears can be worth 3 and move the score by 1. The figure shown is what
the score actually moved by; where the two differ, the debt it settled rides
underneath in smaller type and the gross award is in the tooltip. Attempts
recorded before 1.53 have no net figure stored and fall back to the award.

## Getting songs in and out

### Writing a song back to the songbook

Any song the app created (source `manual`) shows **Add this to the songbook doc**
on its song sheet. It writes the song into the Doc using the Doc's own
conventions, so the page looks hand-typed and the importer reads it back
identically:

| In the app | Written as |
|---|---|
| title | Heading 1, bold |
| artist | plain line under the title |
| Capo / Intro | plain lines under the artist |
| verse | plain lines, flush left |
| chorus | lines indented half an inch, **chord lines indented too** |
| repeat marker | centred and bold |
| chord line | bold, Courier New |
| between sections | an empty paragraph |
| between songs | a page break, so each song owns a page |

Each song also stores the Doc's own **heading anchor**, so the book icon on a
song sheet opens the songbook scrolled to that song rather than to the top.
Anchors are captured on import and refreshed on every later import, including
for songs that are skipped, because Docs reissues heading ids when the document
is edited. A song written from the app has no anchor until the next import.

The page break is attached to the **last paragraph of the previous song**, with
the new heading immediately after it and no blank line between - which is what
223 of the 228 breaks already in the songbook do. If the last paragraph already
carries a break, another is not added.

Two things to know:

- It **appends at the end**, not alphabetically. Slotting it in means walking
  ~8,900 paragraphs through `DocumentApp`, the slow path this app avoids, and
  the importer matches on title so position never mattered. Move it yourself if
  you want it filed.
- Songs written from the app have **no chords**, because the editor only
  captures lyrics. Add the chords in the Doc afterwards if you want them.

After writing, the song is marked as coming from the doc, so a later import
matches it by title and skips it rather than creating a duplicate.

### Writing a song back: type and fit

Two things the write-back now does that it did not before.

**It uses the book's own font.** The face and size are sampled from an
existing paragraph rather than hardcoded — a real body paragraph for the
lyrics, a Heading 1 for the title, skipping bold ones because those are chord
lines. The whole point is that a written-back song is indistinguishable from
one that was always there.

**It shrinks to hold one page.** The song is laid out on paper before a word
is written, because the type size depends on how much there is. Every
paragraph is costed at its point size times the default 1.15 leading plus the
book's paragraph spacing, and a line long enough to wrap costs whole extra
lines. The largest scale at or below 1 that still fits is the one used.

It is an estimate — Docs will not report a paragraph's height until it has
laid it out — so it errs small. It never scales *up*, and it stops shrinking
at 0.6: past that it is too small to sing from, and overflowing onto a second
page is the better failure. The confirmation tells you the font and size it
landed on.

### Looking lyrics up

The song form has a **Search for lyrics** button beside the Lists box. It
takes the title and artist typed above and tries two keyless sources in order:
**LRCLIB** first, because it matches on artist *and* track and returns clean
plain text, then **lyrics.ovh** as a fallback (which needs an artist to work at
all).

Whatever comes back is guessed into verses and choruses two ways: explicit
`[Chorus]` / `[Verse 2]` headers when the source has them, otherwise by
repetition — the block that appears more than once is the chorus. Repeats are
folded into one, which is how the songbook writes a chorus: once, indented,
with later returns marked rather than retyped. Genius-style junk lines
(`12Embed`, "You might also like") are dropped.

**It will not always be right.** The preview exists so nothing lands in the
form unseen: it names the source, says whether the structure was labelled or
guessed, and shows the split before you accept it. If there are already
lyrics in the form it asks before replacing them.

> **This is the only thing in the app that reaches outside Google**, so it
> needs an external-request permission the old builds never asked for. After
> pasting this build, **run any function once in the editor** (`setup` is
> fine, it is safe to re-run) and accept the new permission, **then redeploy**.
> Skip this and the button will fail with an authorization error.

### Repeats

A verse or chorus that comes back round is a **pointer, not a copy**. Each
section in the editor has a **Repeat** button; it adds a block at the end that
points at that section, and you move it where it belongs. The words live in
one place, so editing them keeps every repeat in step, and renumbering follows
automatically — turn Verse 2 into a chorus and a repeat pointing at it
relabels itself.

It saves as the same centred marker the songbook already uses, so a repeat
here and a repeat in the book are the same object. Markers coming the other
way are matched back to a section by label: one block called "Chorus" binds to
a "Chorus" marker. Anything ambiguous (two choruses) or not a section at all
("Solo") stays as literal text and round-trips unchanged.

Delete the section a repeat points at and the repeat says so in red rather
than silently pointing at nothing. It still writes as a marker.

> Worth knowing: **before this the editor dropped markers entirely.** It
> skipped them on load and never wrote them back, so opening any imported song
> with a "Chorus" marker and pressing save quietly deleted it. If you have
> edited songs since the first import, some may have lost theirs — a re-import
> will not restore them (it matches on title and skips), so those need the
> Repeat button by hand.

### Capo and key — 1.64

Every song has three fields in the editor: **Playing key** (the chord shapes),
**Capo** (No capo, I–XII), and **Sounding key**, which is not entered — it is the
playing key moved up a semitone a fret, worked out on the page. C with capo III
sounds E♭. Minor stays minor (Am, capo V → Dm), and the result is spelled the
way a key is usually written (E♭, not D♯). The header of the song page carries
it as one line: *Playing C · Capo III · Sounding E♭*.

Only the two inputs are stored (`playKey`, `capo` on Songs), so the third can
never disagree with them.

**A blank capo falls back to the songbook.** A song imported with a `Capo II`
line shows capo II until you choose something in the app; "No capo" is stored
as 0, so it is a choice and wins over the doc. The fallback is applied only
where a song is handed to the page, never on the way back to the sheet, so a
re-import that changes the doc's capo line is still picked up. The doc's capo
line is left out of the grey meta line, since the key line now speaks for it.

## Storage, caching and speed

### Why it is quicker than it was

Three things, none of which dropped any tracked data:

1. **The index no longer reads the lyrics.** `sections` is 93% of the Songs
   sheet (393KB of 424KB across 242 songs) and the index it builds contains no
   lyrics at all, so every page load was hauling the whole songbook across and
   throwing it away. It now reads the two column ranges either side of it. The
   section count it needed from those lyrics lives in its own `sectionCount`
   column, backfilled once on first load after upgrading.
2. **Single-song operations read a single song.** Opening a song, starring one,
   moving it between burners, tagging a chorus, writing it to the doc — each
   used to read all 242 rows to touch one. They now find the row from the id
   column and read just that row. Reordering reads only the id column, since it
   writes one cell.
3. **The workbook and sheet handles are cached per request.** Every read and
   write used to re-open the spreadsheet and re-run the header migration check —
   an extra round trip each time.

**What no amount of this fixes:** Apps Script has a fixed per-call overhead of
roughly 200-500ms. The app will always feel like it is talking to a server,
because it is.

A second round of the same work removed most of what was left:

4. **Meta is read once per request, not per lookup.** `getSettings()` did two
   Meta reads and was called three times in one request - eight round trips to
   fetch four small values. Both the Meta rows and the settings are memoised for
   the life of a request.
5. **The header migration check is skipped once the schema is known good.** It
   cost four round trips per tab, per request, to learn nothing had changed. A
   `schemaVersion` flag in Meta records that every tab is up to date.
6. **Saving is one server call, not two.** It used to save and then wait on a
   full index refresh before navigating. It now patches the index in place, goes
   straight to the song, and refreshes in the background.

Opening a song went from about nineteen round trips to five or six.

**Two rules to keep** if you edit the server:

- Anything that writes a song back with `songToRow` must have read that row
  **in full**. `readSongIndexRows` returns blank lyrics by design, so writing
  from it would erase the song. Only `apiInit` uses it, and it never writes.
- **If you add a column to any tab, bump `SCHEMA_VERSION`.** Otherwise the
  header check is skipped, the new column never gets created, and reads run off
  the end of the sheet.

### The local cache

The app keeps a copy of the song index and of every song you open in the
browser's `localStorage`, so a song opened yesterday paints instantly today
instead of waiting on a round trip. It also warms the cache for both burners in
one background call after the first paint, which is what makes the *first* open
of a burner song quick.

It is deliberately unreliable-by-design: every read and write is wrapped, and if
storage is full, blocked, or the sandbox origin rotated between sessions, the
cache simply misses and the app behaves exactly as it did before. If storage
fills up it throws away the song bodies and keeps the index.

Scores decay daily, so a stored song is always slightly stale. It is painted
immediately and corrected from the server a beat later. A background refresh
only ever repaints a listing screen - repainting mid-quiz would wipe what you
had typed.

**If you edit the page:** clearing a cached song must go through `dropSong` or
`dropAllSongs`. Clearing only `S.cache` leaves the stored copy behind, and the
next open paints the old lyrics. Bump `CACHE_VERSION` if the shape of the stored
index changes.

## The settings screen

Cards in the order you reach for them: **Songbook**, **Scoring**, **The
timer**, **Games and quizzes**, **This device**, then **Reset**.

Which dials a thing *has* is decided by the server: a level object only carries
its own keys, and the screen renders whatever it finds against a table of
labels. So something can never be tunable in one place and not the other.

Games and quizzes each have a reset-to-defaults button of their own.

### Nothing in the file is anybody's — 1.60

The app used to carry two file ids as constants: the spreadsheet it read and
the Google Doc it imported from. That made it one person's app in a way that
was not obvious from reading it, and unsendable in the most dangerous way
available — the script reached **past** the sheet it was pasted into and into
the one named in the source. Someone installing it into their own blank sheet
got a permission error and an empty sheet, which at least fails loudly. But if
the named sheet had ever been shared with them, `setup` **succeeded**: their
app read and wrote someone else's library, their runs landed in someone else's
Attempts tab, and nothing anywhere on screen said so.

**Generalise: a wrong default that silently works is worse than one that
fails.** The failure mode to design against is not the error, it is the success.

Two changes, and neither adds a screen:

- **The sheet locates itself.** `SHEET_ID` blank means "the spreadsheet this
  script is attached to", which is the only sheet a bound script should ever
  have been reading. Reaching `ss()` with no active spreadsheet means the file
  was pasted into a standalone project rather than into a sheet's own editor,
  and the error says exactly that rather than failing as a null further in.
  `setup` now names the spreadsheet it just built, because that is the one
  moment where being pointed somewhere wrong is both possible and invisible.
- **The songbook is set in the app**, under Settings, and kept in `Meta` with
  every other setting — so it survives a code paste and needs no redeploy.

**What is pasted is a link, not an id.** What people have is the thing in the
address bar; the id is buried in it. `docIdFrom` takes a bare id, a
`/document/d/<id>/edit` URL, and a URL carrying a `#heading` or `?usp=sharing`,
and lands them all in the same place.

**It is opened before it is saved.** An id that parses is not a document you
can read — it may be a spreadsheet, a file someone else owns, or a typo of the
right shape — and the alternative to checking at save time is the import
failing minutes later with a Google error naming none of that. The title comes
back with the check, so the panel says *which document* it is pointed at rather
than echoing the id.

**A blank songbook is a first-class state, not an error.** Songs can be added
by hand and their words looked up, so an install with no doc is a working
install. The import panel says so and shows no button, and the song sheet drops
both the *Songbook* link and *Add this to the songbook doc* — a control that
can only fail is not offered.

### Nothing here writes until you say so — 1.41

Every control used to post the moment it changed. Dragging one slider from 1 to
8 wrote eight times, each write dropping every cached song and rebuilding the
index, each one toasting *Saved* over the last. Worse than the waste: there was
no way to try a number and change your mind, because the trying WAS the
committing.

An edit is **staged** now. It is applied to the local copy at once, so the
screen keeps showing what you typed and every computed line under a dial
recomputes off it, and it is merged into a single patch that one **Save** posts
in one write. **Discard** throws the patch away and pulls the stored settings
back. The bar is sticky, because the dial you just changed can be a screen and
a half above the foot of the page and a save button you have to go looking for
is a save button you forget to press.

The **resets** stay immediate. They are already behind a confirm, they replace
whole blocks rather than single dials, and half a reset is not a thing anyone
wants staged. If there is a staged patch when you reset, the confirm says so
and the patch goes with it.

**The leave-guard shipped with the change that created the need for it**, not
after. `guardCreditRun` now guards two things: a credit run in progress and
settings you have typed and not saved. Both are silent losses otherwise, and
the second one only became possible the moment the screen stopped writing on
every keystroke.

**Generalise: the moment you make something losable, make it hard to lose.**

### Games and quizzes are one panel

The dropdown under **gear → Games and quizzes** lists the whole set in two
groups. Picking a game draws its three levels; picking a quiz draws **one**
card, because the mask a quiz shows you IS its difficulty — there are no levels
to tune, only what it is worth and what it has to beat.

**The dropdown lists the thing, not the side of it — 1.31c.** Order Verses and
Order Lines are one game asked of two different units, and so are the other
three pairs: they share a blurb, they share the shape of their dials, and you
go looking for one because the other has just annoyed you. Thirteen entries,
eight of them halves of something, made you hunt for a pair the picker has
always drawn side by side. The list is now **four families and four quiz
rungs**, with the two halves on a switch directly under it — tap VERSES or
LINES and its tuning is what is drawn below. The two Beginner quizzes go the
same way for the same reason: they are alternatives at one height, not steps,
which is exactly how the picker shows them.

**Three levels abreast, and the words said once.** The levels used to be three
cards stacked down the page, so comparing Easy with Hard — the whole reason you
are on this screen — meant scrolling between them and holding both in your
head. They are three columns now. The first cut of that put a full card in each
column, which said everything three times: every dial name, and under it every
line of explanation, once per column, until two thirds of the screen was the
same sentence again. So the dial is named once across the full width and its
**three boxes sit under the three headings**. The only thing that repeats is
what a level genuinely makes of the dial — the real time limit under a
seconds-per-line rate, what a floor banks under a floor — in small type under
the box it came out of.

**Generalise: if a thing is the same at all three levels, it is said once.**
Repetition in a settings screen is not thoroughness, it is noise you have to
read past to find the number you came for.

That folded the old separate "Quizzes" points card away. `QUIZ_SPEC` declares a
quiz's dials the same way `GAME_SPEC` declares a game's, so the Settings screen
renders both off one table and neither can be tunable in one place and not the
other.

Quiz values moved from `settings.points[id]` to `settings.quizzes[id] =
{pts, floor}`, which is the same shape games use. Anything you had set under
`points` is migrated onto it.

## Working on the code

The page lives in one template literal at the bottom. Three characters must
never appear inside it: a **backtick**, a **`${`**, and a **backslash**. JS eats
a lone backslash before the browser sees it — that is what silently broke the
freezer app, where a regex digit class degraded to a literal letter and every
date rendered as `-`. Use `String.fromCharCode` and string methods instead.

`BUILD` is printed at the bottom of every screen, so "which version am I
looking at" is answerable at a glance. Bump it when you change the page.

### Standing rules

- Anything writing a song back with `songToRow` must have read that row **in
  full** first.
- Anything writing a **Lists** row with `writeRow` must carry `order` across —
  `writeRow` writes every column, so a rename that forgets it wipes the set
  list's running order.
- Add a column to any tab and you must bump **`SCHEMA_VERSION`**, or the
  header migration is skipped and the tab is read with more columns than it
  physically has. (1.3a added `practice` to Attempts, so it is `s4`.)
- The two new Songs columns are counts the game time limits are rates against.
  They are stored, not derived on read, for the same reason `sectionCount` is:
  the picker needs them for every song in the library and cannot open 242 sets
  of lyrics to get them. `backfillCounts` fills them once, behind its own stamp.
  **`sectionCount` counts PLAYABLE sections** — a repeat marker is a pointer,
  not a section — which it did not before 1.2a.
- Change the shape or the defaults of the settings blob and bump
  **`SETTINGS_REV`**, or a stored blob from the old world will quietly override
  the new balance and nothing you changed will take effect.
- Clearing a cached song goes through **`dropSong` / `dropAllSongs`**, never
  by assigning to `S.cache` directly — otherwise memory is cleared and
  localStorage is not, and the next open paints stale lyrics.
- Bump **`CACHE_VERSION`** whenever a song or index gains a field the page
  draws with. A stale index means the stored *songs* are stale too, so the
  boot path drops both together — the songs must never outlive the index that
  vouched for them.
- `filterBar`'s `onChange` redraws the list only. See "The sort bar".
- **Punctuation goes through `splitWord` and nothing else.** Masks, chips,
  boards, the word pool and the grader all take lead / core / trail from that
  one function. The bug it replaced was two filters that disagreed about
  whether a curly apostrophe was a letter, which is exactly the kind of thing
  a second copy of the rule produces.
- **Bump `CACHE_VERSION` when the SETTINGS shape changes too**, not only the
  song or index shape. The cached blob carries the settings, and a restored blob
  from an older build can be missing dials the games now read —
  `shareOf(n, undefined)` is `NaN`, and the board comes up empty. It is `s4`.
- **Stubs in `tools/mkharness.py` must be LIFTED, not hand-rolled.** Three
  separate false results came from stubs that had drifted: a `saveAttempt`
  returning a flat object made `outcomeHtml` throw on every run, which was
  reported on screen as the WRITE failing; a hand-built settings blob left the
  new quiz dials empty so the Settings screen rendered blank cards; and a
  hardcoded `points: 3` made the floor — the one dial whose whole job is to
  decide when a run is worth nothing — completely untestable. The harness now
  lifts `computeSettings` and `pointsForAttempt` out of the file and stubs only
  `metaGet`.
- **An Impostor game grades what is on the page**, so the share it plants has
  to keep doing-nothing under the 75% floor. Any dial there that is a COUNT
  rather than a SHARE is a bug on a long song: three wrong lines out of forty
  is 92% for sitting still.
- **A NEW dial does not need a `SETTINGS_REV` bump; a changed BALANCE does.**
  A dial nobody has ever stored is absent from every old blob, `num()` falls
  back, and the level takes the default — which is what a bump would have done
  anyway, except a bump would also have thrown away every dial he HAD set. Add
  the one carry-across line next to the others and leave the revision alone.
  (`CACHE_VERSION` still moves, because the shape the page reads changed.)
- **A grader must charge one mark for one mistake.** Anything that zips a list
  the player controls onto a list the song controls will cascade the moment the
  two lengths differ. Reconcile first, then compare.
- **The heat address space is `realSections` -> non-empty lines -> `words()`,
  and THE PAGE OWNS IT.** Anything that changes which sections or lines are
  counted - a new filter in `typableLines`, a change to what `realSections`
  skips - moves every address in every song at once, silently, and the tint
  then lands on the wrong words. The server never independently computes the
  dimensions; it grows its blob to fit whatever arrives. The one exception is
  the re-anchor, which needs a word count, which is why `heatWordCount` exists
  and why it splits exactly the way `words()` does.
- **Hit lists are aligned to the SONG's words, not to the diff's tokens.** The
  token list is longer than the line whenever you type a word the song does not
  have. Only equal, sub and delete consume one of the song's words.
- **Never let a timer and a button drive the same transition.** Both will fire,
  and the second lands on a state that has already moved. If a board must
  advance itself, the manual control has to invalidate the pending one - or the
  automatic advance should not exist.
- **Lifting a function into the harness lifts its dependencies too.** 1.61
  added `medalGameCost` beside `medalsFor`, which is lifted; the new name was
  not, and the harness came up on the static "could not reach your songbook"
  screen with `medalGameCost is not defined` — a failure that reads as the
  BRIDGE being broken when it is really the lift list being short. Adding a
  helper that lifted code calls means adding it to the list in
  `mkharness.py` in the same edit.
- **A REPEATED LINE IS NOT A DUPLICATE TO BE COLLAPSED.** Songs repeat lines;
  anything that de-duplicates by text will eventually hand two gaps one answer,
  grade two identical cards as though they were distinguishable, or plant a
  ringer that is really a right answer. De-duplicate ringers against the truth,
  never the truth against itself.

### The page literal ends where the STATEMENT ends

Both tools used to find the end of PAGE by scanning forward for the first
backtick. That is the same character the page is forbidden to contain, so a
stray one INSIDE the page silently defined the slice: the page looked clean to
the forbidden-character scan, because the offending backtick had become the
terminator, and the rest of the page was handed to the server parser. The
report was `server half parse error: Line 8724: Unexpected identifier`, six
thousand lines from the mistake, in the half of the file that had nothing wrong
with it.

Both tools now take the last backtick-semicolon in the file, which is what
actually closes the statement, so everything before it is page content and the
scan can name the character and its line. Building 1.40 tripped this within
minutes — two backticks in a comment I had just written — and the difference
between the two diagnostics was the difference between a minute and an hour.

**Generalise: never let the thing you are checking for double as the delimiter
you check within.** The failure mode is not a missed error, it is a
confidently-reported error somewhere else.

### Verifying without a JS runtime

There is no node/deno on this machine, so checks are: parse both halves with
esprima, scan the PAGE literal for the three forbidden characters, cross-check
routed actions against `api(...)` calls and `VIEWS.*` against `go(...)`
targets, and flag any function whose only statement calls itself.

**The three forbidden characters are backtick, `${` — and BACKSLASH.** 1.31a
shipped with two backslashes in the PAGE literal and the app would not start at
all. It is worth understanding, because it is invisible in the file and fatal in
the browser:

`PAGE` is a **template literal**, so JS resolves escape sequences when it builds
the string, before HtmlService ever sees it. Writing `'` inside a page string
to escape an apostrophe therefore does the opposite of what it looks like — the
template literal eats the backslash, and the browser is served a bare apostrophe
that closes that single-quoted string early. The result is a **syntax error in
the inline script**, so the whole app IIFE never runs, `boot()` is never called,
and the static `<div class="loading">Loading your songbook...</div>` that ships
in the page body stays on screen forever.

That last detail is what made it hard to read: **the stuck message is the static
one, and it is word-for-word what `boot()` prints while waiting on the server.**
"Stuck at loading your songbook" therefore means *either* the server call never
came back *or* the script never ran at all, and they look identical. The console
says which in one line.

The convention that avoids all of it: **never put an apostrophe in a page
string.** Rephrase. Nothing in the file needs an escape, so a backslash anywhere
inside PAGE is now a hard failure in `check.py`, which prints the offending line.

**And the harness now resolves the template's escapes**, which is why it did not
catch this the first time: `mkharness.py` sliced the page out of the raw file
text, so it saw `'` — a correctly escaped apostrophe — and ran perfectly, while
production could not parse the same page. A harness that does not reproduce the
build step is not reproducing production. **Generalise: if the shipping artefact
is produced by a transformation, the harness has to apply that transformation.**

That last check is not paranoia. Build q shipped a call to **`currentRoute()`,
a function that never existed** — the real one is `route()`. It sat inside two
`.catch(function () {})` handlers, so it threw silently and simply stopped the
background repaint and the burner prefetch from ever running. Both of build
q's headline features were dead on arrival and nothing in the UI said so. A
scan for undefined identifiers found it in seconds.

Both scripts now live in **`tools/`** beside `Code.gs` rather than in a session
scratchpad: `python tools/check.py` for the static pass, `python
tools/mkharness.py` to rebuild `tools/harness.html`, then serve that folder
and open it. Rebuilding them from memory every time was its own tax.

For anything visual or behavioural, `mkharness.py` builds a
**runnable** copy: the real PAGE, the real scoring engine lifted out of the
server half, and a stubbed `google.script.run` in front of mock data. It runs
in a browser, which is how the colour-scale collapse above was caught — the
arithmetic was fine, the *result* was a library where the rust end could never
be reached.
