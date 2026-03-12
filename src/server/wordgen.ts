// ═══════════════════════════════════════════════════════════════
// Word Generator — LLM-powered with fallback word bank
// ═══════════════════════════════════════════════════════════════

import { CONFIG } from "./config";

export interface GeneratedWord {
  word: string;
  hint: string;
}

// ─── Fallback Word Bank (grouped by length) ───
const WORD_BANK: Record<number, { word: string; hint: string }[]> = {
  4: [
    { word: "bark", hint: "Trees wear it, dogs make it" },
    { word: "melt", hint: "What ice aspires to become" },
    { word: "glow", hint: "A firefly's party trick" },
    { word: "knot", hint: "A sailor's handwriting" },
    { word: "dust", hint: "Yesterday's furniture decoration" },
    { word: "fuse", hint: "Where patience meets electricity" },
  ],
  5: [
    { word: "blaze", hint: "A campfire's ambition" },
    { word: "frost", hint: "Winter's graffiti artist" },
    { word: "ghost", hint: "An eviction-resistant tenant" },
    { word: "prism", hint: "Pink Floyd's favorite shape" },
    { word: "quirk", hint: "A personality spice" },
    { word: "swirl", hint: "What cream does in coffee" },
  ],
  6: [
    { word: "bridge", hint: "Gap's worst enemy" },
    { word: "freeze", hint: "Water's identity crisis" },
    { word: "jigsaw", hint: "A picture with commitment issues" },
    { word: "plunge", hint: "A pool's invitation" },
    { word: "throne", hint: "Royal furniture with job security" },
    { word: "breeze", hint: "Lazy wind on vacation" },
  ],
  7: [
    { word: "whisper", hint: "Sound wearing a disguise" },
    { word: "gravity", hint: "Earth's clingy personality" },
    { word: "miracle", hint: "Statistics having a bad day" },
    { word: "sparkle", hint: "Light doing jazz hands" },
    { word: "network", hint: "Computers' social life" },
    { word: "eclipse", hint: "Moon photobombing the sun" },
  ],
  8: [
    { word: "backbone", hint: "What jellyfish lack in meetings" },
    { word: "campfire", hint: "A marshmallow's tanning salon" },
    { word: "doorstep", hint: "Where packages have anxiety" },
    { word: "goldfish", hint: "A pet with zero memory complaints" },
    { word: "keyboard", hint: "A writer's piano" },
  ],
  9: [
    { word: "blueprint", hint: "A building's baby photo" },
    { word: "cardboard", hint: "A cat's favorite architecture" },
    { word: "dashboard", hint: "Where a car keeps its diary" },
    { word: "fireworks", hint: "Explosions with an art degree" },
    { word: "graveyard", hint: "The ultimate quiet neighborhood" },
    { word: "nightmare", hint: "Sleep's horror movie channel" },
  ],
  10: [
    { word: "basketball", hint: "Bouncing sphere's career path" },
    { word: "blacksmith", hint: "A metal's personal trainer" },
    { word: "earthquake", hint: "The planet stretching in bed" },
    { word: "flashlight", hint: "Portable sun, battery-powered" },
    { word: "goalkeeper", hint: "The net's last line of defense" },
    { word: "thumbtacks", hint: "Wall's painful jewelry" },
  ],
  11: [
    { word: "boomerangs", hint: "Throw-away gifts that refuse to leave" },
    { word: "caterpillar", hint: "Butterfly in a sleeping bag" },
    { word: "handwriting", hint: "Personality leaked through a pen" },
    { word: "parachuting", hint: "Gravity with a safety net" },
    { word: "countryside", hint: "City's quieter sibling" },
  ],
  12: [
    { word: "butterscotch", hint: "Caramel's Scottish cousin" },
    { word: "fingerprints", hint: "Hands leaving their autograph" },
    { word: "neighborhood", hint: "A collection of proximity-based friendships" },
    { word: "thunderstorm", hint: "Sky's drum solo with light show" },
  ],
  13: [
    { word: "extraordinary", hint: "Ordinary wearing a cape" },
    { word: "communication", hint: "The art of talking past each other" },
    { word: "understanding", hint: "Standing under knowledge, apparently" },
    { word: "uncomfortable", hint: "A chair's betrayal" },
  ],
  14: [
    { word: "transformation", hint: "A caterpillar's business plan" },
    { word: "infrastructure", hint: "The boring stuff everything depends on" },
    { word: "accomplishment", hint: "A to-do list's graduation ceremony" },
  ],
  15: [
    { word: "troubleshooting", hint: "Shooting trouble, not literally" },
    { word: "experimentation", hint: "Science's fancy word for 'let's see'" },
    { word: "procrastination", hint: "Tomorrow's favorite activity planned today" },
  ],
  16: [
    { word: "fingerprinting", hint: "Making hands tell the truth" },
    { word: "groundbreakingly", hint: "When earth-shattering isn't enough" },
  ],
  17: [
    { word: "misunderstanding", hint: "Communication's plot twist" },
    { word: "over-engineering", hint: "Using a rocket to deliver pizza" },
  ],
  18: [
    { word: "characteristically", hint: "In a way that screams 'typical'" },
    { word: "disproportionately", hint: "When the ratio went to lunch" },
  ],
  19: [
    { word: "straightforwardness", hint: "No detours in this personality" },
    { word: "compartmentalizing", hint: "Brain's filing cabinet strategy" },
  ],
  20: [
    { word: "uncharacteristically", hint: "Doing something completely off-brand" },
    { word: "internationalization", hint: "Making things work everywhere, somehow" },
  ],
};

function closestLength(target: number): number {
  const available = Object.keys(WORD_BANK).map(Number).sort((a, b) => a - b);
  let best = available[0];
  for (const len of available) {
    if (Math.abs(len - target) < Math.abs(best - target)) best = len;
    if (len >= target) break;
  }
  return best;
}

async function generateFromLLM(minLen: number, maxLen: number): Promise<GeneratedWord | null> {
  if (!CONFIG.LLM_ENDPOINT) return null;

  const prompt = `Generate a single English word between ${minLen} and ${maxLen} characters long. 
The word can contain hyphens (-) but should be a real, recognizable English word.
Also provide a clever, non-obvious hint — something witty or indirect that doesn't contain the word itself.

Respond in EXACTLY this JSON format, nothing else:
{"word": "yourword", "hint": "your clever hint"}`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (CONFIG.LLM_API_KEY) {
      headers["Authorization"] = `Bearer ${CONFIG.LLM_API_KEY}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.LLM_TIMEOUT_MS);

    const res = await fetch(CONFIG.LLM_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        minLength: minLen,
        maxLength: maxLen,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[LLM] HTTP ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json() as Record<string, unknown>;

    let word: string | undefined;
    let hint: string | undefined;

    if (typeof data.word === "string" && typeof data.hint === "string") {
      word = data.word;
      hint = data.hint;
    } else if (
      Array.isArray((data.choices as unknown[] | undefined)?.[0]) === false &&
      typeof (data.choices as Record<string, unknown>[] | undefined)?.[0]?.message === "object"
    ) {
      const content = (
        (data.choices as { message: { content: string } }[])[0].message.content
      );
      const parsed = JSON.parse(content) as { word: string; hint: string };
      word = parsed.word;
      hint = parsed.hint;
    } else if (
      typeof (data.content as { text: string }[] | undefined)?.[0]?.text === "string"
    ) {
      const parsed = JSON.parse(
        (data.content as { text: string }[])[0].text
      ) as { word: string; hint: string };
      word = parsed.word;
      hint = parsed.hint;
    }

    if (word && hint && word.length >= minLen && word.length <= maxLen) {
      return { word: word.toLowerCase(), hint };
    }

    console.warn("[LLM] Response didn't match expected format:", data);
    return null;
  } catch (err) {
    console.warn("[LLM] Generation failed, using fallback:", err);
    return null;
  }
}

function generateFromBank(minLen: number, maxLen: number): GeneratedWord {
  for (let len = minLen; len <= maxLen; len++) {
    const entries = WORD_BANK[len];
    if (entries && entries.length > 0) {
      const entry = entries[Math.floor(Math.random() * entries.length)];
      return { word: entry.word.toLowerCase(), hint: entry.hint };
    }
  }
  const len = closestLength(minLen);
  const entries = WORD_BANK[len]!;
  const entry = entries[Math.floor(Math.random() * entries.length)];
  return { word: entry.word.toLowerCase(), hint: entry.hint };
}

export async function generateWord(targetLength: number): Promise<GeneratedWord> {
  const minLen = Math.max(CONFIG.MIN_WORD_LENGTH, targetLength - 1);
  const maxLen = targetLength + 1;

  const llmResult = await generateFromLLM(minLen, maxLen);
  if (llmResult) {
    console.log(`[WordGen] LLM generated: "${llmResult.word}" (${llmResult.word.length} chars)`);
    return llmResult;
  }

  const bankResult = generateFromBank(minLen, maxLen);
  console.log(`[WordGen] Bank fallback: "${bankResult.word}" (${bankResult.word.length} chars)`);
  return bankResult;
}
