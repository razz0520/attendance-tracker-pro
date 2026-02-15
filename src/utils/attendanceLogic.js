export const calculateSubjectStats = (subject) => {
  // Step 1: Filter logs into specific categories
  const present = subject.history.filter(h => h.status === 'p').length;
  const absent = subject.history.filter(h => h.status === 'a').length;
  const holidays = subject.history.filter(h => h.status === 'holiday').length;

  // Step 2: The Data Science Edge - Define the "Effective Total"
  // We only count classes that actually happened (Present + Absent)
  const totalConducted = present + absent;
  
  // Step 3: Calculate Percentage based on conducted classes only
  const percentage = totalConducted === 0 ? 0 : Math.round((present / totalConducted) * 100);

  let actionText = "";
  let isCritical = false;
  let missing = 0;

  // Step 4: Logic for Actionable Advice
  if (totalConducted === 0) {
    actionText = holidays > 0 ? `${holidays} holiday(s) recorded. No classes yet.` : "No classes recorded.";
  } else if (percentage >= subject.target) {
    // Calculate how many more classes can be skipped without dropping below target
    const missable = Math.floor((present - (subject.target / 100) * totalConducted) / (subject.target / 100));
    actionText = missable > 0 ? `Can miss ${missable} more classes.` : "On track. Don't miss next.";
  } else {
    isCritical = true;
    // Calculate consecutive classes needed to recover to target
    const needed = Math.ceil(((subject.target / 100) * totalConducted - present) / (1 - subject.target / 100));
    missing = needed;
    actionText = `Attend next ${needed} classes to reach ${subject.target}%.`;
  }

  return { 
    present, 
    total: totalConducted, // This is the 'effective' total for the UI
    actualTotal: subject.history.length, // Total logs including holidays
    percentage, 
    actionText, 
    isCritical, 
    missing 
  };
};