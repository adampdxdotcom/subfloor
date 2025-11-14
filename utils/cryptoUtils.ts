import md5 from 'md5';

/**
 * Hashes an email address for use with Gravatar using a reliable library.
 * @param email The email address to hash.
 * @returns The hex-encoded MD5 hash as a string.
 */
export function createGravatarHash(email: string): string {
  // Gravatar hashes are based on the trimmed, lowercase version of the email.
  const cleanedEmail = email.trim().toLowerCase();
  
  // Use the md5 library to generate the hash. It's synchronous and works everywhere.
  const hash = md5(cleanedEmail);
  
  return hash;
}