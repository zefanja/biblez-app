// Bundled sample passages (public domain). The full free translations
// (product brief 5.1) will be imported by tools/bibles in a later step.

import type { Verse } from "./text/parse";

export interface SamplePassage {
  id: string;
  title: string;
  translation: string;
  language: "de" | "en";
  verses: Verse[];
}

export const SAMPLES: SamplePassage[] = [
  {
    id: "joh-3-16-lut1912",
    title: "Johannes 3,16",
    translation: "Luther 1912",
    language: "de",
    verses: [
      { number: "16", text: "Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab, auf daß alle, die an ihn glauben, nicht verloren werden, sondern das ewige Leben haben." },
    ],
  },
  {
    id: "ps-23-lut1912",
    title: "Psalm 23",
    translation: "Luther 1912",
    language: "de",
    verses: [
      { number: "1", text: "Ein Psalm Davids. Der HERR ist mein Hirte; mir wird nichts mangeln." },
      { number: "2", text: "Er weidet mich auf einer grünen Aue und führet mich zum frischen Wasser." },
      { number: "3", text: "Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen." },
      { number: "4", text: "Und ob ich schon wanderte im finstern Tal, fürchte ich kein Unglück; denn du bist bei mir, dein Stecken und Stab trösten mich." },
      { number: "5", text: "Du bereitest vor mir einen Tisch im Angesicht meiner Feinde. Du salbest mein Haupt mit Öl und schenkest mir voll ein." },
      { number: "6", text: "Gutes und Barmherzigkeit werden mir folgen mein Leben lang, und ich werde bleiben im Hause des HERRN immerdar." },
    ],
  },
  {
    id: "rom-8-28-lut1912",
    title: "Römer 8,28",
    translation: "Luther 1912",
    language: "de",
    verses: [
      { number: "28", text: "Wir wissen aber, daß denen, die Gott lieben, alle Dinge zum Besten dienen, denen, die nach dem Vorsatz berufen sind." },
    ],
  },
  {
    id: "john-3-16-web",
    title: "John 3:16",
    translation: "World English Bible",
    language: "en",
    verses: [
      { number: "16", text: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life." },
    ],
  },
  {
    id: "ps-23-web",
    title: "Psalm 23",
    translation: "World English Bible",
    language: "en",
    verses: [
      { number: "1", text: "Yahweh is my shepherd; I shall lack nothing." },
      { number: "2", text: "He makes me lie down in green pastures. He leads me beside still waters." },
      { number: "3", text: "He restores my soul. He guides me in the paths of righteousness for his name’s sake." },
      { number: "4", text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me." },
      { number: "5", text: "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over." },
      { number: "6", text: "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh’s house forever." },
    ],
  },
];
