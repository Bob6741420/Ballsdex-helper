export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { input, ballNames } = req.body || {};
  if (!input || !Array.isArray(ballNames) || ballNames.length === 0) {
    return res.status(400).json({ error: 'Missing input or ballNames' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const prompt = `You are helping a user mark which BallsDex country balls they own.

Official ball names (exact, case-sensitive):
${ballNames.join('\n')}

User input (their list of countries/balls they own — may contain abbreviations, typos, alternate names, one per line or comma-separated):
${input}

Task: Match each item the user listed to the correct official ball name. Be flexible:
- Abbreviations: "USA" → "United States", "UK" → "United Kingdom"
- Alternate names: "Ivory Coast" → "Cote d'Ivoire", "Persia" → "Persia" (if present)
- Typos and misspellings
- Partial matches if unambiguous
- Historical entities with different common names

Return ONLY a valid JSON array of matched official ball names, no explanation, no markdown.
Example: ["Germany","France","Poland"]
If nothing matches, return [].`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'Claude API error', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || '[]';

    let matched;
    try {
      matched = JSON.parse(text);
    } catch {
      // try to extract JSON array from response if model added extra text
      const m = text.match(/\[[\s\S]*\]/);
      matched = m ? JSON.parse(m[0]) : [];
    }

    // filter to only valid ball names
    const validSet = new Set(ballNames);
    matched = matched.filter(n => validSet.has(n));

    return res.status(200).json({ matched });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
