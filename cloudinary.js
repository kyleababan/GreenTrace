import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

// ---------------------------------------------------------------------------
// Native (iOS / Android) — compress with expo-image-manipulator
// ---------------------------------------------------------------------------
async function compressNative(uri) {
  const qualities = [0.8, 0.6, 0.4];

  for (const quality of qualities) {
    const context = ImageManipulator.manipulate(uri);
    const result = await context.renderAsync();
    const saved = await result.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
      base64: true,
    });

    const size = saved.fileSize ?? Infinity;
    if (size <= MAX_BYTES) {
      return {
        uri: saved.uri,
        base64: saved.base64,
      };
    }
  }

  throw new Error(
    "Image is too large to compress below 2.5 MB. Please choose a smaller photo.",
  );
}

// ---------------------------------------------------------------------------
// Web — compress with an off-screen canvas (supports both image.file and image.uri)
// ---------------------------------------------------------------------------
async function compressWeb(image) {
  const qualities = [0.8, 0.6, 0.4];

  // 1. Safely resolve Blob and Object URL from whatever Expo ImagePicker provided
  let blob = null;
  let objectUrl = null;

  if (image?.file instanceof Blob) {
    blob = image.file;
  } else if (image instanceof Blob) {
    blob = image;
  } else if (image?.uri) {
    try {
      const res = await fetch(image.uri);
      blob = await res.blob();
    } catch (e) {
      console.warn("Could not fetch blob from image.uri:", e);
    }
  }

  if (blob) {
    objectUrl = URL.createObjectURL(blob);
  } else if (typeof image?.uri === "string") {
    objectUrl = image.uri;
  }

  // 2. Decode into an image source (createImageBitmap with HTMLImageElement fallback)
  let imageSource = null;
  let sourceWidth = 0;
  let sourceHeight = 0;

  if (blob && typeof createImageBitmap === "function") {
    try {
      imageSource = await createImageBitmap(blob);
      sourceWidth = imageSource.width;
      sourceHeight = imageSource.height;
    } catch (bitmapErr) {
      console.warn(
        "createImageBitmap failed, trying HTMLImageElement fallback:",
        bitmapErr,
      );
    }
  }

  if (!imageSource && objectUrl) {
    try {
      imageSource = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(
            new Error(
              "Unable to decode picture. Please choose a different photo format (JPEG, PNG, or WEBP).",
            ),
          );
        img.src = objectUrl;
      });
      sourceWidth = imageSource.naturalWidth || imageSource.width;
      sourceHeight = imageSource.naturalHeight || imageSource.height;
    } catch (imgErr) {
      console.warn("HTMLImageElement decoding error:", imgErr);
    }
  }

  if (!imageSource || !sourceWidth || !sourceHeight) {
    throw new Error(
      "Unable to decode picture. Please select a valid JPEG, PNG, or WEBP photo.",
    );
  }

  // 3. Limit maximum canvas dimensions (max 1920px) to prevent mobile browser memory exhaustion
  const MAX_DIM = 1920;
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
      targetWidth = MAX_DIM;
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
      targetHeight = MAX_DIM;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

  if (objectUrl && objectUrl.startsWith("blob:")) {
    URL.revokeObjectURL(objectUrl);
  }

  // 4. Try quality levels to get under MAX_BYTES (2.5 MB)
  for (const quality of qualities) {
    const outputBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (outputBlob && outputBlob.size <= MAX_BYTES) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const rawBase64 = dataUrl.split(",")[1];
      return {
        blob: outputBlob,
        base64: rawBase64,
      };
    }
  }

  // Fallback: scale down by 30% if still too large
  canvas.width = Math.round(targetWidth * 0.7);
  canvas.height = Math.round(targetHeight * 0.7);
  ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

  const fallbackBlob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.6),
  );
  const fallbackDataUrl = canvas.toDataURL("image/jpeg", 0.6);
  return {
    blob: fallbackBlob,
    base64: fallbackDataUrl.split(",")[1],
  };
}

// ---------------------------------------------------------------------------
// Main upload function
// Flow: Compress (≤ 2.5MB) -> Moderate & Classify with AI FIRST -> Safe? Upload : NSFW? Block!
// ---------------------------------------------------------------------------
export const uploadToCloudinary = async (image, options = {}) => {
  let fileToUpload;
  let base64Data = "";

  // 1. Compress image to stay under 2.5 MB & get base64
  if (Platform.OS === "web") {
    const compressed = await compressWeb(image);
    fileToUpload = compressed.blob;
    base64Data = compressed.base64;
  } else {
    const compressed = await compressNative(image.uri);
    fileToUpload = {
      uri: compressed.uri,
      type: "image/jpeg",
      name: image.fileName ?? "upload.jpg",
    };
    base64Data = compressed.base64;
  }

  // 2. CHECK CONTENT WITH GEMINI VISION BEFORE UPLOADING
  // Moderates for NSFW/inappropriate and classifies waste in a single call.
  // If flagged as unsafe, rejects BEFORE it ever reaches Cloudinary.
  let classification = null;
  if (base64Data && !options.skipModeration && !options.skipAi) {
    classification = await verifyGeminiModerationAndClassification(
      base64Data,
      options,
    );
  }

  // 3. Image is safe — now upload to Cloudinary
  const data = new FormData();

  if (Platform.OS === "web") {
    data.append(
      "file",
      fileToUpload,
      image?.file?.name ?? image?.fileName ?? "upload.jpg",
    );
  } else {
    data.append("file", fileToUpload);
  }

  data.append("upload_preset", "greentrace_uploads");
  data.append("cloud_name", "dah7khha8");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/dah7khha8/image/upload",
    {
      method: "POST",
      body: data,
    },
  );

  const result = await res.json();

  if (!result.secure_url) {
    throw new Error(result.error?.message || "Cloudinary upload failed");
  }

  if (options.classifyWaste) {
    return {
      secureUrl: result.secure_url,
      classification,
    };
  }

  return result.secure_url;
};

// ---------------------------------------------------------------------------
// Helper: verify moderation & classify waste with Gemini 3.5 Flash Lite (Free)
// ---------------------------------------------------------------------------
async function verifyGeminiModerationAndClassification(
  base64Data,
  options = {},
) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[GreenTrace AI] EXPO_PUBLIC_GEMINI_API_KEY is not defined in this build. Gemini AI moderation and classification are disabled. If running on Vercel, please add EXPO_PUBLIC_GEMINI_API_KEY in your Vercel Project Settings > Environment Variables, then redeploy.",
    );
    return null;
  }

  const prompt = `You are an AI assistant for GreenTrace, a civic public waste reporting and community sanitation app.
Analyze this user-submitted photo.

STEP 1: STRICT CONTENT MODERATION
Reject any image that contains:
- NSFW, adult content, nudity, partial nudity, underwear, lingerie, swimwear/bikini posing, or sexually suggestive/provocative content.
- Graphic violence, weapons, blood, gore, or hate symbols.
- Selfies, personal photos, or images completely unrelated to public waste, community concerns, or environmental issues.
If unsafe: set "isSafe": false, and describe why in "reason".

STEP 2: WASTE CLASSIFICATION (Only if isSafe is true)
Classify the visible waste into ONE of these 9 categories and their subcategories:
1. Plastic (Subcategories: Plastic bottle, Plastic bag, Plastic food container, Plastic wrapper/packaging, Plastic cup, Other plastic)
2. Paper (Subcategories: Cardboard, Paper, Newspaper/magazine, Paper packaging, Other paper)
3. Glass (Subcategories: Glass bottle, Glass container, Broken glass, Other glass)
4. Metal (Subcategories: Aluminum can, Tin/metal can, Scrap metal, Other metal)
5. Organic/Biodegradable (Subcategories: Food waste, Leaves/grass, Branches/wood, Other organic waste)
6. E-Waste (Subcategories: Electronics, Cables/wires, Batteries, Computer/phone parts, Other e-waste)
7. Construction Waste (Subcategories: Concrete, Bricks/tiles, Wood construction material, Other construction waste)
8. Mixed Waste (Use this if multiple waste types or subcategories are present, or more than 1 category/subcategory visible. subcategory MUST be null.)
9. Other/Unknown (Use this if the object does not fit the categories above, image is too unclear, or confidence < 0.60. subcategory MUST be null.)

Rules:
- Do NOT classify based only on color. Use visible characteristics and likely material.
- If the subcategories consist of more than 1 (or multiple different waste materials are present), you MUST classify as "Mixed Waste" with "subcategory": null.
- If confidence is below 0.60, classify as "Other/Unknown" or "Mixed Waste".
- Provide a confidence score between 0.0 and 1.0.

Respond strictly in valid JSON format:
{
  "isSafe": true,
  "reason": "Brief explanation if unsafe, or short rationale of waste found",
  "classification": {
    "category": "Plastic",
    "subcategory": "Plastic bottle",
    "confidence": 0.94,
    "reason": "Clear visible transparent plastic bottle."
  }
}
(If isSafe is false, "classification" should be null).`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      console.warn("Gemini API error:", data.error?.message);
      return null;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const cleanJson = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.isSafe === false) {
        // Flagged! Reject and block the post immediately.
        throw new Error(
          "Image rejected: " +
            (parsed.reason ||
              "Inappropriate or NSFW content was detected. Please choose a different photo."),
        );
      }

      if (parsed.classification) {
        // Normalize classification
        let { category, subcategory, confidence, reason } =
          parsed.classification;

        // Enforce confidence threshold >= 0.60
        if (typeof confidence === "number" && confidence < 0.6) {
          if (category !== "Mixed Waste") {
            category = "Other/Unknown";
            subcategory = null;
          }
        }

        return {
          category: category || "Other/Unknown",
          subcategory: subcategory || null,
          confidence:
            typeof confidence === "number"
              ? Math.round(confidence * 100) / 100
              : 0.8,
          reason: reason || "",
        };
      }
    }

    return null;
  } catch (err) {
    // If the error was a moderation rejection, bubble it up to block post creation!
    if (err.message?.startsWith("Image rejected:")) {
      throw err;
    }
    console.warn(
      "Gemini moderation/classification check warning:",
      err.message,
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Delete a Cloudinary image by its secure_url
// (Silently ignored if Firebase Blaze backend is not configured)
// ---------------------------------------------------------------------------
export const deleteFromCloudinary = async (secureUrl) => {
  if (!secureUrl) return;

  try {
    const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) return;

    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const functions = getFunctions();
    const deleteImage = httpsCallable(functions, "deleteCloudinaryImage");

    await deleteImage({ publicId: match[1] });
  } catch (error) {
    // Non-fatal: if on free Firebase Spark plan, deletion is skipped without error
  }
};
