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

    // 2. ユーザー基本・統計情報を取得
    const statsFields = "open_id,union_id,avatar_url,display_name,follower_count,likes_count,video_count";
    const userRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${statsFields}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userInfo = userData?.data?.user || {};

    // 3. 動画一覧・各数値をTikTok公式APIから取得
    let videosList = [];
    const videoFields = "id,title,create_time,share_url,video_description,like_count,comment_count,share_count,view_count";

    const fetchVideoList = async (endpoint) => {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ max_count: 5, fields: videoFields })
      });
    };

    try {
      // APIエンドポイントのコール（v2規格）
      let videoRes = await fetchVideoList("https://open.tiktokapis.com/v2/post/publish/video/list/");
      let videoData = await videoRes.json();

      if (!videoData?.data?.videos) {
        // 別エンドポイントのフォールバック試行
        videoRes = await fetchVideoList("https://open.tiktokapis.com/v2/video/list/");
        videoData = await videoRes.json();
      }

      if (videoData?.data?.videos) {
        videosList = videoData.data.videos.map(v => {
          const createDate = v.create_time ? new Date(v.create_time * 1000) : new Date();
          return {
            title: v.title || v.video_description || "TikTok動画",
            url: v.share_url || "",
            date: createDate.toLocaleDateString('ja-JP'),
            isoDate: createDate.toISOString().split('T')[0],
            timestamp: createDate.getTime(),
            views: Number(v.view_count || 0),
            likes: Number(v.like_count || 0),
            comments: Number(v.comment_count || 0),
            shares: Number(v.share_count || 0)
          };
        });
      }
    } catch (vErr) {
      console.error("Video list fetch error:", vErr);
    }

    // 4. アプリへリダイレクト
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
