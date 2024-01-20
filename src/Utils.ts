import crypto from 'crypto';

export function hashString(inputString: string): string {
    return crypto.createHash('sha1').update(inputString, 'utf-8').digest('hex');
}
