# Contributing

Thank you for helping! Three ways to contribute: fix the content, add a language, improve the code.

By contributing, you agree that your contribution is published under the project's licenses: MIT for code, CC BY-SA 4.0 for content.

## Fix a question

Questions live in `content/`, in French: one file per theme (`pv`, `sip`, `dd`, `hgc`, `vsf`) and `situ.json` for the scenarios. Their translations live in the language packs (see below).

```json
{"id":"pv01","s":"symboles",
 "q":"À quoi correspond la date du 14 juillet ?",
 "o":["À la fête nationale française","À la fin de la Seconde Guerre mondiale","À la naissance de Napoléon","Au jour de l'An"],
 "oc":["À l'anniversaire de la prise de la Bastille (1789)"],
 "od":["À la fête du Travail"],
 "x":"Le 14 juillet est la fête nationale…",
 "v":["la fête nationale","la prise de la Bastille"]}
```

| Field | Content |
|---|---|
| `id` | identifier, never change it (saved progress is attached to it) |
| `s` | sub-theme (see `web/src/data/themes.js`); `t` (theme) as well in `situ.json` |
| `q` | the question |
| `o` | the 4 original choices: **the first one is the right answer** (they are shuffled on screen) |
| `oc` | optional: other correct wordings of the right answer |
| `od` | optional: other wrong answers |
| `x` | the explanation |
| `v` | useful vocabulary |

Rules:
- Do not reorder or remove the 4 choices in `o`: add to `oc` or `od` instead, at the end.
- Every answer must be checkable on an official source (service-public.fr, formation-civique.interieur.gouv.fr, legifrance.gouv.fr). Give the source in the pull request.
- `cd web && npm run build` checks the files: 4 choices, no duplicates, no empty text.
- After changing or adding French text, update the translations: run `node scripts/lang-template.mjs <code>` for each language (`tr`, `en`…). Texts whose French changed are emptied in the pack, ready to be translated again; until then they are shown in French.
- New words in a question or a choice: run `node scripts/word-list.mjs <code>` for each language. It updates the word by word glossary (`web/src/lang/words/<code>.json`, shown when a word is tapped in bilingual mode); fill in the empty translations. A word without a translation is still read aloud.

## Add a help language

The app's texts are written in French and shown as `[French, help language]` pairs. Each help language is a **pack**, a JSON file in `web/src/lang/packs/` (`tr.json`, `en.json`…), that fills the second slot. Only the profile's language is loaded.

1. Create the pack (example for Arabic):
   ```sh
   cd web && npm install && cd ..
   node scripts/lang-template.mjs ar "العربية" arabe ar
   ```
   (code, name in the language, name in French, locale.) This creates `web/src/lang/packs/ar.json`, where each text looks like:
   ```json
   "q.pv01.q": { "fr": "À quoi correspond la date du 14 juillet ?", "ar": "" }
   ```
2. Fill in your language's slot (`"ar"`). Empty texts are shown in French. Do not change the keys or the `fr` slot. You can look at `tr.json` or `en.json` for an example. About 3,600 texts: the interface first (`ui.*`), then the questions.
3. Add the line printed by the script to `ALL` in `web/src/lang/langs.js`. For a right-to-left language, set `dir: 'rtl'`: the interface is then mirrored when shown in that language.
4. Optional, in `web/src/lib/tts.js`:
   - **Voice**: add a Piper voice to `PIPER_VOICES` (pick one in [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) and check the license in its `MODEL_CARD`).
   - **Mixed text**: Coco's answers mix French and the help language. Languages written in another script (Arabic, Cyrillic…) are recognised automatically. For a language in Latin script, add letters, common words and endings to `MARKERS`, like Turkish.
5. Check with `cd web && npm run dev`: create a profile and pick the language.

When questions are added or changed, run the script again: translations already done are kept, and those whose French text changed are emptied to be redone.

Machine translation can be a starting point, but **it must be reviewed by a person who speaks the language**, especially the explanations.

Coco's instructions are written in French for the AI model and name the help language (`nameFr`); they do not need translating.

## Improve the code

```sh
cd web
npm install
npm run build
npm run dev
```

- Interface: React 18 + Vite. Comments and commit messages in English.
- Progress is stored by `web/src/lib/store.js`: in the browser (web version) or in a file through the Windows launcher. Do not break existing saves: add a conversion in `toRoot` / `migrate` if the format changes.
- Test the built web version (`npx vite build`) and, if you change the launcher or the installer, the Windows package (`node scripts/build.mjs`, on Windows).
