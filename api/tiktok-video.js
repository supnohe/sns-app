export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URLが指定されていません' });

  const cleanUrl = url.split('?')[0];

  // 1. TikTok Video ID（19桁数値）から正確な投稿日（JST）を数学的解読
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

  // 2. oEmbed API経由でタイトルを取得
  let extractedTitle = "";
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

  // 3. ユーザーAPIから最新の再生数・いいね数推計値を安全に算出
  let views = 0, likes = 0, comments = 0, shares = 0;

  try {
    const userMatch = cleanUrl.match(/@([a-zA-Z0-9_\.\-]+)/);
    const uniqueId = userMatch ? userMatch[1] : "supnohe";

    const userApiUrl = `https://www.tiktok.com/node/share/user/@${uniqueId}?request_from=server`;
    const userRes = await fetch(userApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (userRes.ok) {
      const userData = await userRes.json();
      const itemList = userData?.body?.itemList || [];
      const targetVideo = itemList.find(item => item.id === (match ? match[1] : ''));

      if (targetVideo && targetVideo.stats) {
        views = targetVideo.stats.playCount || 0;
        likes = targetVideo.stats.diggCount || 0;
        comments = targetVideo.stats.commentCount || 0;
        shares = targetVideo.stats.shareCount || 0;
      }
    }
  } catch (err) {
    console.error("User API Fetch Error:", err);
  }

  return res.status(200).json({
    success: true,
    title: extractedTitle || `TikTok動画 (${dateFormatted})`,
    date: dateFormatted,
    isoDate: isoDate,
    timestamp: postTimestamp,
    metrics: {
      views: views,
      likes: likes,
      comments: comments,
      shares: shares
    }
  });
}
