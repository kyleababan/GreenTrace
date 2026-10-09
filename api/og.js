/**
 * Vercel Serverless Function to serve rich Open Graph (OG) HTML
 * when Facebook Crawler, Twitter, WhatsApp, etc. scrape a post link.
 */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanText(str, maxLength = 240) {
  if (!str) return "";
  const cleaned = String(str).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + "...";
}

function formatOgImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "https://greentrace.vercel.app/assets/images/logo.png";
  }
  if (imageUrl.includes("res.cloudinary.com") && imageUrl.includes("/upload/")) {
    if (!imageUrl.includes("/upload/c_fill") && !imageUrl.includes("/upload/w_")) {
      return imageUrl.replace(
        "/upload/",
        "/upload/c_fill,w_1200,h_630,g_auto,q_auto,f_auto/",
      );
    }
  }
  return imageUrl;
}

module.exports = async function handler(req, res) {
  try {
    const { id, postId: queryPostId } = req.query || {};
    const postId = id || queryPostId;

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host =
      req.headers["x-forwarded-host"] ||
      req.headers.host ||
      "greentrace.vercel.app";
    const baseUrl = `${proto}://${host}`;

    let title = "GreenTrace | Community Waste Management & Action";
    let description =
      "Report waste issues, track cleanups, and help keep our community clean with GreenTrace.";
    let imageUrl = "https://greentrace.vercel.app/assets/images/logo.png";
    let postCanonicalUrl = `${baseUrl}/home`;
    let appRedirectUrl = `${baseUrl}/home`;

    if (postId) {
      postCanonicalUrl = `${baseUrl}/post?id=${encodeURIComponent(postId)}`;
      appRedirectUrl = `${baseUrl}/post?id=${encodeURIComponent(postId)}`;

      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/greentrace-b84b5/databases/(default)/documents/posts/${encodeURIComponent(
          postId,
        )}`;
        const response = await fetch(firestoreUrl);

        if (response.ok) {
          const postDoc = await response.json();
          const f = postDoc.fields || {};

          const rawTitle =
            f.title?.stringValue || f.caption?.stringValue || "Waste Report";
          title = `${cleanText(rawTitle, 80)} | GreenTrace`;

          const author = [
            f.firstName?.stringValue,
            f.lastName?.stringValue,
          ]
            .filter(Boolean)
            .join(" ");

          const location = f.locationName?.stringValue || "";
          const status = f.status?.stringValue || "";
          const caption = f.caption?.stringValue || "";

          const captionPart = caption ? `${cleanText(caption, 140)} • ` : "";
          const authorPart = author ? `Reported by ${author}` : "Reported";
          const locationPart = location ? ` in ${location}` : "";
          const statusPart = status ? ` [Status: ${status}]` : "";

          description = `${captionPart}${authorPart}${locationPart}${statusPart} • GreenTrace Pinamungajan`;

          if (f.imageUrl?.stringValue) {
            imageUrl = formatOgImage(f.imageUrl.stringValue);
          }
        }
      } catch (fetchErr) {
        console.warn("Could not fetch post from Firestore:", fetchErr);
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="GreenTrace">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:url" content="${escapeHtml(postCanonicalUrl)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <!-- Human visitor client-side redirect to the interactive post -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(appRedirectUrl)}">
  <script>
    if (typeof window !== 'undefined') {
      window.location.replace(${JSON.stringify(appRedirectUrl)});
    }
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #F4FAF6; color: #1D2B21; margin: 0; padding: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; text-align: center;">
  <div style="max-width: 560px; background: #FFFFFF; border-radius: 16px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #D8E6DC;">
    <h1 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #1D2B21;">${escapeHtml(
      title,
    )}</h1>
    <p style="color: #4D5D52; font-size: 14px; line-height: 1.5; margin: 12px 0;">${escapeHtml(
      description,
    )}</p>
    ${
      imageUrl
        ? `<div style="margin: 16px 0; border-radius: 12px; overflow: hidden; background: #EBEBEB;"><img src="${escapeHtml(
            imageUrl,
          )}" alt="${escapeHtml(
            title,
          )}" style="width: 100%; height: auto; display: block; max-height: 380px; object-fit: cover;" /></div>`
        : ""
    }
    <a href="${escapeHtml(
      appRedirectUrl,
    )}" style="display: inline-block; background: #5F9C76; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 24px; margin-top: 8px;">View in GreenTrace</a>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    );
    res.status(200).send(html);
  } catch (error) {
    console.error("OG Handler error:", error);
    res.status(500).send("Internal Server Error");
  }
};

