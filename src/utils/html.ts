
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
