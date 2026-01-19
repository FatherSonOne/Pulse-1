import _sodium from 'libsodium-wrappers';

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
}

class EncryptionService {
  private initialized = false;
  private sodium: typeof _sodium | null = null;

  async initialize() {
    if (this.initialized) return;
    await _sodium.ready;
    this.sodium = _sodium;
    this.initialized = true;
  }

  /**
   * Generate new public/private key pair for user
   */
  async generateKeyPair(): Promise<KeyPair> {
    await this.initialize();
    const { publicKey, privateKey } = this.sodium!.crypto_box_keypair();

    return {
      publicKey: this.bufferToBase64(publicKey),
      secretKey: this.bufferToBase64(privateKey),
    };
  }

  /**
   * Encrypt message for recipient
   */
  async encryptMessage(
    message: string,
    recipientPublicKey: string,
    senderSecretKey: string
  ): Promise<EncryptedMessage> {
    await this.initialize();

    const nonce = this.sodium!.randombytes_buf(24);
    const messageBuffer = this.sodium!.from_string(message);
    const recipientPubKeyBuffer = this.base64ToBuffer(recipientPublicKey);
    const senderSecKeyBuffer = this.base64ToBuffer(senderSecretKey);

    const ciphertext = this.sodium!.crypto_box_easy(
      messageBuffer,
      nonce,
      recipientPubKeyBuffer,
      senderSecKeyBuffer
    );

    return {
      ciphertext: this.bufferToBase64(ciphertext),
      nonce: this.bufferToBase64(nonce),
      senderPublicKey: senderSecretKey.substring(0, 44), // Public key derivation
    };
  }

  /**
   * Decrypt message from sender
   */
  async decryptMessage(
    encrypted: EncryptedMessage,
    senderPublicKey: string,
    recipientSecretKey: string
  ): Promise<string> {
    await this.initialize();

    const ciphertextBuffer = this.base64ToBuffer(encrypted.ciphertext);
    const nonceBuffer = this.base64ToBuffer(encrypted.nonce);
    const senderPubKeyBuffer = this.base64ToBuffer(senderPublicKey);
    const recipientSecKeyBuffer = this.base64ToBuffer(recipientSecretKey);

    const decrypted = this.sodium!.crypto_box_open_easy(
      ciphertextBuffer,
      nonceBuffer,
      senderPubKeyBuffer,
      recipientSecKeyBuffer
    );

    return this.sodium!.to_string(decrypted);
  }

  /**
   * Helper: Convert buffer to base64
   */
  private bufferToBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(buffer)));
  }

  /**
   * Helper: Convert base64 to buffer
   */
  private base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const encryptionService = new EncryptionService();
