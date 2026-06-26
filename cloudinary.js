import { Platform } from "react-native";

export const uploadToCloudinary = async (image) => {
  const data = new FormData();

  if (Platform.OS === "web") {
    // Browser upload
    data.append("file", image.file);
  } else {
    // Android / iOS upload
    data.append("file", {
      uri: image.uri,
      type: image.mimeType || "image/jpeg",
      name: image.fileName || "upload.jpg",
    });
  }

  data.append("upload_preset", "greentrace_uploads");
  data.append("cloud_name", "dah7khha8");

  const res = await fetch(
    "https://api.cloudinary.com/v1_1/dah7khha8/image/upload",
    {
      method: "POST",
      body: data,
    }
  );

  const result = await res.json();

  

  if (!result.secure_url) {
    throw new Error(result.error?.message || "Cloudinary upload failed");
  }

  return result.secure_url;
};