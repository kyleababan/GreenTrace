export function getAuthErrorMessage(error, fallback) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-email": "Please enter your email address.",
    "auth/missing-password": "Please enter your password.",
    "auth/user-disabled": "This account has been disabled. Contact support.",
    "auth/user-not-found": "No GreenTrace account matches this email.",
    "auth/wrong-password": "Incorrect password. Try again or reset it.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-login-credentials": "Email or password is incorrect.",
    "auth/too-many-requests":
      "Too many attempts. Wait a moment, then try again.",
    "auth/network-request-failed":
      "Check your internet connection and try again.",
    "auth/email-already-in-use":
      "This email is already registered. Sign in instead.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "auth/operation-not-allowed": "Sign up is temporarily unavailable.",
    "auth/requires-recent-login": "Please sign in again to continue.",
  };

  return messages[code] || fallback || "Something went wrong. Please try again.";
}

export function getCreatePostErrorMessage(error) {
  const message = String(error?.message || "");

  if (/cloudinary/i.test(message) || /upload/i.test(message)) {
    return "Photo upload failed. Check your connection and try a smaller image.";
  }

  if (/permission/i.test(message) || /insufficient/i.test(message)) {
    return "You do not have permission to create this report. Sign in again.";
  }

  if (/network/i.test(message) || error?.code === "unavailable") {
    return "Check your internet connection and try again.";
  }

  return "Could not create the report. Please try again.";
}
