import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export const POSTS_PER_PAGE = 10;
export const COMMENTS_PER_PAGE = 10;

export async function getUserPointsMap(db, userIds) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  const pointsMap = {};

  for (let index = 0; index < uniqueIds.length; index += 10) {
    const chunk = uniqueIds.slice(index, index + 10);
    const snapshot = await getDocs(
      query(collection(db, "users"), where(documentId(), "in", chunk)),
    );

    snapshot.forEach((userDocument) => {
      pointsMap[userDocument.id] = userDocument.data().points ?? 0;
    });
  }

  return pointsMap;
}

export function mergeUniqueById(currentItems, incomingItems) {
  const currentIds = new Set(currentItems.map((item) => item.id));
  return [
    ...currentItems,
    ...incomingItems.filter((item) => !currentIds.has(item.id)),
  ];
}
