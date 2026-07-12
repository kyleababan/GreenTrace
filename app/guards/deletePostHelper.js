import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
} from "firebase/firestore";

import { db } from "../../firebaseConfig";

export const deleteRelatedDocuments = async (postId) => {

    // Delete comments
    const commentsQuery = query(
        collection(db, "comments"),
        where("postId", "==", postId)
    );

    const commentsSnapshot = await getDocs(commentsQuery);

    for (const comment of commentsSnapshot.docs) {
        await deleteDoc(comment.ref);
    }

    // Delete volunteer activities
    const volunteerQuery = query(
        collection(db, "volunteer_posts"),
        where("postId", "==", postId)
    );

    const volunteerSnapshot = await getDocs(volunteerQuery);

    for (const volunteer of volunteerSnapshot.docs) {
        await deleteDoc(volunteer.ref);
    }

    // Delete reactions
    const reactionsQuery = query(
        collection(db, "post_reactions"),
        where("postId", "==", postId)
    );

    const reactionsSnapshot = await getDocs(reactionsQuery);

    for (const reaction of reactionsSnapshot.docs) {
        await deleteDoc(reaction.ref);
    }

    // Finally delete the post itself
    await deleteDoc(doc(db, "posts", postId));

};