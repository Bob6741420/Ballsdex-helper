export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !url.startsWith('https://ballidentifier.xyz/')) {
    return res.status(400).send('Bad request');
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'Referer': 'https://ballidentifier.xyz/',
        'Origin': 'https://ballidentifier.xyz',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Upstream error');
    }

    const type = upstream.headers.get('content-type') || 'image/webp';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buf = await upstream.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(502).send('Proxy error');
  }
}
