import crypto from 'node:crypto';
import { machineIdSync } from 'node-machine-id';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

// Application-specific salt for key derivation
const APP_SALT = 'jira-timetracker-oauth-v1';

let encryptionKey: Buffer | null = null;

/**
 * Derives an encryption key from machine-specific identifier.
 * This ensures tokens are only usable on the same machine.
 */
function getEncryptionKey(): Buffer {
    if (encryptionKey) {
        return encryptionKey;
    }

    try {
        // Get machine-specific ID
        const machineId = machineIdSync();

        // Derive a key using PBKDF2
        encryptionKey = crypto.pbkdf2Sync(
            machineId,
            APP_SALT,
            100000, // iterations
            KEY_LENGTH,
            'sha256'
        );

        return encryptionKey;
    } catch (error) {
        console.error('Failed to derive encryption key:', error);
        throw new Error('Failed to initialize encryption');
    }
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a string in format: base64(iv):base64(authTag):base64(encrypted)
 */
export function encrypt(plaintext: string): string {
    if (!plaintext) {
        return '';
    }

    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Combine IV, auth tag, and encrypted data
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypts ciphertext that was encrypted using encrypt().
 * Expects format: base64(iv):base64(authTag):base64(encrypted)
 */
export function decrypt(ciphertext: string): string {
    if (!ciphertext) {
        return '';
    }

    try {
        const parts = ciphertext.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid ciphertext format');
        }

        const [ivBase64, authTagBase64, encryptedBase64] = parts;

        const key = getEncryptionKey();
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        const encrypted = Buffer.from(encryptedBase64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Checks if a string appears to be encrypted (has the expected format).
 */
export function isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(':');
    return parts.length === 3;
}
