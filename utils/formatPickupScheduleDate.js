const getDateFromKey = (dateKey) => {
  if (typeof dateKey !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
    ? date
    : null;
};

export const hasUpcomingPickupDate = (operation, today = new Date()) => {
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    Array.isArray(operation.scheduledDateKeys) &&
    operation.scheduledDateKeys.some(
      (dateKey) => getDateFromKey(dateKey) && dateKey >= todayKey,
    )
  );
};

export const formatPickupScheduleDate = (operation) => {
  const scheduledDateKeys = Array.isArray(operation.scheduledDateKeys)
    ? [...operation.scheduledDateKeys].sort()
    : [];
  const firstDate = getDateFromKey(scheduledDateKeys[0]);

  if (!firstDate) return operation.schedule || "Pickup date not specified";

  if (operation.recurrence === "monthly") {
    const weekday = firstDate.toLocaleDateString(undefined, {
      weekday: "long",
    });
    const month = firstDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    return `Every ${weekday} in ${month}`;
  }

  return firstDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const getPickupRecurrenceLabel = (operation) => {
  if (operation.recurrence !== "monthly") return null;

  const scheduledDateKeys = Array.isArray(operation.scheduledDateKeys)
    ? [...operation.scheduledDateKeys].sort()
    : [];
  const firstDate = scheduledDateKeys
    .map(getDateFromKey)
    .find(Boolean);

  if (!firstDate) return null;

  const weekday = firstDate.toLocaleDateString(undefined, {
    weekday: "long",
  });
  return `Every ${weekday}`;
};
