export const BADGES = [
  { id: "first-report", icon: "🌱", title: "First Step", description: "Earned for your first cleaned report.", type: "reports", required: 1 },
  { id: "report-keeper", icon: "🌿", title: "Report Keeper", description: "Earned for 5 cleaned reports.", type: "reports", required: 5 },
  { id: "eco-guardian", icon: "🛡️", title: "Eco Guardian", description: "Earned for 10 cleaned reports.", type: "reports", required: 10 },
  { id: "volunteer-starter", icon: "🤝", title: "Volunteer Starter", description: "Earned for your first completed volunteer cleanup.", type: "volunteers", required: 1 },
  { id: "volunteer-helper", icon: "🏅", title: "Volunteer Helper", description: "Earned for 5 completed volunteer cleanups.", type: "volunteers", required: 5 },
  { id: "volunteer-champion", icon: "🏆", title: "Volunteer Champion", description: "Earned for 10 completed volunteer cleanups.", type: "volunteers", required: 10 },
  { id: "volunteer-legend", icon: "⭐", title: "Volunteer Legend", description: "Earned for 20 completed volunteer cleanups.", type: "volunteers", required: 20 },
];

export const getVolunteerId = (volunteer) =>
  typeof volunteer === "string"
    ? volunteer
    : volunteer?.userId || volunteer?.uid || volunteer?.id || null;

export const getUserContributionStats = (userId, posts, volunteerPosts) => ({
  cleanedReports: posts.filter(
    (post) => post.status === "cleaned" && post.userId === userId,
  ).length,
  volunteeredCount: volunteerPosts.filter(
    (activity) =>
      activity.status === "cleaned" &&
      (Array.isArray(activity.volunteers) ? activity.volunteers : []).some(
        (volunteer) => getVolunteerId(volunteer) === userId,
      ),
  ).length,
});

export const isBadgeEarned = (badge, stats) =>
  (badge.type === "reports" ? stats.cleanedReports : stats.volunteeredCount) >=
  badge.required;
