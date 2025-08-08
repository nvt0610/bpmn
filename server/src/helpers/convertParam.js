// convertParams.js
export function convertParams(list) {
    if (!Array.isArray(list)) return {};

    const toObject = (row) => {
        if (Array.isArray(row)) return convertParams(row);
        if (row && typeof row === 'object' && 'key' in row) return convertParams([row]);
        return row; // primitive
    };

    const out = {};
    for (const item of list) {
        if (!item || !('key' in item)) continue;
        const { key, value, values } = item;

        // Nếu có values => coi như List / List<Object>
        if (Array.isArray(values)) {
            out[key] = values.map(toObject);
        } else {
            out[key] = value;
        }
    }
    return out;
}
