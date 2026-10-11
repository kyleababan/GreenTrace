import BadWordsNext from "bad-words-next";
import englishDictionary from "bad-words-next/lib/en";

const TAGALOG_WORDS = [
  "ampota",
  "amputa",
  "anak ng puta",
  "anak ng tupa",
  "bayag",
  "bobo",
  "bobohan",
  "bobo ka",
  "burat",
  "buang",
  "buwisit",
  "bwisit",
  "bwesit",
  "chupa",
  "chupain",
  "demonyo",
  "ebak",
  "engot",
  "fakk",
  "gaga",
  "gago",
  "gago ka",
  "gaguhan",
  "hayop ka",
  "hayop",
  "higad",
  "hinayupak",
  "hindot",
  "hindot ka",
  "hindutan",
  "hudas",
  "inutil",
  "inutil ka",
  "inis ka",
  "jakol",
  "kantot",
  "kantutan",
  "kantutin",
  "kiki",
  "kupal",
  "kupal ka",
  "leche",
  "leche ka",
  "lecheng",
  "letse",
  "lintik",
  "malandi",
  "malaswa",
  "ogag",
  "pakshet",
  "pakingshet",
  "pakyu",
  "pakyu ka",
  "pekpek",
  "peste",
  "peste ka",
  "pesteng yawa",
  "pokpok",
  "pota",
  "potangina",
  "potaena",
  "pucha",
  "puchangina",
  "puke",
  "pukingina",
  "punyeta",
  "punyeta ka",
  "puta",
  "putaena",
  "putang ina",
  "putang ina mo",
  "putang inaka",
  "putang inamo",
  "putangina",
  "putangina mo",
  "putanginamo",
  "salot",
  "shunga",
  "sira ulo",
  "siraulo",
  "tae",
  "tamod",
  "tanga",
  "tanga ka",
  "tangahan",
  "tangina",
  "tang ina",
  "tang ina mo",
  "tangina mo",
  "tanginamo",
  "tangena",
  "tarantada",
  "tarantado",
  "tarantado ka",
  "tite",
  "titi",
  "tsupa",
  "ulol",
  "ulol ka",
  "olol",
  "ungas",
  "ungas ka",
  "walang hiya",
  "walang hiya ka",
  "walanghiya",
];

const BISAYA_WORDS = [
  "amaw",
  "amawa",
  "amaw ka",
  "animal ka",
  "atay",
  "ataya",
  "atay ka",
  "atay man ka",
  "biga",
  "bigaon",
  "bilat",
  "bilata",
  "bilata ka",
  "bilatibay",
  "bilat sa imong inahan",
  "bilat sa imong nanay",
  "boang",
  "bogo",
  "bogoa",
  "bogo ka",
  "bugo",
  "buang",
  "buanga",
  "buang ka",
  "burikat",
  "burikata",
  "burikat ka",
  "bwang",
  "damak",
  "damak ka",
  "giatay",
  "giatay ka",
  "hangol",
  "hubag bilat",
  "igot",
  "iyot",
  "iyotan",
  "kagwang",
  "kagwang ka",
  "kayat",
  "kayata",
  "kayata ka",
  "kayaton",
  "kigol",
  "kolera",
  "kolera ka",
  "kulira",
  "langag",
  "libog",
  "liki",
  "lubot",
  "lubotan",
  "mangayat",
  "mangiyot",
  "nag-iyot",
  "otin",
  "otina",
  "otn",
  "panulay",
  "panuway",
  "piste",
  "piste ka",
  "pisteha",
  "pisti",
  "pisti ka",
  "pisting dako",
  "pisting yawa",
  "pisting yawa ka",
  "pisot",
  "samok",
  "samoka",
  "samok ka",
  "tunto",
  "ukoy",
  "uwag",
  "uwagan",
  "yabag",
  "yataps",
  "yawa",
  "yawaa",
  "yawa ka",
  "yawa man ka",
  "yawaon",
  "yawas",
  "ywa",
];

const ENGLISH_WORDS = [
  "arse",
  "arsehole",
  "ass",
  "asshole",
  "assholes",
  "badass",
  "bastard",
  "bastards",
  "bch",
  "bitch",
  "bitches",
  "bitching",
  "bitchy",
  "blowjob",
  "bollocks",
  "boobs",
  "bullshit",
  "clit",
  "clitoris",
  "cock",
  "cocks",
  "cocksucker",
  "crap",
  "crappy",
  "cum",
  "cumming",
  "cumshot",
  "cunt",
  "cunts",
  "damn",
  "dammit",
  "dick",
  "dickhead",
  "dicks",
  "dildo",
  "dipshit",
  "douche",
  "douchebag",
  "dumbass",
  "dumbfuck",
  "eat shit",
  "fag",
  "faggot",
  "faggots",
  "fags",
  "fatass",
  "fck",
  "fcker",
  "fckn",
  "fuck",
  "fucked",
  "fucked up",
  "fucker",
  "fuckers",
  "fucking",
  "fuck off",
  "fuck up",
  "fuck you",
  "fucks",
  "goddamn",
  "gtfo",
  "handjob",
  "horseshit",
  "jackass",
  "lmfao",
  "mf",
  "mfer",
  "motherfucker",
  "motherfucking",
  "nigga",
  "niggas",
  "nigger",
  "niggers",
  "penis",
  "piece of shit",
  "piss",
  "piss off",
  "pissed",
  "pissing",
  "porn",
  "porno",
  "prick",
  "pricks",
  "pussy",
  "pussies",
  "retard",
  "retarded",
  "screw you",
  "shit",
  "shits",
  "shitted",
  "shitting",
  "shitty",
  "shyt",
  "shut up",
  "slut",
  "sluts",
  "sob",
  "son of a bitch",
  "stfu",
  "tits",
  "titties",
  "twat",
  "vagina",
  "wanker",
  "wankers",
  "whore",
  "whores",
  "wtf",
];

// Masked wildcards (e.g. f*ck, f**k, sh*t, s**t, b*tch, b**ch)
const MASKED_WILDCARDS = [
  "f[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*k[a-z]*",
  "sh[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*t[a-z]*",
  "s[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*t[a-z]*",
  "b[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*t*ch[a-z]*",
  "c[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*nt[a-z]*",
  "d[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*ck[a-z]*",
  "p[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*ta[a-z]*",
  "t[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*ngina[a-z]*",
  "y[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*wa[a-z]*",
  "g[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*go[a-z]*",
  "b[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*bo[a-z]*",
  "b[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*lat[a-z]*",
  "k[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*yat[a-z]*",
  "p[\\*#@$!._-]*[\\*]+[\\*#@$!._-]*sti[a-z]*",
];

const ALL_WORDS = Array.from(
  new Set([...TAGALOG_WORDS, ...BISAYA_WORDS, ...ENGLISH_WORDS]),
).sort((a, b) => b.length - a.length);

const LEET = {
  a: "[a@4α^\\*]",
  b: "[b8ß]",
  c: "[c(<{]",
  d: "[d]",
  e: "[e3€\\*]",
  f: "[f]",
  g: "[g96]",
  h: "[h]",
  i: "[i1!|l\\*]",
  j: "[j]",
  k: "[k]",
  l: "[l1!|]",
  m: "[m]",
  n: "[n]",
  o: "[o0*\\*]",
  p: "[p]",
  q: "[q]",
  r: "[r]",
  s: "[s$5§]",
  t: "[t7+]",
  u: "[uv*\\*]",
  v: "[v]",
  w: "[w]",
  x: "[x]",
  y: "[y]",
  z: "[z2]",
};

function createWordPattern(word) {
  const tokens = word.toLowerCase().split(/[\s_-]+/);
  const tokenPatterns = tokens.map((token) => {
    const chars = token.split("").map((ch) => {
      const leet = LEET[ch] || (ch === "*" ? "\\*" : ch);
      return `${leet}+`;
    });
    return chars.join("[._*~\\-]*");
  });
  return tokenPatterns.join("[\\s._*~\\-]+");
}

const patternList = [
  ...ALL_WORDS.map(createWordPattern),
  ...MASKED_WILDCARDS,
];

const comprehensiveRegex = new RegExp(
  `(?<![a-zA-Z0-9])(?:${patternList.join("|")})(?![a-zA-Z0-9])`,
  "gi",
);

// Register with bad-words-next
const customDictionary = {
  id: "ph",
  words: ALL_WORDS.map((w) => w.replace(/\s+/g, "_")),
  lookalike: {
    "@": "a",
    "4": "a",
    "8": "b",
    "3": "e",
    "1": "i",
    "!": "i",
    "|": "i",
    "0": "o",
    $: "s",
    "5": "s",
    "7": "t",
    "+": "t",
  },
};

const profanityFilter = new BadWordsNext({
  data: englishDictionary,
  spaceChars: [" ", ".", "-", ";", "|", "_", "~"],
  placeholder: "***",
});
profanityFilter.add(customDictionary);

// Safe whitelist (preserves legitimate Cebuano terms & words containing substrings)
const SAFE_WORDS = [
  { regex: /\bhabal-habal\b/gi, placeholder: "__SAFE_HABAL_HABAL__" },
  { regex: /\bhabal habal\b/gi, placeholder: "__SAFE_HABAL_HABAL_SP__" },
];

const MASK_TOKEN = "\uFFF0";

export function hideBadWords(text) {
  if (typeof text !== "string" || !text) return text || "";

  let processed = text;

  // 1. Protect whitelisted phrases
  SAFE_WORDS.forEach(({ regex, placeholder }) => {
    processed = processed.replace(regex, placeholder);
  });

  // 2. Compact spaced-out individual letters (e.g. "f u c k", "y a w a", "b o b o")
  processed = processed.replace(
    /\b([a-zA-Z0-9@$!*])(?:\s+([a-zA-Z0-9@$!*])){2,}\b/gi,
    (match) => {
      const compacted = match.replace(/\s+/g, "");
      const isBad = comprehensiveRegex.test(compacted);
      comprehensiveRegex.lastIndex = 0;
      return isBad ? MASK_TOKEN : match;
    },
  );

  // 3. Comprehensive Regex pass (English, Tagalog, Bisaya, Leetspeak, Symbols, Wildcards, Delimiters, Repeats)
  processed = processed.replace(comprehensiveRegex, MASK_TOKEN);

  // 4. BadWordsNext pass
  processed = profanityFilter.filter(processed);

  // 5. Convert internal mask tokens to ***
  processed = processed.split(MASK_TOKEN).join("***");

  // 6. Restore whitelisted phrases
  SAFE_WORDS.forEach(({ placeholder }) => {
    if (placeholder === "__SAFE_HABAL_HABAL__") {
      processed = processed.split(placeholder).join("habal-habal");
    } else if (placeholder === "__SAFE_HABAL_HABAL_SP__") {
      processed = processed.split(placeholder).join("habal habal");
    }
  });

  return processed;
}
