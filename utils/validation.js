// NEW FILE: Utility to check for inappropriate content
export const containsRestrictedContent = (text) => {
  if (!text) return false;
  const badWords = ['abuse', 'scam', 'fraud', 'hate', 'stupid', 'idiot', 'sex', 'adult', 'kill']; // Add more as needed
  const lowerText = text.toLowerCase();
  return badWords.some(word => lowerText.includes(word));
};

export const validateInput = (text, fieldName) => {
  if (containsRestrictedContent(text)) {
    alert(`Inappropriate content detected in ${fieldName}. Please remove it.`);
    return false;
  }
  return true;
};