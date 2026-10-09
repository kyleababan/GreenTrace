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
      normalizedStatus !== "on-going"
    ) {
      return;
    }

    const statusLabel =
      normalizedStatus === "critical" ? "Critical" : "On-going";

    await addDoc(collection(db, "notifications"), {
      userId: targetPost.userId,
      type: "status_update",
      title: "Report Status Updated",
      message: `Your report status was updated to ${statusLabel}.`,
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

    await addDoc(collection(db, "notifications"), {
      userId: targetPost.userId,
      type: "deleted_post",
      title: "Report Removed",
      message: `Your waste report was removed by the LGU.${reason ? `\n\nReason: ${reason}` : ""}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to send moderation notification:", error);
  }
}
