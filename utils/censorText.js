const PROFANITY = [
  // English
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cock",
  "cunt",
  "dick",
  "dumbass",
  "faggot",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "motherfucker",
  "nigga",
  "nigger",
  "piss",
  "pussy",
  "shit",
  "shitty",
  "slut",
  "whore",
  // Tagalog / Filipino
  "bobo",
  "burat",
  "gaga",
  "gago",
  "kantot",
  "kupal",
  "leche",
  "lecheng",
  "pakyu",
  "pesteng yawa",
  "pucha",
  "puke",
  "punyeta",
  "puta",
  "putang ina",
  "putangina",
  "shunga",
  "tanga",
  "tangina",
  "tarantada",
  "tarantado",
  "tite",
  "ulol",
  "yawa",
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PROFANITY_PATTERN = new RegExp(
  `\\b(?:${PROFANITY.map((word) => escapeRegex(word).replace(/\\ /g, "[\\s-]+")).join("|")})\\b`,
  "gi",
);

const maskWord = (word) => {
  if (word.length <= 2) return "*".repeat(word.length);
  return `${word[0]}${"*".repeat(word.length - 2)}${word[word.length - 1]}`;
};

export function censorText(text) {
  if (!text || typeof text !== "string") return text || "";
  return text.replace(PROFANITY_PATTERN, maskWord);
}
