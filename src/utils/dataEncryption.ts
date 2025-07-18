import { logger } from '../services/logger';

export interface EncryptionResult {
  data: string; // Base64 encoded encrypted data
  salt: string; // Base64 encoded salt
  iv: string; // Base64 encoded initialization vector
}

export interface DecryptionOptions {
  data: string;
  salt: string;
  iv: string;
  password: string;
}

/**
 * Data encryption utilities using Web Crypto API for secure backup/restore
 */
export class DataEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for AES-GCM
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly ITERATIONS = 100000; // PBKDF2 iterations

  /**
   * Derives a cryptographic key from a password using PBKDF2
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    try {
      // Import the password as a key for PBKDF2
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
      );

      // Derive the actual encryption key
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: this.ALGORITHM, length: this.KEY_LENGTH },
        false,
        ['encrypt', 'decrypt'],
      );
    } catch (error) {
      logger.error('Error deriving encryption key:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypts data using AES-GCM with password-based key derivation
   */
  static async encrypt(data: string, password: string): Promise<EncryptionResult> {
    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive encryption key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt the data
      const encodedData = new TextEncoder().encode(data);
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encodedData,
      );

      // Convert to base64 for storage
      return {
        data: this.arrayBufferToBase64(encryptedData as ArrayBuffer),
        salt: this.arrayBufferToBase64(salt as ArrayBuffer),
        iv: this.arrayBufferToBase64(iv),
      };
    } catch (error) {
      logger.error('Error encrypting data:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts data using AES-GCM with password-based key derivation
   */
  static async decrypt(options: DecryptionOptions): Promise<string> {
    try {
      // Convert base64 back to ArrayBuffer
      const encryptedData = this.base64ToArrayBuffer(options.data);
      const salt = this.base64ToArrayBuffer(options.salt);
      const iv = this.base64ToArrayBuffer(options.iv);

      // Derive decryption key from password
      const key = await this.deriveKey(options.password, new Uint8Array(salt));

      // Decrypt the data
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: new Uint8Array(iv),
        },
        key,
        encryptedData,
      );

      // Convert back to string
      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      logger.error('Error decrypting data:', error);
      throw new Error('Failed to decrypt data - incorrect password or corrupted data');
    }
  }

  /**
   * Validates if the provided data appears to be encrypted in the expected format
   */
  static validateEncryptedData(encryptedData: unknown): boolean {
    try {
      return (
        encryptedData &&
        typeof encryptedData === 'object' &&
        typeof encryptedData.data === 'string' &&
        typeof encryptedData.salt === 'string' &&
        typeof encryptedData.iv === 'string' &&
        encryptedData.data.length > 0 &&
        encryptedData.salt.length > 0 &&
        encryptedData.iv.length > 0
      );
    } catch (error) {
      logger.error('Error validating encrypted data:', error);
      return false;
    }
  }

  /**
   * Generates a cryptographically secure password suggestion
   */
  static generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    return Array.from(array, (byte) => charset[byte % charset.length]).join('');
  }

  /**
   * Estimates encryption strength based on password characteristics
   */
  static estimatePasswordStrength(password: string): {
    score: number; // 0-100
    level: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    suggestions: string[];
  } {
    let score = 0;
    const suggestions: string[] = [];

    // Length scoring
    if (password.length >= 12) score += 25;
    else if (password.length >= 8) score += 15;
    else suggestions.push('Use at least 12 characters');

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 15;
    else suggestions.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 15;
    else suggestions.push('Include uppercase letters');

    if (/[0-9]/.test(password)) score += 15;
    else suggestions.push('Include numbers');

    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 20;
    else suggestions.push('Include special characters');

    // Deduct points for common patterns
    if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
    if (/123|abc|password|qwerty/i.test(password)) score -= 20; // Common patterns

    // Bonus for length
    if (password.length >= 16) score += 10;

    let level: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    if (score >= 80) level = 'very-strong';
    else if (score >= 60) level = 'strong';
    else if (score >= 40) level = 'good';
    else if (score >= 20) level = 'fair';
    else level = 'weak';

    return {
      score: Math.max(0, Math.min(100, score)),
      level,
      suggestions,
    };
  }

  /**
   * Creates a hash of data for integrity verification
   */
  static async createDataHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      return this.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      logger.error('Error creating data hash:', error);
      throw new Error('Failed to create data hash');
    }
  }

  /**
   * Verifies data integrity using a hash
   */
  static async verifyDataHash(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.createDataHash(data);
      return actualHash === expectedHash;
    } catch (error) {
      logger.error('Error verifying data hash:', error);
      return false;
    }
  }

  /**
   * Utility method to convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility method to convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Convenience functions for common encryption operations
 */
export const encrypt = DataEncryption.encrypt;
export const decrypt = DataEncryption.decrypt;
export const validateEncryptedData = DataEncryption.validateEncryptedData;
export const generateSecurePassword = DataEncryption.generateSecurePassword;
export const estimatePasswordStrength = DataEncryption.estimatePasswordStrength;
export const createDataHash = DataEncryption.createDataHash;
export const verifyDataHash = DataEncryption.verifyDataHash;
