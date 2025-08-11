// convertParams.js
export function convertParams(list) {
  if (!Array.isArray(list)) return {};
  const toObject = (row) => {
    if (Array.isArray(row)) return convertParams(row);
    if (row && typeof row === 'object' && 'key' in row) return convertParams([row]);
    return row;
  };
  const out = {};
  for (const item of list) {
    if (!item || typeof item !== 'object' || !('key' in item)) continue;
    const { key, value, values, dataType } = item;
    const isList = (Array.isArray(values) && values.length > 0) || /^List/i.test(dataType || '');
    out[key] = isList ? (values || []).map(toObject) : value;
  }
  return out;
}
