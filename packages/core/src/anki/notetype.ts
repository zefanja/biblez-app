// The "Bible Memorizer" note type, identical to the Anki add-on (model.py v1.5),
// so exported notes look and behave exactly like add-on notes.

export const NOTETYPE_NAME = "Bible Memorizer";
/** Fixed id so repeated exports update the same note type instead of duplicating it. */
export const NOTETYPE_ID = 1731000000001;

export const FIELD_NAMES = [
  "answer",
  "verse_number",
  "verse_part",
  "table",
  "front",
  "back",
  "first_letters",
  "last_letters",
  "title",
  "id",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];
export const SORT_FIELD_INDEX = FIELD_NAMES.indexOf("id");

export const CARD_CSS = `.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
    background-color: white;
}

.back {
    color: blue;
    font-style: italic;
}

.table {
    font-size: 16px;
    margin: auto;
    max-width: 600px;
}

table {
    table-layout: fixed; 
    width: 100%; 
    border-collapse: collapse; 
    border: 1x solid;
}

td {
    word-wrap: break-word; 
    vertical-align: top; 
    padding:.3em;
}

td:last-child {
    background-color: orange;
}

.highlight {
    background-color: yellow;
}

.card.nightMode {
    background-color: #333;
}

.nightMode .back {
    color: yellow;
}

.passage {
    font-size: .8em
}

.front, .back {
   font-family: serif
}`;

// Card 1: Last-Letters-Übung (nur erzeugt wenn last_letters nicht leer)
const CARD1_FRONT = '{{#last_letters}}\n<div id="card">\n<div>{{title}}</div>\n<div class="passage">{{verse_number}}{{verse_part}}</div>\n<br>\n<div class="front">{{front}}\n{{last_letters}}</div>\n</div>\n{{/last_letters}}';
const CARD1_BACK = '{{FrontSide}}\n<br>\n<hr id="answer">\n<div class="back">{{answer}}</div>\n';

// Card 2: First-Letters-Übung
const CARD2_FRONT = '<div id="card">\n<div>{{title}}</div>\n<div class="passage">{{verse_number}}{{verse_part}}</div>\n<br>\n<div class="front">{{front}}\n{{first_letters}}</div>\n</div>';
const CARD2_BACK = '{{FrontSide}}\n<br>\n<hr id="answer">\n<div class="back">{{answer}}</div>\n';

// Card 3: Übersichtstabelle (nur wenn table nicht leer)
const CARD3_FRONT = '{{#table}}\n<div id="card">\n<div>{{title}}</div>\n<div class="passage">{{verse_number}}{{verse_part}}</div>\n<br>\n<div class="table">{{table}}</div>\n</div>\n{{/table}}';
const CARD3_BACK = '{{FrontSide}}\n<br>\n<hr id="answer">\n<div class="back">{{answer}}</div>\n';

// Card 4: Kontext-Karte (front -> back)
const CARD4_FRONT = '<div id="card">\n<div>{{title}}</div>\n<div class="passage">{{verse_number}}{{verse_part}}</div>\n<br>\n<div class="front">{{front}}</div>\n</div>';
const CARD4_BACK = '{{FrontSide}}\n<br>\n<hr id="answer">\n<div class="back">{{back}}</div>';

export const TEMPLATES = [
  { name: "Card 1", qfmt: CARD1_FRONT, afmt: CARD1_BACK },
  { name: "Card 2", qfmt: CARD2_FRONT, afmt: CARD2_BACK },
  { name: "Card 3", qfmt: CARD3_FRONT, afmt: CARD3_BACK },
  { name: "Card 4", qfmt: CARD4_FRONT, afmt: CARD4_BACK },
];


const idx = (f: FieldName) => FIELD_NAMES.indexOf(f);
export const TEMPLATE_REQ = [
  [0, "all", [idx("last_letters")]],
  [1, "any", [idx("front"), idx("first_letters")]],
  [2, "all", [idx("table")]],
  [3, "any", [idx("front"), idx("back"), idx("answer")]],
];

export function notetypeJson(deckId: number, nowSec: number, id: number = NOTETYPE_ID): Record<string, unknown> {
  return {
    id,
    name: NOTETYPE_NAME,
    type: 0,
    mod: nowSec,
    usn: -1,
    sortf: SORT_FIELD_INDEX,
    did: deckId,
    tmpls: TEMPLATES.map((t, ord) => ({ name: t.name, ord, qfmt: t.qfmt, afmt: t.afmt, bqfmt: "", bafmt: "", did: null, bfont: "", bsize: 0 })),
    flds: FIELD_NAMES.map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, description: "", plainText: false, collapsed: false, excludeFromSearch: false })),
    css: CARD_CSS,
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
    latexsvg: false,
    req: TEMPLATE_REQ,
    tags: [],
    vers: [],
  };
}
