export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { concept } = req.body;
  if (!concept) return res.status(400).json({ error: 'No concept provided' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a creative German linguist who invents plausible-sounding new German compound words. Given a concept, create a single new German word that could realistically exist in German.

Respond ONLY with a JSON object. No markdown, no backticks, no explanation. Exactly this structure:
{
  "word": "TheNewGermanWord",
  "pronunciation": "approximate phonetic pronunciation for English speakers",
  "parts": [
    {"german": "Teil1", "meaning": "English meaning"},
    {"german": "Teil2", "meaning": "English meaning"}
  ],
  "definition": "A one or two sentence definition, as if from a dictionary.",
  "example": "An example sentence in German, followed by its English translation in parentheses."
}`,
      messages: [{ role: 'user', content: `Invent a new German compound word for this concept: ${concept}` }]
    })
  });

  const data = await response.json();
  const raw = data.content.find(b => b.type === 'text')?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    const word = JSON.parse(clean);
    res.status(200).json(word);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse response', raw });
  }
}
