export const calculateSubjectStats = (subject) => {
  const present = subject.history.filter(h => h.status === 'p').length;
  const total = subject.history.length;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 100);

  let actionText = "";
  let isCritical = false;
  let missing = 0;

  if (total === 0) {
    actionText = "No classes recorded.";
  } else if (percentage >= subject.target) {
    const missable = Math.floor((present - (subject.target / 100) * total) / (subject.target / 100));
    actionText = missable > 0 ? `Can miss ${missable} more classes.` : "On track. Don't miss next.";
  } else {
    isCritical = true;
    const needed = Math.ceil(((subject.target / 100) * total - present) / (1 - subject.target / 100));
    missing = needed;
    actionText = `Attend next ${needed} classes to reach ${subject.target}%.`;
  }

  return { present, total, percentage, actionText, isCritical, missing };
};