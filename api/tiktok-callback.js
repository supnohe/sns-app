export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_KEY = "sbawb0xfwm83i7dzw2";
  const CLIENT_SECRET = "vlCFuD4w4r2OI78mtTqcz45Um94KdzS1";
  const REDIRECT_URI = "https://sns-app-iota.vercel.app/api/tiktok-callback.js";

  if (!code) {
    return res.status(400).send("認可コードが受け取れませんでした。");
  }

  try {
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
    
    if (tokenData.access_token) {
      res.writeHead(302, { Location: `/?access_token=${tokenData.access_token}&open_id=${tokenData.open_id || ''}` });
      res.end();
    } else {
      res.status(400).send("トークン取得に失敗しました: " + JSON.stringify(tokenData));
    }
  } catch (error) {
    res.status(500).send("通信エラー: " + error.message);
  }
}
