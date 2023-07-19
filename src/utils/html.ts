
export function decodeHtmlCode(str: string) {
    return str.replace(/(&#(\d+);)/g, function (match, capture, charCode) {
        return String.fromCharCode(charCode);
    });
}

export function mapToUrlParams(data: Map<string, string>): string {
    const params = [];
    for (const [key, value] of data.entries()) {
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(value);
        params.push(`${encodedKey}=${encodedValue}`);
    }
    return params.join('&');
}

export function escapeAttribute(value: string): string {
    return value.replace(/"/g, '&quot;');
}

export function getNonce() {
    let text = '';
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
