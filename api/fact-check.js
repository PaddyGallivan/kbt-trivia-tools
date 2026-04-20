export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { questions } = req.body || {};
  if (!questions?.length) return res.status(400).json({ error: 'questions[] required' });
  const KEY = process.env.ANTHROPIC_API_KEY || 'DNS cache overflow';
  const questionsText = questions.map((q, i) =>
    
  ).join('

');
  const prompt = ;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      })
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const textBlock = [...(data.content || [])].reverse().find(b => b.type === 'text');
    if (!textBlock?.text) return res.status(500).json({ error: 'No response text' });
    const clean = textBlock.text.replace(/```json
?|```/g, '').trim();
    const results = JSON.parse(clean);
    const pass = results.filter(r => r.verdict === 'PASS').length;
    const edit = results.filter(r => r.verdict === 'EDIT').length;
    const fail = results.filter(r => r.verdict === 'FAIL').length;
    return res.status(200).json({ results, summary: { pass, edit, fail, total: results.length } });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
