const handler = async (req, res) => {
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

If the concept is offensive, sexual, hateful, violent, or inappropriate in any way, do NOT refuse with a plain error. Instead, invent a German word that wittily describes the act of typing something offensive into a word generator — something like the feeling of revealing poor judgment, the specific shame of trying to make an AI say something crude, or the peculiar emptiness of that choice. Make it pointed but clever, not mean.

Respond ONLY with a JSON object. No markdown, no backticks, no explanation. Exactly this structure:
{
  "word": "TheNewGermanWord",
  "pronunciation": "approximate phonetic pronunciation for English speakers",
  "parts": [
    {"german": "Teil1", "meaning": "English meaning"},
    {"german": "Teil2", "meaning": "English meaning"}
  ],
  "definition": "A one or two sentence definition, as if from a dictionary.",
  "example": "An example sentence in German, followed by its English translation in parentheses.",
  "isRefusal": true or false
}`,
      messages: [{ role: 'user', content: `Invent a new German compound word for this concept: ${concept}` }]
    })
  });

  const data = await response.json();
  const raw = data.content.find(b => b.type === 'text')?.text || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    const word = JSON.parse(clean);
    word.concept = concept;
    word.createdAt = new Date().toISOString();
    word.wordKey = `${word.word.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;

    const speakText = word.word + '. ' + word.example.split('(')[0].trim();
    const voiceId = 'xqj50N5hatZhF8MSqCFS';
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    try {
      const audioRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
        const audioBuffer = await audioRes.arrayBuffer();
        const filename = `audio-${word.wordKey}.mp3`;

        const uploadRes = await fetch(`https://blob.vercel-storage.com/${filename}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${blobToken}`,
            'Content-Type': 'audio/mpeg',
            'x-content-type': 'audio/mpeg',
            'cache-control': 'public, max-age=31536000'
          },
          body: Buffer.from(audioBuffer)
        });

        if (uploadRes.ok) {
          const blobData = await uploadRes.json();
          word.audioUrl = blobData.url;
        } else {
          const errText = await uploadRes.text();
          console.error('Blob upload failed:', uploadRes.status, errText);
        }
      }
    } catch (audioErr) {
      console.error('Audio error:', audioErr.message);
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];

    if (!word.isRefusal) {
      await fetch(`${proto}://${host}/api/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(word)
      });
    }

    res.status(200).json(word);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse response', raw });
  }
};

module.exports = handler;
