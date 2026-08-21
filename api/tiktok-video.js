export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, error: 'URLが指定されていません' });
  }

  const cleanUrl = url.split('?')[0];

  // 1. TikTok Video ID（19桁数値）からタイムスタンプ（JST）を完全解読
  let postTimestamp = Date.now();
  let dateFormatted = "";
  let isoDate = "";

  const match = cleanUrl.match(/video\/(\d+)/);
  if (match) {
    try {
      const videoId = BigInt(match[1]);
      const unixSec = Number(videoId >> 32n);
      if (unixSec > 1000000000) {
        postTimestamp = unixSec * 1000;
        const d = new Date(postTimestamp);
        const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
        const y = jstDate.getUTCFullYear();
        const m = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(jstDate.getUTCDate()).padStart(2, '0');
        dateFormatted = `${y}/${m}/${day}`;
        isoDate = `${y}-${m}-${day}`;
      }
    } catch (e) {
      console.error("VideoID Parse Error:", e);
    }
  }

  if (!dateFormatted) {
    const today = new Date();
    dateFormatted = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;
    isoDate = today.toISOString().split('T')[0];
  }

  // 2. サーバーからoEmbed APIで本物の投稿本文を取得
  let extractedTitle = "";

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.title) {
        extractedTitle = data.title.trim();
      }
    }
  } catch (err) {
    console.error("oEmbed Fetch Error:", err);
  }

  // HTMLメタタグフォールバック
  if (!extractedTitle) {
    try {
      const htmlRes = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const htmlText = await htmlRes.text();
      const ogMatch = htmlText.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i) ||
                      htmlText.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);

      if (ogMatch && ogMatch[1]) {
        extractedTitle = ogMatch[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
      }
    } catch (err) {
      console.error("HTML Fallback Error:", err);
    }
  }

  return res.status(200).json({
    success: true,
    title: extractedTitle || `TikTok動画 (${dateFormatted})`,
    date: dateFormatted,
    isoDate: isoDate,
    timestamp: postTimestamp
  });
}
