export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vICFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
    // 1. アクセストークンを取得
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

    if (!accessToken) {
      return res.status(400).send("トークン取得に失敗しました: " + JSON.stringify(tokenData));
    }

    // 2. ユーザー統計情報（フォロワー数・総いいね数等）を取得
    const statsFields = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsFields}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    // 3. 直近の動画一覧・各再生数や反応数を自動取得
    let videosList = [];
    try {
      const videoFields = "id,title,create_time,cover_image_url,share_url,video_description,like_count,comment_count,share_count,view_count";
      const videoRes = await fetch("https://open.tiktokapis.com/v2/video/list/?max_count=10", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields: videoFields })
      });
      const videoData = await videoRes.json();

      if (videoData?.data?.videos) {
        videosList = videoData.data.videos.map(v => {
          const createDate = v.create_time ? new Date(v.create_time * 1000) : new Date();
          const isoDate = createDate.toISOString().split('T')[0];
          const dateStr = createDate.toLocaleDateString('ja-JP');

          return {
            title: v.title || v.video_description || "TikTok動画",
            url: v.share_url || "",
            date: dateStr,
            isoDate: isoDate,
            timestamp: createDate.getTime(),
            views: v.view_count || 0,
            likes: v.like_count || 0,
            comments: v.comment_count || 0,
            shares: v.share_count || 0
          };
        });
      }
    } catch (vErr) {
      console.error("Video list fetch error:", vErr);
    }

    // 4. アプリへリダイレクトして取得データを返却
    const redirectParams = new URLSearchParams({
      access_token: accessToken,
      username: userInfo.display_name || "TikTok User",
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
