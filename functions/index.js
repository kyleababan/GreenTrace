const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { v2: cloudinary } = require("cloudinary");

// Configure Cloudinary helper
function getCloudinary() {
  cloudinary.config({
    cloud_name: "dah7khha8",
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

// ---------------------------------------------------------------------------
// Delete image from Cloudinary
// ---------------------------------------------------------------------------
exports.deleteCloudinaryImage = onCall(
  {
    secrets: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { publicId } = request.data || {};
    if (!publicId || typeof publicId !== "string") {
      throw new HttpsError("invalid-argument", "A valid publicId is required.");
    }

    const cld = getCloudinary();

    try {
      const result = await cld.uploader.destroy(publicId, {
        invalidate: true,
      });
      return { result: result.result };
    } catch (error) {
      console.error("Cloudinary destroy error:", error);
      throw new HttpsError(
        "internal",
        "Failed to delete image from Cloudinary.",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// Verify moderation status of uploaded image
// Checks Cloudinary resource details. If rejected as NSFW / offensive,
// automatically deletes the asset and rejects the request.
// ---------------------------------------------------------------------------
exports.checkImageModeration = onCall(
  {
    secrets: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { publicId } = request.data || {};
    if (!publicId || typeof publicId !== "string") {
      throw new HttpsError("invalid-argument", "A valid publicId is required.");
    }

    const cld = getCloudinary();

    try {
      // Poll resource details for up to 6 seconds (moderation analysis can take 1-3s)
      let moderationStatus = "pending";
      let moderationReason = "";

      for (let attempt = 0; attempt < 4; attempt++) {
        const resource = await cld.api.resource(publicId, {
          moderation: true,
        });

        const modArray = resource.moderation || [];
        if (modArray.length > 0) {
          const mod = modArray[0];
          moderationStatus = mod.status; // 'approved' | 'rejected' | 'pending'

          if (moderationStatus === "rejected") {
            moderationReason =
              mod.response?.rejection_reason ||
              "NSFW / Inappropriate content detected";
            break;
          } else if (moderationStatus === "approved") {
            break;
          }
        } else {
          // If no moderation configured on asset, consider safe
          moderationStatus = "approved";
          break;
        }

        // Wait 1.5s before polling again if still pending
        if (moderationStatus === "pending") {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      if (moderationStatus === "rejected") {
        // Automatically delete the NSFW/rejected image
        try {
          await cld.uploader.destroy(publicId, { invalidate: true });
        } catch (delErr) {
          console.warn("Failed to auto-delete rejected asset:", delErr);
        }

        return {
          approved: false,
          reason: moderationReason || "NSFW / Inappropriate content detected",
        };
      }

      return {
        approved: true,
        status: moderationStatus,
      };
    } catch (error) {
      console.error("Moderation check error:", error);
      // If resource not found or API error, return error
      throw new HttpsError(
        "internal",
        error.message || "Failed to check image moderation.",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// OpenAI Omni-Moderation (Free)
// Checks image with OpenAI omni-moderation-latest model.
// If flagged as sexual, violence, hate, etc., deletes from Cloudinary and rejects.
// ---------------------------------------------------------------------------
exports.moderateWithOpenAI = onCall(
  {
    secrets: ["OPENAI_API_KEY", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const { imageUrl, publicId } = request.data || {};
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new HttpsError("invalid-argument", "A valid imageUrl is required.");
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.warn("OPENAI_API_KEY not set. Skipping OpenAI moderation.");
      return { approved: true, skipped: true };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("OpenAI Moderation API response error:", data);
        throw new HttpsError(
          "internal",
          data.error?.message || "OpenAI Moderation call failed.",
        );
      }

      const result = data.results?.[0];
      if (result?.flagged) {
        const categories = result.categories || {};
        const flaggedCats = Object.keys(categories).filter(
          (k) => categories[k],
        );

        // Delete flagged image from Cloudinary
        if (publicId) {
          try {
            const cld = getCloudinary();
            await cld.uploader.destroy(publicId, { invalidate: true });
          } catch (delErr) {
            console.warn(
              "Failed to auto-delete flagged Cloudinary image:",
              delErr,
            );
          }
        }

        return {
          approved: false,
          reason:
            "Image rejected: Inappropriate or NSFW content was detected (" +
            flaggedCats.join(", ") +
            ").",
          categories: flaggedCats,
        };
      }

      return { approved: true };
    } catch (error) {
      console.error("OpenAI moderation check error:", error);
      throw new HttpsError(
        "internal",
        error.message || "Failed to check OpenAI moderation.",
      );
    }
  },
);
