import BadWordsNext from "bad-words-next";
import englishDictionary from "bad-words-next/lib/en";

const tagalogWords = [
  "anak_ng_puta",
  "anak_ng_tupa",
  "bobo",
  "burat",
  "buang",
  "bwisit",
  "demonyo",
  "gaga",
  "gago",
  "hinayupak",
  "hudas",
  "inis_ka",
  "kantot",
  "kupal",
  "leche",
  "lecheng",
  "lintik",
  "malandi",
  "malaswa",
  "pakyu",
  "peste",
  "pesteng_yawa",
  "pucha",
  "puke",
  "punyeta",
  "puta",
  "putang_ina",
  "putang_inaka",
  "putang_inamo",
  "putangina",
  "shunga",
  "sira_ulo",
  "tanga",
  "tang_ina_mo",
  "tangina",
  "tarantada",
  "tarantado",
  "tite",
  "ulol",
  "walang_hiya",
  "yawa",
];

const tagalogDictionary = {
  id: "tl",
  words: tagalogWords,
  lookalike: {},
};

const profanityFilter = new BadWordsNext({
  data: englishDictionary,
  spaceChars: ["", " ", ".", "-", ";", "|"],
});
profanityFilter.add(tagalogDictionary);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tagalogPattern = new RegExp(
  `\\b(?:${tagalogWords
    .sort((firstWord, secondWord) => secondWord.length - firstWord.length)
    .map((word) => escapeRegex(word).replace(/_/g, "[\\s._-]*"))
    .join("|")})\\b`,
  "gi",
);

export function hideBadWords(text) {
  if (typeof text !== "string" || !text) return text || "";
  return profanityFilter.filter(text.replace(tagalogPattern, "***"));
}
