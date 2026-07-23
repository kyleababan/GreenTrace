import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { db } from "../../../../firebaseConfig";
import { deleteRelatedDocuments } from "../../../guards/deletePostHelper";

export default function PostDetail({
  post: suppliedPost,
  currentTab,
  setSelectedPost,
  setSelectedVolunteerPost,
}) {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const [loadedPost, setLoadedPost] = useState(null);
  const [loadingPost, setLoadingPost] = useState(!suppliedPost);
  const [postLoadError, setPostLoadError] = useState("");
  const [existingVolunteerId, setExistingVolunteerId] = useState("");
  const post = suppliedPost || loadedPost;
  const effectiveCurrentTab = currentTab || post?.status;
  const isCleaned = effectiveCurrentTab === "cleaned";

  const [comments, setComments] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);

  const [showOtherModal, setShowOtherModal] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [selectedReason, setSelectedReason] = useState("");

  const [customReason, setCustomReason] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [openingVolunteerActivity, setOpeningVolunteerActivity] =
    useState(false);

  useEffect(() => {
    if (suppliedPost || !postId) return;

    const loadPost = async () => {
      try {
        const snapshot = await getDoc(doc(db, "posts", postId));
        if (!snapshot.exists()) {
          setPostLoadError("This report is no longer available.");
          return;
        }
        setLoadedPost({ id: snapshot.id, ...snapshot.data() });
      } catch (error) {
        console.error("Unable to load report:", error);
        setPostLoadError("Unable to load this report.");
      } finally {
        setLoadingPost(false);
      }
    };

    loadPost();
  }, [postId, suppliedPost]);

  const deleteReasons = [
    "Inappropriate Content",

    "Issue Already Resolved",

    "Duplicate Report",

    "Other Reason",
  ];

  useEffect(() => {
    if (!post?.id) return;

    const loadComments = async () => {
      const q = query(
        collection(db, "comments"),
        where("postId", "==", post.id),
      );

      const snapshot = await getDocs(q);

      setComments(
        snapshot.docs.map((comment) => ({
          id: comment.id,
          ...comment.data(),
        })),
      );
    };

    loadComments();
  }, [post?.id]);

  useEffect(() => {
    if (!post?.id) return;

    const checkVolunteerActivity = async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, "volunteer_posts"),
            where("postId", "==", post.id),
          ),
        );
        setExistingVolunteerId(snapshot.empty ? "" : snapshot.docs[0].id);
      } catch (error) {
        console.error("Unable to check volunteer activity:", error);
      }
    };

    checkVolunteerActivity();
  }, [post?.id]);

  const closePostDetail = () => {
    if (setSelectedPost) setSelectedPost(null);
    else router.back();
  };

  const markAsClean = async () => {
    if (updating) return;

    setUpdating(true);

    try {
      const volunteerSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", post.id),
        ),
      );

      const rewardsApplied = await runTransaction(db, async (transaction) => {
        const postRef = doc(db, "posts", post.id);
        const postSnapshot = await transaction.get(postRef);

        if (!postSnapshot.exists())
          throw new Error("This report no longer exists.");
        if (postSnapshot.data().status === "cleaned") return false;

        const volunteerDocuments = [];
        for (const volunteerDocument of volunteerSnapshot.docs) {
          const snapshot = await transaction.get(volunteerDocument.ref);
          if (snapshot.exists()) volunteerDocuments.push(snapshot);
        }

        const rewardsByUserId = new Map();
        const volunteerIds = new Set();
        const ownerId = postSnapshot.data().userId;
        if (ownerId) rewardsByUserId.set(ownerId, 5);

        volunteerDocuments.forEach((volunteerDocument) => {
          const volunteers = Array.isArray(volunteerDocument.data().volunteers)
            ? volunteerDocument.data().volunteers
            : [];

          volunteers.forEach((volunteer) => {
            const volunteerId =
              typeof volunteer === "string"
                ? volunteer
                : volunteer?.userId || volunteer?.uid || volunteer?.id;

            if (!volunteerId) return;
            volunteerIds.add(volunteerId);
          });
        });

        volunteerIds.forEach((volunteerId) => {
          rewardsByUserId.set(
            volunteerId,
            (rewardsByUserId.get(volunteerId) || 0) + 10,
          );
        });

        const userDocuments = [];
        for (const [userId, reward] of rewardsByUserId) {
          const userRef = doc(db, "users", userId);
          const userSnapshot = await transaction.get(userRef);
          if (userSnapshot.exists())
            userDocuments.push({ userRef, userSnapshot, reward });
        }

        transaction.update(postRef, { status: "cleaned" });
        volunteerDocuments.forEach((volunteerDocument) => {
          transaction.update(volunteerDocument.ref, { status: "cleaned" });
        });
        userDocuments.forEach(({ userRef, userSnapshot, reward }) => {
          transaction.update(userRef, {
            points: (Number(userSnapshot.data().points) || 0) + reward,
          });
        });

        return true;
      });

      if (!rewardsApplied) {
        alert("This post has already been marked as cleaned.");
        closePostDetail();
        return;
      }

      alert("Post marked as cleaned.");

      closePostDetail();
    } catch (error) {
      console.log(error);

      alert("Failed to update.");

      setUpdating(false);
    }
  };

  const openVolunteerActivity = async () => {
    if (openingVolunteerActivity || isCleaned) return;

    setOpeningVolunteerActivity(true);

    try {
      if (existingVolunteerId) {
        router.push({
          pathname: "/admin/assessments/post_view/VolunteerPostDetail",
          params: { volunteerId: existingVolunteerId },
        });
        return;
      }

      const volunteerSnapshot = await getDocs(
        query(
          collection(db, "volunteer_posts"),
          where("postId", "==", post.id),
        ),
      );

      if (!volunteerSnapshot.empty) {
        setExistingVolunteerId(volunteerSnapshot.docs[0].id);
        router.push({
          pathname: "/admin/assessments/post_view/VolunteerPostDetail",
          params: { volunteerId: volunteerSnapshot.docs[0].id },
        });
        return;
      }

      if (setSelectedVolunteerPost) setSelectedVolunteerPost(post);
    } catch (error) {
      console.error("Unable to open volunteer activity:", error);
      alert("Unable to check volunteer activities. Please try again.");
    } finally {
      setOpeningVolunteerActivity(false);
    }
  };

  const chooseReason = (reason) => {
    if (reason === "Other Reason") {
      setShowReasonModal(false);

      setShowOtherModal(true);

      return;
    }

    setSelectedReason(reason);

    setShowReasonModal(false);

    setShowConfirmModal(true);
  };

  const continueCustomReason = () => {
    if (customReason.trim() === "") {
      alert("Please enter a reason.");

      return;
    }

    setSelectedReason(customReason);

    setShowOtherModal(false);

    setShowConfirmModal(true);
  };

  const sendDeleteNotification = async () => {
    await addDoc(
      collection(db, "notifications"),

      {
        userId: post.userId,

        title: "Report Removed",

        message: `Your waste report was removed by the LGU.\n\nReason: ${selectedReason}`,

        type: "deleted_post",

        read: false,

        createdAt: serverTimestamp(),
      },
    );
  };

  const deletePost = async () => {
    if (deleting) return;

    setDeleting(true);

    try {
      // Notify the user first
      await sendDeleteNotification();

      // Delete the post and all related documents
      await deleteRelatedDocuments(post.id);

      alert("Report deleted successfully.");

      setShowConfirmModal(false);

      closePostDetail();
    } catch (error) {
      console.log(error);

      alert("Something went wrong.");

      setDeleting(false);
    }
  };

  const setToOngoing = async () => {
    if (updating) return;

    setUpdating(true);

    try {
      await updateDoc(doc(db, "posts", post.id), {
        status: "ongoing",
      });

      alert("Post has been set to On-going.");

      closePostDetail();
    } catch (error) {
      console.log(error);

      alert("Failed to update the post.");

      setUpdating(false);
    }
  };

  if (loadingPost) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#5F9C76" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.stateContainer}>
        <Text>{postLoadError || "Report not found."}</Text>
        <TouchableOpacity style={styles.helpBTN} onPress={() => router.back()}>
          <Text style={styles.helpText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={closePostDetail}>
          <Image
            source={require("../../../../assets/images/backG.png")}
            style={styles.profileImage}
          />
        </TouchableOpacity>

        <View
          style={{
            alignItems: "center",
            width: "96%",
            justifyContent: "space-between",
            flexDirection: "row",
          }}
        >
          <Text style={styles.title}>Post Details</Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#fff",
              padding: 12,
              borderRadius: 5,
            }}
            onPress={() => {
              setShowReasonModal(true);
            }}
          >
            <Text style={{ color: "#FF6666" }}>Delete Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN LAYOUT */}
      <View style={styles.mainContainer}>
        {/* LEFT - POST */}
        <View style={styles.left}>
          <View style={styles.card}>
            <Image source={{ uri: post.imageUrl }} style={styles.postImage} />

            <View style={styles.postInfo}>
              {/* PROFILE */}
              <View style={styles.row}>
                <Image
                  source={require("../../../../assets/images/ProfileIG.png")}
                  style={styles.profileImage}
                />
                <Text style={styles.profileName}>
                  {post.firstName} {post.lastName}
                </Text>
              </View>

              {/* DESCRIPTION */}
              <Text style={styles.description}>{post.caption}</Text>

              {/* REACTIONS */}
              <View style={styles.reactions}>
                <View style={styles.reactBox}>
                  <Image
                    source={require("../../../../assets/images/priorityreact.png")}
                    style={styles.smallIcon}
                  />
                  <Text style={styles.reactionCount}>
                    {post.reactionCount || 0}
                  </Text>
                </View>
                <View style={styles.commentBox}>
                  <Image
                    source={require("../../../../assets/images/comment.png")}
                    style={styles.smallIcon}
                  />
                  <Text style={styles.count}>{comments.length}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* RIGHT - COMMENTS + LOCATION */}
        <View style={styles.right}>
          {/* COMMENTS */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <Image
                      source={require("../../../../assets/images/ProfileIG.png")}
                      style={styles.profileImage}
                    />

                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={styles.userName}>
                          {comment.firstName} {comment.lastName}
                        </Text>

                        <Text
                          style={{
                            color: "#2C5FA5",
                            fontWeight: "bold",
                          }}
                        >
                          {comment.points} pts
                        </Text>
                      </View>

                      <Text style={styles.commentText}>{comment.comment}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text>No comments yet.</Text>
              )}
            </ScrollView>
          </View>

          {/* LOCATION */}
          <View style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.row}>
              <Image
                source={require("../../../../assets/images/location.png")}
                style={styles.icon}
              />
              <Text>{post.locationName}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* BUTTON */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          padding: 20,
          gap: 5,
        }}
      >
        <TouchableOpacity
          disabled={openingVolunteerActivity || isCleaned}
          style={[
            styles.helpBTN,
            {
              flex: 1,
              backgroundColor: isCleaned ? "#A5A5A5" : "#599A74",
            },
          ]}
          onPress={openVolunteerActivity}
        >
          <Text style={styles.helpText}>
            {isCleaned
              ? "Area is Cleaned"
              : openingVolunteerActivity
                ? "Loading..."
                : existingVolunteerId
                  ? "Manage Volunteers"
                  : "Help"}
          </Text>
        </TouchableOpacity>

        {!isCleaned && (
          <TouchableOpacity
            style={[
              styles.helpBTN,
              {
                backgroundColor:
                  effectiveCurrentTab === "ongoing" ? "#2DCC6F" : "#A5A5A5",
                flex: 1,
              },
            ]}
            onPress={
              effectiveCurrentTab === "ongoing" ? markAsClean : setToOngoing
            }
          >
            <Text style={styles.helpText}>
              {effectiveCurrentTab === "ongoing"
                ? "Mark as Clean"
                : "Set to On-Going"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showReasonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Report</Text>

            {deleteReasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonButton}
                onPress={() => chooseReason(reason)}
              >
                <Text>{reason}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setShowReasonModal(false)}>
              <Text style={{ color: "red" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showOtherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowOtherModal(false);
                  setShowReasonModal(true);
                }}
              >
                <Image
                  source={require("../../../../assets/images/backG.png")}
                  style={styles.modalBackIcon}
                />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Other Reason</Text>
            </View>

            <TextInput
              placeholder="Write reason..."
              multiline
              value={customReason}
              onChangeText={setCustomReason}
              style={styles.reasonInput}
            />

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={continueCustomReason}
            >
              <Text style={{ color: "#fff" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Report?</Text>

            <Text>Are you sure you want to delete this report?</Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text>No</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deleting}
                style={styles.confirmButton}
                onPress={deletePost}
              >
                <Text style={{ color: "#fff" }}>
                  {deleting ? "Deleting..." : "Yes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Keep your existing styles as-is
const styles = StyleSheet.create({
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  modalBackIcon: {
    width: 38,
    height: 38,
    marginRight: 10,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  modal: {
    width: 420,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },

  reasonButton: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },

  reasonInput: {
    height: 120,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    textAlignVertical: "top",
  },

  confirmButton: {
    backgroundColor: "#599A74",
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 25,
  },

  cancelButton: {
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 8,
    paddingHorizontal: 25,
  },
  commentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F4F4",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  screen: {
    flex: 1,
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#599A74",
    marginBottom: 10,
    alignContent: "center",
    justifyContent: "center",
  },
  mainContainer: {
    flexDirection: "row",
    flex: 1, // take full remaining vertical space
    gap: 20,
    marginBottom: 0,
  },
  left: {
    flex: 1,
  },

  right: {
    flex: 1,
    gap: 15,
    justifyContent: "space-between",
  },

  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
  },

  postImage: {
    width: "auto",
    height: "auto",
    aspectRatio: 16 / 9,
    borderRadius: 10,
    resizeMode: "cover",
  },

  postInfo: {
    flex: 1,
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  profileName: {
    marginLeft: 10,
    fontWeight: "bold",
  },
  profileIcon: {
    width: 40,
    height: 40,
    marginRight: 5,
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  locationText: {
    fontSize: 14,
  },
  description: {
    marginVertical: 10,
  },
  reactions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingTop: 10,
  },
  count: {
    fontWeight: "bold",
  },
  reactBox: {
    flexDirection: "row",
    alignItems: "center",
    width: "10%",
    justifyContent: "center",
    padding: 10,
  },
  commentBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E4E4E4",
    borderRadius: 5,
    width: "90%",
    justifyContent: "center",
    padding: 10,
  },
  smallIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 10,
  },
  commentSection: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontWeight: "bold",
    fontSize: 16,
  },
  locationSection: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
  },
  helpBTN: {
    backgroundColor: "#599A74",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  helpText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  commentText: {
    color: "#666",
    marginTop: 2,
  },
});
