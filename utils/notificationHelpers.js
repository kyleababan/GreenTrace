import { collection, onSnapshot, query, where } from "firebase/firestore";

export function subscribeToUnreadNotifications(db, userId, onCount) {
  const notificationsQuery = query(
    collection(db, "notifications"),
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
