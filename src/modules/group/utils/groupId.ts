// Utility for generating unique group IDs

/**
 * Generate a unique group ID with format: group-[initials+hash]-[DDMMYY]
 * Initials: first letter of each word in group name (lowercase)
 * Hash: 6 random lowercase letters/numbers
 * Date: DDMMYY
 */
export function generateGroupId(groupName?: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;

  // Get initials from group name
  let initials = '';
  if (groupName) {
    const words = groupName.trim().split(/\s+/);
    initials = words
      .map((w) => w[0])
      .join('')
      .toLowerCase();
  }

  // Generate random hash using lowercase letters and numbers
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 6; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${initials}${hash}${dateStr}`;
}
