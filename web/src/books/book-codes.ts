export const ENG_BOOK_ENTRIES = [
  ["BG", "Bhagavad Gita As It Is"],
  ["BS", "Sri Brahma-Samhita"],
  ["CC", "Sri Caitanya Caritamrita"],
  ["DOC", "Foundational Documents"],
  ["ISO", "Sri Isopanishad"],
  ["KB", "KRISHNA Book"],
  ["LBG", "Lectures on Bhagavad Gita"],
  ["LCC", "Lectures on Caitanya Caritamrita"],
  ["LD", "Legal Documents"],
  ["LISO", "Lectures on Isopanishad"],
  ["LSB", "Lectures on Bhagavatam"],
  ["LTR", "SP Letters by topic"],
  ["LTRS", "Srila Prabhupada Letters"],
  ["MM", "Mukunda-mala-stotra"],
  ["NBS", "Narada Bhakti Sutra"],
  ["NoD", "Nectar of Devotion"],
  ["NoI", "Nectar of Instruction"],
  ["SB", "Srimad Bhagavatam"],
  ["TLC", "Teachings of Lord Caitanya"],
  ["TLKS", "Conversations"],
  ["TQK", "Teachings of Queen Kunti"],
] as const;

export const RUS_BOOK_ENTRIES = [
  ["БВ", "Беседы и выступления"],
  ["БГ", "Бхагавад Гита Как Она Есть"],
  ["БС", "Брахма Самхита"],
  ["ДОК", "Уставные документы"],
  ["ИВН", "Книга о Кришне"],
  ["ИП", "Шри Ишопанишад"],
  ["ЛекБГ", "Лекции по Бхагавад Гите"],
  ["ЛекШБ", "Лекции по Шримад Бхагаватам"],
  ["МЦК", "Молитвы царицы Кунти"],
  ["НН", "Нектар Наставлений"],
  ["НП", "Нектар Преданности"],
  ["ПШП", "Письма Шрилы Прабхупады"],
  ["УГЧ", "Учение Господа Чайтаньи"],
  ["ЧЧ", "Чайтанья Чаритамрита"],
  ["ШБ", "Шримад Бхагаватам"],
] as const;

export const ENG_BOOK_CODES = ENG_BOOK_ENTRIES.map(([code]) => code);
export const RUS_BOOK_CODES = RUS_BOOK_ENTRIES.map(([code]) => code);

const engCodes = ENG_BOOK_CODES.join(", ");
const rusCodes = RUS_BOOK_CODES.join(", ");
const engCodeNames = ENG_BOOK_ENTRIES.map(([code, name]) => `${code}=${name}`).join("; ");
const rusCodeNames = RUS_BOOK_ENTRIES.map(([code, name]) => `${code}=${name}`).join("; ");
const engMainBooks = ["BG", "SB", "CC", "KB", "BS", "ISO", "NoD", "NoI", "TLC", "TQK"] as const;
const engLettersBooks = ["LTRS"] as const;
const engLecturesBooks = ["LSB", "LBG", "LCC", "LISO", "TLKS"] as const;
const rusMainBooks = ["БГ", "ШБ", "ЧЧ", "ИВН", "БС", "ИП", "НП", "НН", "УГЧ", "МЦК"] as const;
const rusLettersBooks = ["ПШП"] as const;
const rusLecturesBooks = ["ЛекБГ", "ЛекШБ", "БВ"] as const;
const engMainBooksJson = JSON.stringify(engMainBooks);
const engLettersBooksJson = JSON.stringify(engLettersBooks);
const engLecturesBooksJson = JSON.stringify(engLecturesBooks);
const engAllBooksJson = JSON.stringify(ENG_BOOK_CODES);
const rusMainBooksJson = JSON.stringify(rusMainBooks);
const rusLettersBooksJson = JSON.stringify(rusLettersBooks);
const rusLecturesBooksJson = JSON.stringify(rusLecturesBooks);
const rusAllBooksJson = JSON.stringify(RUS_BOOK_CODES);
const engSongOneBooks = [
  "BG",
  "BS",
  "ISO",
  "KB",
  "LBG",
  "LD",
  "LISO",
  "MM",
  "NBS",
  "NoD",
  "NoI",
  "TLC",
  "TQK",
] as const;
const rusSongOneBooks = ["БГ", "БС", "ИВН", "ИП", "ЛекБГ", "МЦК"] as const;
const engVariableSongBooks = ["SB", "CC", "DOC", "LCC", "LSB", "LTRS", "TLKS"] as const;
const rusVariableSongBooks = ["ШБ", "ЧЧ", "ДОК", "ЛекШБ", "ПШП", "БВ", "НН", "НП", "УГЧ"] as const;

export const VERSE_ID_FORMAT_DESCRIPTION = [
  "Verse ID format is BOOK-SONG-CHAPTER-VERSE (4 parts, SONG is required).",
  'Examples: "SB-1-1-1", "BG-1-2-47", "ШБ-1-1-1", "БГ-1-2-47".',
  `Single-song books still include SONG=1 (eng: ${JSON.stringify(engSongOneBooks)}; rus: ${JSON.stringify(rusSongOneBooks)}).`,
  `Variable-song books require an explicit SONG value (eng: ${JSON.stringify(engVariableSongBooks)}; rus: ${JSON.stringify(rusVariableSongBooks)}).`,
  'VERSE token may be non-numeric (examples: "16-18", "0.1", "16CA2").',
].join(" ");

export const BOOKS_FILTER_DESCRIPTION = [
  "Book filter.",
  `Use English codes for lang=eng (${engCodes}) and Russian codes for lang=rus (${rusCodes}).`,
  "No separate scope field: emulate scopes via books[] (main/letters/lectures/all/custom).",
  `Suggested eng main set: ${engMainBooksJson}; letters: ${engLettersBooksJson}; lectures: ${engLecturesBooksJson}.`,
  `Suggested rus main set: ${rusMainBooksJson}; letters: ${rusLettersBooksJson}; lectures: ${rusLecturesBooksJson}.`,
  `English names: ${engCodeNames}.`,
  `Russian names: ${rusCodeNames}.`,
].join(" ");

export const BOOKS_TOOL_DESCRIPTION =
  "Search and read Srila Prabhupada books.\n" +
  "Single request surface:\n" +
  "- If q is provided: BM25 search mode (can be combined with books/song/chapter filters)\n" +
  "- If q is absent and verses is provided: exact read mode (returns those verses)\n" +
  "- If q is absent and verses is absent: filter/browse mode\n" +
  `Book codes (eng): ${engCodes}\n` +
  `Book names (eng): ${engCodeNames}\n` +
  `Book codes (rus): ${rusCodes}\n` +
  `Book names (rus): ${rusCodeNames}\n` +
  "Fields:\n" +
  "- q: search query\n" +
  "- q supports OR-style variants with || (example: \"family life || grihastha\")\n" +
  "- books: array of book codes (OR)\n" +
  "- song, chapter: hierarchy filters\n" +
  `- verses: exact verse ids. ${VERSE_ID_FORMAT_DESCRIPTION}\n` +
  "- text: text payload mode, one of full | snippet | none (default: snippet)\n" +
  "Scope strategy (by books[] only, no scope param):\n" +
  `- main (eng): ${engMainBooksJson}; main (rus): ${rusMainBooksJson}\n` +
  `- letters only (eng): ${engLettersBooksJson}; letters only (rus): ${rusLettersBooksJson}\n` +
  `- lectures/conversations (eng): ${engLecturesBooksJson}; lectures/conversations (rus): ${rusLecturesBooksJson}\n` +
  "- all corpus: pass all book codes for that language\n" +
  "- custom corpus: pass any subset in books[]\n" +
  "Rules:\n" +
  "- Search uses adaptive exploration + fusion across q variants (if q has ||)\n" +
  "- q + books/song/chapter = search within filtered corpus\n" +
  "- q + verses = search only within those exact verse ids\n" +
  "- If q is absent and verses is present, exact read mode is used\n" +
  "- text=none: return metadata only (no text fields)\n" +
  "- text=full: return translation + full purport + synonyms + translit + sanskrit when available\n" +
  "- text=snippet: in search mode return translation + purportSnippet (multi-fragment with '(N chars skipped)' markers); in read/filter returns full translation + purport\n" +
  "- Sanskrit-aware search: BM25 includes transliteration search surface (ts/tr) so queries like narayana / narayaṇa work\n" +
  "- text=snippet also returns purportFullChars, purportSnippetChars, purportSkippedChars, purportCoverage for agent decisions\n" +
  "- Use verses read mode to fetch full purport when needed\n" +
  "Examples:\n" +
  `- Main books search: {"lang":"eng","q":"family life","books":${engMainBooksJson},"text":"snippet","limit":5}\n` +
  `- Letters only: {"lang":"eng","q":"Krishna","books":${engLettersBooksJson},"text":"snippet","limit":5}\n` +
  `- Lectures only: {"lang":"eng","q":"Krishna","books":${engLecturesBooksJson},"text":"snippet","limit":5}\n` +
  `- All books (eng): {"lang":"eng","q":"Krishna","books":${engAllBooksJson},"limit":5}\n` +
  `- All books (rus): {"lang":"rus","q":"Кришна","books":${rusAllBooksJson},"limit":5}\n` +
  "- Custom subset (eng): {\"lang\":\"eng\",\"q\":\"family life\",\"books\":[\"BG\",\"SB\"],\"limit\":5}\n" +
  "- {\"lang\":\"eng\",\"q\":\"Krishna\",\"books\":[\"SB\"],\"song\":\"1\",\"chapter\":\"2\"}\n" +
  "- {\"lang\":\"eng\",\"verses\":[\"SB-1-1-1\",\"BG-1-2-47\"]}";
