// Vercel serverless function for messages
// Uses in-memory store (resets on cold start) - v1

let messages = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    const { since } = req.query;
    let result = messages;
    if (since) {
      const idx = messages.findIndex(m => m.id === since);
      if (idx >= 0) result = messages.slice(idx + 1);
    }
    return res.status(200).json(result);
  }
  
  if (req.method === 'POST') {
    const { from, type, text } = req.body || {};
    if (!from || !text) {
      return res.status(400).json({ error: 'from and text required' });
    }
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from,
      type: type || 'message',
      text,
      ts: new Date().toISOString(),
    };
    messages.push(msg);
    messages = messages.slice(-500);
    return res.status(200).json(msg);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
