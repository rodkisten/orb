import sodium from "libsodium-wrappers";

/** Encrypt a secret using the GitHub Actions public key. Never log inputs. */
export async function sealGitHubSecret(publicKey: string, value: string): Promise<string> {
  await sodium.ready;
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  if (key.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new Error("Invalid GitHub public key");
  }
  const plaintext = sodium.from_string(value);
  try {
    const ciphertext = sodium.crypto_box_seal(plaintext, key);
    return sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL);
  } finally {
    sodium.memzero(plaintext);
  }
}
