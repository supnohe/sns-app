// Vercel Serverless Function (Node.js)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { uniqueId } = req.query;
  if (!uniqueId) {
    return res.status(400).json({ error: 'uniqueId is required' });
  }

  try {
    const targetUrl = `https://www.tiktok.com/@${uniqueId}`;
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
      }
    });

    const htmlText = await response.text();

    const jsonMatch = htmlText.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">(.*?)<\/script>/s)
                   || htmlText.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/s);

    if (jsonMatch && jsonMatch[1]) {
      const jsonData = JSON.parse(jsonMatch[1]);
      const userScope = jsonData.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo
                     || jsonData.UserModule?.users?.[uniqueId]
                     || {};
      const stats = userScope.stats || jsonData.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.stats || {};

      return res.status(200).json({
        success: true,
        uniqueId: uniqueId,
        nickname: userScope.user?.nickname || uniqueId,
        followers: stats.followerCount || 0,
        likes: stats.heartCount || stats.heart || 0,
        videos: stats.videoCount || 0
      });
    }

    const fMatch = htmlText.match(/"followerCount":\s*(\d+)/);
    const lMatch = htmlText.match(/"heartCount":\s*(\d+)/);
    const vMatch = htmlText.match(/"videoCount":\s*(\d+)/);

    if (fMatch || lMatch) {
      return res.status(200).json({
        success: true,
        uniqueId: uniqueId,
        followers: fMatch ? parseInt(fMatch[1]) : 0,
        likes: lMatch ? parseInt(lMatch[1]) : 0,
        videos: vMatch ? parseInt(vMatch[1]) : 0
      });
    }

    throw new Error('Data extraction failed');

  } catch (error) {
    console.error('TikTok Scrape Error:', error);
    return res.status(500).json({ error: 'Failed to fetch TikTok data' });
  }
}
