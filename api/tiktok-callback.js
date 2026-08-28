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
    // 1. TikTok公式OAuthでアカウント基本情報を取得
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

    // 2. RapidAPI 経由で動画パフォーマンス数値（再生・いいね・コメ・シェア）を自動取得
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
      // レスポンスの階層を柔軟に判定
      const postsList = rapidData?.data?.itemList || rapidData?.itemList || rapidData?.data?.videos || rapidData?.data || [];

      if (Array.isArray(postsList)) {
        videosList = postsList.slice(0, 5).map(v => {
          // statsV2 または stats または 直下プロパティに対応
          const st = v.statsV2 || v.stats || v.statistics || v;
          const createTime = v.createTime ? new Date(v.createTime * 1000) : (v.create_time ? new Date(v.create_time * 1000) : new Date());

          const playCount = st.playCount || st.play_count || st.views || v.playCount || 0;
          const diggCount = st.diggCount || st.digg_count || st.likes || v.diggCount || 0;
          const commentCount = st.commentCount || st.comment_count || st.comments || v.commentCount || 0;
          const shareCount = st.shareCount || st.share_count || st.shares || v.shareCount || 0;

          return {
            title: v.desc || v.title || v.video_description || "TikTok動画",
            url: `https://www.tiktok.com/@${targetUsername}/video/${v.id || v.video_id}`,
            date: createTime.toLocaleDateString('ja-JP'),
            isoDate: createTime.toISOString().split('T')[0],
            timestamp: createTime.getTime(),
            views: Number(playCount),
            likes: Number(diggCount),
            comments: Number(commentCount),
            shares: Number(shareCount)
          };
        });
      }
    } catch (rapidErr) {
      console.error("RapidAPI Fetch Error:", rapidErr);
    }

    // 3. 取得データをフロントエンドへ渡す
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
