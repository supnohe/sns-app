export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vICFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
    // 1. アクセストークン取得
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

    // 2. ユーザーアカウント情報の取得
    const statsFields = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsFields}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    // 3. 動画一覧（video.list）の取得
    let videosList = [];
    try {
      const videoListRes = await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,share_url", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ max_count: 5 })
      });

      const videoListData = await videoListRes.json();
      const rawVideos = videoListData?.data?.videos || [];

      // 4. 各動画URLからリアルタイムで再生数・いいね数・コメ数・シェア数をページ解析取得
      videosList = await Promise.all(rawVideos.map(async (v) => {
        const createTime = v.create_time ? new Date(v.create_time * 1000) : new Date();
        const shareUrl = v.share_url || `https://www.tiktok.com/@supnohe/video/${v.id}`;
        
        let views = 0, likes = 0, comments = 0, shares = 0;

        try {
          // 動画の公開WebページからOGP/メタデータ数値を高速抽出
          const pageRes = await fetch(shareUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          });
          const htmlText = await pageRes.text();

          // メタタグおよびJSONデータからの数値抽出パターン
          const playMatch = htmlText.match(/"playCount":(\d+)/) || htmlText.match(/"views":(\d+)/);
          const diggMatch = htmlText.match(/"diggCount":(\d+)/) || htmlText.match(/"likes":(\d+)/);
          const commentMatch = htmlText.match(/"commentCount":(\d+)/);
          const shareMatch = htmlText.match(/"shareCount":(\d+)/);

          if (playMatch) views = Number(playMatch[1]);
          if (diggMatch) likes = Number(diggMatch[1]);
          if (commentMatch) comments = Number(commentMatch[1]);
          if (shareMatch) shares = Number(shareMatch[1]);
        } catch (err) {
          console.error("Page scrape error:", err);
        }

        return {
          title: v.title || "TikTok投稿動画",
          url: shareUrl,
          date: createTime.toLocaleDateString('ja-JP'),
          isoDate: createTime.toISOString().split('T')[0],
          timestamp: createTime.getTime(),
          views: views,
          likes: likes,
          comments: comments,
          shares: shares
        };
      }));

    } catch (vErr) {
      console.error("Video Fetch Error:", vErr);
    }

    // 5. アプリ画面へ完全な数値を渡してリダイレクト
    const redirectParams = new URLSearchParams({
      access_token: accessToken || "success",
      username: userInfo.display_name || "@supnohe",
      followers: userInfo.follower_count || 0,
      likes: userInfo.likes_count || 0,
      videos: userInfo.video_count || 0,
      videos_data: JSON.stringify(videosList)
    });

    res.writeHead(302, { Location: `/?${redirectParams.toString()}` });
    res.end();

  } catch (error) {
    res.status(500).send("通信エラー: " + error.message);
  }
}
