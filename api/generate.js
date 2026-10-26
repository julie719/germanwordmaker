import { saveWord } from './_lib/store.js';

const MAX_CONCEPT_LENGTH = 200;
const ARTICLES = ['der', 'die', 'das'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const concept = typeof req.body?.concept === 'string' ? req.body.concept.trim() : '';
  if (!concept) return res.status(400).json({ error: 'Describe a concept first.' });
  if (concept.length > MAX_CONCEPT_LENGTH) {
    return res.status(400).json({ error: `Keep it under ${MAX_CONCEPT_LENGTH} characters.` });
  }

  const anthropicUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const elevenLabsUrl = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';

  let raw = '';
  try {
    const response = await fetch(`${anthropicUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `You are a creative German linguist who invents plausible-sounding new German compound words. Given a concept, create a single new German word that could realistically exist in German.
If the concept is offensive, sexual, hateful, violent, or inappropriate in any way, do NOT refuse with a plain error. Instead, invent a German word that wittily describes the act of typing something offensive into a word generator — something like the feeling of revealing poor judgment, the specific shame of trying to make an AI say something crude, or the peculiar emptiness of that choice. Make it pointed but clever, not mean.
Respond ONLY with a JSON object. No markdown, no backticks, no explanation. Exactly this structure:
{
  "word": "TheNewGermanWord",
  "article": "der, die or das: the word's grammatical gender, which a German compound takes from its last part",
  "pronunciation": "approximate phonetic pronunciation for English speakers",
  "parts": [
    {"german": "Teil1", "meaning": "English meaning"},
    {"german": "Teil2", "meaning": "English meaning"}
  ],
  "definition": "A one or two sentence definition, as if from a dictionary.",
  "example": "An example sentence in German, followed by its English translation in parentheses.",
  "isRefusal": true or false
}
Set isRefusal to true only when the concept was inappropriate.`,
        messages: [{ role: 'user', content: `Invent a new German compound word for this concept: ${concept}` }]
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${data.error?.message || 'unknown error'}`);
    raw = data.content?.find(b => b.type === 'text')?.text || '';
  } catch (e) {
    console.error('Generate error:', e.message);
    return res.status(502).json({ error: 'The word generator is unavailable right now. Try again in a moment.' });
  }

  let word;
  try {
    word = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (typeof word.word !== 'string' || !Array.isArray(word.parts)) throw new Error('missing fields');
    // A word is letters, optionally joined by hyphens (E-Mail-Frust); anything else is a garbled reply.
    if (!/^\p{L}+(-\p{L}+)*$/u.test(word.word.trim())) throw new Error('not a word');
  } catch (e) {
    console.error('Unparseable word:', raw);
    return res.status(502).json({ error: 'That one came out garbled. Try again.' });
  }

  word.word = word.word.trim();
  word.article = ARTICLES.includes(String(word.article).toLowerCase()) ? String(word.article).toLowerCase() : undefined;
  word.isRefusal = word.isRefusal === true;
  word.concept = concept;
  word.createdAt = new Date().toISOString();

  const speakText = word.word + '. ' + String(word.example || '').split('(')[0].trim();
  const voiceId = 'xqj50N5hatZhF8MSqCFS';
  try {
    const audioRes = await fetch(`${elevenLabsUrl}/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: speakText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (audioRes.ok) {
      const historyId = audioRes.headers.get('history-item-id');
      if (historyId) word.elevenLabsHistoryId = historyId;
    }
  } catch (audioErr) {
    console.error('Audio error:', audioErr.message);
  }

  if (!word.isRefusal) {
    try {
      word.id = await saveWord(word);
      word.rating = { avg: 0, count: 0 };
    } catch (e) {
      // Still show the word; it just won't be in the dictionary or rateable.
      console.error('Save error:', e.message);
    }
  }

  res.status(200).json(word);
}
