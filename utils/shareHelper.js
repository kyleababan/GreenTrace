import { Linking, Platform } from "react-native";
import { hideBadWords } from "./hideBadWords";

/**
 * Returns the base public URL of the deployed application.
 */
export const getBaseAppUrl = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    // When testing on localhost, fallback to public production URL
    // so that Facebook's crawler can always resolve and scrape the link
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return (
        process.env.EXPO_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
        "https://greentrace.vercel.app"
      );
    }
    return origin.replace(/\/+$/, "");
  }

  if (process.env.EXPO_PUBLIC_APP_URL) {
    return process.env.EXPO_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  return "https://greentrace.vercel.app";
};

/**
 * Generates the canonical URL for a specific post.
 */
export const getPostShareUrl = (postId) => {
  if (!postId) return getBaseAppUrl();
  const baseUrl = getBaseAppUrl();
  return `${baseUrl}/post?id=${encodeURIComponent(postId)}`;
};

/**
 * Formats an image URL to Facebook's recommended 1200x630 Open Graph dimensions.
 * For Cloudinary URLs, injects c_fill,w_1200,h_630,g_auto,q_auto,f_auto.
 */
export const getOgImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "https://greentrace.vercel.app/assets/images/logo.png";
  }

  if (imageUrl.includes("res.cloudinary.com") && imageUrl.includes("/upload/")) {
    if (
      !imageUrl.includes("/upload/c_fill") &&
      !imageUrl.includes("/upload/w_")
    ) {
      return imageUrl.replace(
        "/upload/",
        "/upload/c_fill,w_1200,h_630,g_auto,q_auto,f_auto/",
      );
    }
  }

  return imageUrl;
};

/**
 * Formats Open Graph title, description, and image from a post object.
 */
export const getPostOgMetadata = (post) => {
  if (!post) {
    return {
      title: "GreenTrace | Community Waste Management & Action",
      description:
        "Report waste issues, track cleanups, and help keep our community clean with GreenTrace.",
      imageUrl: "https://greentrace.vercel.app/assets/images/logo.png",
      url: getBaseAppUrl(),
    };
  }

  const rawTitle = post.title || post.caption || "Community Waste Report";
  const cleanTitle = hideBadWords(String(rawTitle).trim());
  const title = `${cleanTitle} | GreenTrace`;

  const locationPart = post.locationName ? ` in ${post.locationName}` : "";
  const authorPart =
    post.firstName || post.lastName
      ? ` by ${[post.firstName, post.lastName].filter(Boolean).join(" ")}`
      : "";
  const statusPart = post.status ? ` [Status: ${post.status}]` : "";
  const captionPart = post.caption
    ? `${hideBadWords(String(post.caption).replace(/\s+/g, " ").trim())} • `
    : "";

  const description = `${captionPart}Reported${authorPart}${locationPart}${statusPart} • Pinamungajan Waste Management Platform`;
  const imageUrl = getOgImageUrl(post.imageUrl);
  const url = getPostShareUrl(post.id);

  return {
    title,
    description,
    imageUrl,
    url,
  };
};

/**
 * Opens Facebook's official Share Dialog in a popup window (or secure new tab / app).
 * Requirement 1:
 * URL pattern: https://www.facebook.com/sharer/sharer.php?u=[ENCODED_POST_URL]
 * Popup: width 626, height 436 (or new tab _blank with noopener noreferrer)
 */
export const openFacebookShareDialog = (postOrId) => {
  const postId =
    typeof postOrId === "object" && postOrId !== null
      ? postOrId.id
      : postOrId;
  const shareUrl = getPostShareUrl(postId);
  const fbShareDialogUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    shareUrl,
  )}`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const width = 626;
    const height = 436;
    const left = window.screen?.width
      ? Math.max(0, (window.screen.width - width) / 2)
      : 100;
    const top = window.screen?.height
      ? Math.max(0, (window.screen.height - height) / 2)
      : 100;

    const popupFeatures = `width=${width},height=${height},top=${top},left=${left},toolbar=0,status=0,resizable=yes,scrollbars=yes`;

    try {
      const popup = window.open(
        fbShareDialogUrl,
        "fb_share_dialog",
        popupFeatures,
      );
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        // Popup was blocked by browser, open in secure new tab
        window.open(fbShareDialogUrl, "_blank", "noopener,noreferrer");
      } else {
        popup.focus?.();
      }
    } catch {
      window.open(fbShareDialogUrl, "_blank", "noopener,noreferrer");
    }
  } else {
    // Mobile React Native
    Linking.openURL(fbShareDialogUrl).catch((err) => {
      console.warn("Unable to open Facebook share dialog:", err);
    });
  }
};

/**
 * Injects or updates Open Graph and Twitter card meta tags in HTML <head> dynamically.
 */
export const updatePostHeadMetaTags = (post) => {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const { title, description, imageUrl, url } = getPostOgMetadata(post);

  if (title) {
    document.title = title;
  }

  const tags = {
    "og:type": "article",
    "og:site_name": "GreenTrace",
    "og:title": title,
    "og:description": description,
    "og:image": imageUrl,
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:url": url,
    "twitter:card": "summary_large_image",
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": imageUrl,
  };

  Object.entries(tags).forEach(([property, content]) => {
    if (!content) return;
    const isTwitter = property.startsWith("twitter:");
    const attr = isTwitter ? "name" : "property";
    let meta = document.querySelector(`meta[${attr}="${property}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(attr, property);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  });
};

