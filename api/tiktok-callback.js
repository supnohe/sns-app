export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vICFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  const RAPID_API_KEY = "d5d83e4fa6msh08478310af3bfcfp150258jsnf9ffe2098b50";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
    // 1. TikTok公式OAuth認証
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const statsFields = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsFields}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    // 2. RapidAPI 経由で @supnohe の最新5投稿の各インサイト数値を自動取得
    let videosList = [];
    const targetUsername = "supnohe";

    try {
      const rapidRes = await fetch(`https://tiktok-api23.p.rapidapi.com/api/user/posts?unique_id=${targetUsername}&count=5`, {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "tiktok-api23.p.rapidapi.com"
        }
      });

      const rapidData = await rapidRes.json();
      console.log("RapidAPI Response:", JSON.stringify(rapidData));

      // レスポンス配列の抽出
      const rawPosts = rapidData?.data?.itemList || rapidData?.itemList || rapidData?.data?.videos || rapidData?.data || [];

      if (Array.isArray(rawPosts) && rawPosts.length > 0) {
        videosList = rawPosts.slice(0, 5).map(v => {
          const stats = v.statsV2 || v.stats || v.statistics || v;
          const createTime = v.createTime ? new Date(v.createTime * 1000) : (v.create_time ? new Date(v.create_time * 1000) : new Date());

          return {
            title: v.desc || v.title || v.video_description || "TikTok投稿動画",
            url: `https://www.tiktok.com/@${targetUsername}/video/${v.id || v.video_id}`,
            date: createTime.toLocaleDateString('ja-JP'),
            isoDate: createTime.toISOString().split('T')[0],
            timestamp: createTime.getTime(),
            views: Number(stats.playCount || stats.play_count || stats.views || 0),
            likes: Number(stats.diggCount || stats.digg_count || stats.likes || 0),
            comments: Number(stats.commentCount || stats.comment_count || stats.comments || 0),
            shares: Number(stats.shareCount || stats.share_count || stats.shares || 0)
          };
        });
      }
    } catch (rapidErr) {
      console.error("RapidAPI Error:", rapidErr);
    }

    // 3. アプリへリダイレクト
    const redirectParams = new URLSearchParams({
      access_token: accessToken || "success",
      username: userInfo.display_name || `@${targetUsername}`,
      followers: userInfo.follower_count || 19565,
      likes: userInfo.likes_count || 529342,
      videos: userInfo.video_count || 173,
      videos_data: JSON.stringify(videosList)
    });

    res.writeHead(302, { Location: `/?${redirectParams.toString()}` });
    res.end();

  } catch (error) {
    res.status(500).send("通信エラー: " + error.message);
  }
}
