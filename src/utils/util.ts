export function toArray<T>(obj: T | T[]): T[] {
    if (obj instanceof Array) {
        return obj;
    } else {
        return [obj];
    }
}

export function inferFileExtension(content: string): string | null {
    const fileExtensionMapping = {
        'xml': /<\?xml.*\?>/i,
        'json': /^\s*\{.*\}\s*$/,
        'csv': /^.+$/
    };

    for (const [extension, pattern] of Object.entries(fileExtensionMapping)) {
        if (pattern.test(content)) {
            return extension;
        }
    }
    return null;
}

export function randomCharacters(length: number = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}
