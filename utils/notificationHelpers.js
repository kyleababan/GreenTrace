import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export function subscribeToUnreadNotifications(database, userId, onCount) {
  const notificationsQuery = query(
    collection(database || db, "notifications"),
    where("userId", "==", userId),
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const unreadCount = snapshot.docs.filter(
        (notification) => notification.data().read !== true,
      ).length;
      onCount(unreadCount);
    },
    (error) => {
      console.error("Unable to listen for unread notifications:", error);
    },
  );
}

/**
 * Checks if push notifications are enabled in admin settings (defaults to true).
 */
export async function isPushNotificationEnabled() {
  try {
    const configSnap = await getDoc(doc(db, "settings", "appConfig"));
    if (configSnap.exists()) {
      const data = configSnap.data();
      if (typeof data.pushNotificationsEnabled === "boolean") {
        return data.pushNotificationsEnabled;
      }
    }
    return true;
  } catch (error) {
    console.warn("Unable to check push notification config:", error);
    return true;
  }
}

/**
 * Notify all registered residents when a community activity/volunteer event is created.
 */
export async function notifyAllResidentsOnActivityCreated({
  activityId,
  title,
  meetingDate,
  meetingTime,
  imageUrl,
}) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const usersSnap = await getDocs(collection(db, "users"));
    const residents = usersSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return data.role !== "admin";
    });

    if (residents.length === 0) return;

    const activityTitle = title || "Community Activity";
    const dateStr = meetingDate
      ? meetingTime
        ? `${meetingDate} at ${meetingTime}`
        : meetingDate
      : "an upcoming date";

    for (let i = 0; i < residents.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = residents.slice(i, i + 450);

      chunk.forEach((residentDoc) => {
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: residentDoc.id,
          type: "activity_created",
          title: "New Community Activity",
          message: `New activity "${activityTitle}" scheduled for ${dateStr}. Tap to view!`,
          volunteerPostId: activityId,
          postImage: imageUrl || null,
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }
  } catch (error) {
    console.error("Unable to send activity notifications to residents:", error);
  }
}

/**
 * Notify post owner when post status changes to critical or ongoing.
 */
export async function notifyPostStatusUpdated({ post, postId, newStatus }) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    let targetPost = post;
    const targetPostId = postId || post?.id;

    if (!targetPost?.userId && targetPostId) {
      const snap = await getDoc(doc(db, "posts", targetPostId));
      if (snap.exists()) {
        targetPost = { id: snap.id, ...snap.data() };
      }
    }

    if (!targetPost?.userId) return;

    const normalizedStatus = String(newStatus || "").toLowerCase();
    if (
      normalizedStatus !== "critical" &&
      normalizedStatus !== "ongoing" &&
      normalizedStatus !== "on-going" &&
      normalizedStatus !== "moderate"
    ) {
      return;
    }

    let statusLabel = "Moderate";
    let message = "Your waste report status was updated to Moderate.";

    if (normalizedStatus === "critical") {
      statusLabel = "Critical";
      message = "Your waste report status was updated to Critical by MENRO.";
    } else if (
      normalizedStatus === "ongoing" ||
      normalizedStatus === "on-going"
    ) {
      statusLabel = "On-going";
      message =
        "Your waste report status was updated to On-going. A clean-up operation is in progress!";
    }

    await addDoc(collection(db, "notifications"), {
      userId: targetPost.userId,
      type: "status_update",
      title: `Report Status: ${statusLabel}`,
      message,
      postId: targetPost.id,
      postImage: targetPost.imageUrl || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send post status notification:", error);
  }
}

/**
 * Notify post owner when their post is moderated / removed.
 */
export async function notifyPostModerated({ post, postId, reason }) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    let targetPost = post;
    const targetPostId = postId || post?.id;

    if (!targetPost?.userId && targetPostId) {
      const snap = await getDoc(doc(db, "posts", targetPostId));
      if (snap.exists()) {
        targetPost = { id: snap.id, ...snap.data() };
      }
    }

    if (!targetPost?.userId) return;

    const cleanReason = reason ? reason.trim() : "";
    const message = cleanReason
      ? `Your waste report was removed by the LGU. Reason: ${cleanReason}`
      : "Your waste report was removed by the LGU.";

    await addDoc(collection(db, "notifications"), {
      userId: targetPost.userId,
      type: "deleted_post",
      title: "Report Removed",
      message,
      reason: cleanReason,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send moderation notification:", error);
  }
}

/**
 * Notify a user when their comment has been removed by the LGU administrator.
 */
export async function notifyCommentModerated({
  userId,
  postTitle = "Waste Report",
  reason = "",
  postId = null,
}) {
  try {
    if (!userId) return;
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const cleanReason = reason ? reason.trim() : "";
    const message = cleanReason
      ? `Your comment on "${postTitle}" was removed by the LGU. Reason: ${cleanReason}`
      : `Your comment on "${postTitle}" was removed by the LGU.`;

    await addDoc(collection(db, "notifications"), {
      userId,
      type: "deleted_comment",
      title: "Comment Removed",
      message,
      reason: cleanReason,
      postId: postId || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send comment moderation notification:", error);
  }
}

/**
 * Notify all registered volunteers and owner that clean-up operation has started.
 */
export async function notifyVolunteersOnActivityStarted({
  activityId,
  title,
  volunteers = [],
  ownerId = null,
  imageUrl = null,
}) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const userIds = new Set();
    if (ownerId) userIds.add(ownerId);
    (Array.isArray(volunteers) ? volunteers : []).forEach((v) => {
      const uid = typeof v === "string" ? v : v?.userId || v?.uid || v?.id;
      if (uid) userIds.add(uid);
    });

    if (userIds.size === 0) return;

    const batch = writeBatch(db);
    userIds.forEach((userId) => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId,
        type: "activity_started",
        title: "Clean-up Operation Started!",
        message: `The clean-up operation for "${title || "Community Activity"}" has officially started! Please proceed to the assembly location.`,
        volunteerPostId: activityId,
        postImage: imageUrl || null,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Unable to send activity started notifications:", error);
  }
}

/**
 * Notify all registered volunteers and owner that an event in progress was cancelled.
 */
export async function notifyVolunteersOnActivityCancelled({
  activityId,
  title,
  reason = "",
  volunteers = [],
  ownerId = null,
  imageUrl = null,
}) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const userIds = new Set();
    if (ownerId) userIds.add(ownerId);
    (Array.isArray(volunteers) ? volunteers : []).forEach((v) => {
      const uid = typeof v === "string" ? v : v?.userId || v?.uid || v?.id;
      if (uid) userIds.add(uid);
    });

    if (userIds.size === 0) return;

    const batch = writeBatch(db);
    userIds.forEach((userId) => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId,
        type: "activity_cancelled",
        title: "Event Cancelled",
        message: `The clean-up activity "${title || "Community Activity"}" was cancelled by the LGU.${reason ? `\n\nReason: ${reason}` : ""}`,
        volunteerPostId: activityId,
        postImage: imageUrl || null,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Unable to send activity cancelled notifications:", error);
  }
}

/**
 * Notify all registered volunteers and owner that an activity in progress was reverted to open registration.
 */
export async function notifyVolunteersOnActivityRevertedToOpen({
  activityId,
  title,
  reason = "",
  volunteers = [],
  ownerId = null,
  imageUrl = null,
}) {
  try {
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const userIds = new Set();
    if (ownerId) userIds.add(ownerId);
    (Array.isArray(volunteers) ? volunteers : []).forEach((v) => {
      const uid = typeof v === "string" ? v : v?.userId || v?.uid || v?.id;
      if (uid) userIds.add(uid);
    });

    if (userIds.size === 0) return;

    const batch = writeBatch(db);
    userIds.forEach((userId) => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId,
        type: "activity_reverted",
        title: "Clean-up Schedule Updated",
        message: `The clean-up activity "${title || "Community Activity"}" was paused and reverted to open registration.${reason ? `\n\nNotice: ${reason}` : " Please check the activity page for the updated schedule."}`,
        volunteerPostId: activityId,
        postImage: imageUrl || null,
        read: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Unable to send activity reverted notifications:", error);
  }
}

/**
 * Notify a user that EcoPoints have been credited to their account.
 */
export async function notifyUserEcoPointsAwarded({
  userId,
  amount,
  source = "cleanup_reward",
  title = null,
  postId = null,
  volunteerPostId = null,
}) {
  try {
    if (!userId || !amount) return;
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const notifTitle = "EcoPoints Awarded!";
    const notifMessage =
      source === "volunteer_event_reward"
        ? `You received +${amount} EcoPoints for participating in "${title || "Community Event"}"!`
        : source === "linked_cleanup_reward"
          ? `You received +${amount} EcoPoints for your linked vicinity waste report!`
          : `You received +${amount} EcoPoints for your cleaned waste report!`;

    await addDoc(collection(db, "notifications"), {
      userId,
      type: "points_reward",
      title: notifTitle,
      message: notifMessage,
      pointsAmount: Number(amount),
      postId: postId || null,
      volunteerPostId: volunteerPostId || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send points reward notification:", error);
  }
}

/**
 * Notify a user when they receive an official account warning or policy strike.
 */
export async function notifyUserAccountWarning({
  userId,
  warningNumber = 1,
  maxWarnings = 3,
  reason = "Uploaded inappropriate or off-topic content.",
}) {
  try {
    if (!userId) return;
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    await addDoc(collection(db, "notifications"), {
      userId,
      type: "account_warning",
      title: `Account Warning (${warningNumber}/${maxWarnings})`,
      message: `You received Warning ${warningNumber} of ${maxWarnings}. Reason: ${reason}. Please follow Community Guidelines to avoid being banned.`,
      warningNumber,
      maxWarnings,
      reason,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send account warning notification:", error);
  }
}

/**
 * Notify all registered residents with an official LGU municipal announcement.
 */
export async function notifyAllResidentsAnnouncement({
  title,
  message,
  urgent = false,
}) {
  try {
    if (!title || !message) return;
    const enabled = await isPushNotificationEnabled();
    if (!enabled) return;

    const usersSnap = await getDocs(collection(db, "users"));
    const residents = usersSnap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return data.role !== "admin";
    });

    if (residents.length === 0) return;

    for (let i = 0; i < residents.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = residents.slice(i, i + 450);

      chunk.forEach((residentDoc) => {
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: residentDoc.id,
          type: "announcement",
          title: title || "LGU Announcement",
          message,
          urgent: Boolean(urgent),
          read: false,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }
  } catch (error) {
    console.error("Unable to send announcement notifications:", error);
  }
}
