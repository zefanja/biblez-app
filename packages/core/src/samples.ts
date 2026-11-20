// Passages embedded in the app (exact text from the generated Bible data),
// so the first lesson works instantly and offline. Everything else is loaded
// from bibles/<translation>/ (see scripts/build-bibles.ts).

import type { Verse } from "./text/parse";

export interface SamplePassage {
  id: string;
  title: string;
  translation: string;
  translationId: string;
  language: "de" | "en";
  verses: Verse[];
}

export const SAMPLES: SamplePassage[] = [
  {
    "id": "joh-3-16-lut1912",
    "title": "Johannes 3,16",
    "translation": "Luther 1912",
    "translationId": "lut1912",
    "language": "de",
    "verses": [
      {
        "number": "16",
        "text": "Also hat Gott die Welt geliebt, daß er seinen eingeborenen Sohn gab, auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben."
      }
    ]
  },
  {
    "id": "ps-23-lut1912",
    "title": "Psalm 23",
    "translation": "Luther 1912",
    "translationId": "lut1912",
    "language": "de",
    "verses": [
      {
        "number": "1",
        "text": "Ein Psalm Davids. Der HERR ist mein Hirte; mir wird nichts mangeln."
      },
      {
        "number": "2",
        "text": "Er weidet mich auf grüner Aue und führet mich zum frischen Wasser."
      },
      {
        "number": "3",
        "text": "Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen."
      },
      {
        "number": "4",
        "text": "Und ob ich schon wanderte im finstern Tal, fürchte ich kein Unglück; denn du bist bei mir, dein Stecken und dein Stab trösten mich."
      },
      {
        "number": "5",
        "text": "Du bereitest vor mir einen Tisch im Angesicht meiner Feinde. Du salbest mein Haupt mit Öl und schenkest mir voll ein."
      },
      {
        "number": "6",
        "text": "Gutes und Barmherzigkeit werden mir folgen mein Leben lang, und ich werde bleiben im Hause des HERRN immerdar."
      }
    ]
  },
  {
    "id": "john-3-16-bsb",
    "title": "John 3:16",
    "translation": "Berean Standard Bible",
    "translationId": "bsb",
    "language": "en",
    "verses": [
      {
        "number": "16",
        "text": "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life."
      }
    ]
  },
  {
    "id": "ps-23-bsb",
    "title": "Psalm 23",
    "translation": "Berean Standard Bible",
    "translationId": "bsb",
    "language": "en",
    "verses": [
      {
        "number": "1",
        "text": "The LORD is my shepherd; I shall not want."
      },
      {
        "number": "2",
        "text": "He makes me lie down in green pastures; He leads me beside quiet waters."
      },
      {
        "number": "3",
        "text": "He restores my soul; He guides me in the paths of righteousness for the sake of His name."
      },
      {
        "number": "4",
        "text": "Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me."
      },
      {
        "number": "5",
        "text": "You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows."
      },
      {
        "number": "6",
        "text": "Surely goodness and mercy will follow me all the days of my life, and I will dwell in the house of the LORD forever."
      }
    ]
  }
];

/** Popular memory verses offered as suggestions (resolved against the chosen translation). */
export const POPULAR_REFERENCES: { de: string; en: string }[] = [
  { de: "Joh 3,16", en: "John 3:16" },
  { de: "Ps 23", en: "Psalm 23" },
  { de: "Röm 8,28", en: "Romans 8:28" },
  { de: "Phil 4,6-7", en: "Philippians 4:6-7" },
  { de: "Jes 41,10", en: "Isaiah 41:10" },
  { de: "Spr 3,5-6", en: "Proverbs 3:5-6" },
  { de: "Mt 6,33", en: "Matthew 6:33" },
  { de: "Jos 1,9", en: "Joshua 1:9" },
  { de: "2Tim 3,16-17", en: "2 Timothy 3:16-17" },
  { de: "1Kor 13,4-7", en: "1 Corinthians 13:4-7" },
  { de: "Mt 11,28-30", en: "Matthew 11:28-30" },
  { de: "Röm 12,1-2", en: "Romans 12:1-2" },
  { de: "Gal 2,20", en: "Galatians 2:20" },
  { de: "Eph 2,8-9", en: "Ephesians 2:8-9" },
  { de: "Klgl 3,22-23", en: "Lamentations 3:22-23" },
];
