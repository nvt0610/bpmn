// src/utils/format-mapper.js
// Quy ước:
// - formatData: lá là { dataType, (value?) } — nếu từ config có value thì giữ trong key "value".
// - formatParam: lá là giá trị đã ép kiểu.
// - So khớp theo workflowId + nodeId (config: ConfigurationData -> WorkflowNode -> Workflow, param: TestCaseNode -> TestCase -> Workflow)

const isNil = v => v === null || v === undefined;
const isEmptyStr = v => typeof v === 'string' && v.trim() === '';
const isPlainObject = v => v && typeof v === 'object' && !Array.isArray(v);
const hasKeys = o => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length > 0;

const NUMERIC_RE = /^-?\d+$/;
const FLOAT_RE = /^-?\d+(\.\d+)?$/;

const guessType = (raw) => {
  if (raw === 'true' || raw === true) return 'Boolean';
  if (raw === 'false' || raw === false) return 'Boolean';
  if (typeof raw === 'number') return Number.isInteger(raw) ? 'Int' : 'Float';
  if (typeof raw === 'boolean') return 'Boolean';
  if (typeof raw === 'string') {
    if (NUMERIC_RE.test(raw)) return 'Int';
    if (FLOAT_RE.test(raw)) return 'Float';
    return 'String';
  }
  if (Array.isArray(raw)) return 'List';
  if (raw && typeof raw === 'object') return 'Object';
  return 'String';
};

const coerceByType = (dataType, raw) => {
  if (isNil(raw)) {
    // String null -> "", số/bool null -> null
    if (dataType === 'String') return '';
    return null;
  }
  switch (dataType) {
    case 'Int': return typeof raw === 'number' ? Math.trunc(raw) : (NUMERIC_RE.test(String(raw)) ? parseInt(raw, 10) : null);
    case 'Float': return typeof raw === 'number' ? raw : (FLOAT_RE.test(String(raw)) ? parseFloat(raw) : null);
    case 'Boolean': {
      if (typeof raw === 'boolean') return raw;
      const s = String(raw).toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      return null;
    }
    case 'String': return String(raw ?? '');
    default: return raw; // Object/List giữ nguyên, sẽ xử lý đệ quy bên ngoài
  }
};

const hasSpec = (fd) => !!fd && (hasKeys(fd.headers) || hasKeys(fd.queryParams) || hasKeys(fd.body));

// Loose coercion khi không có spec
const coerceLoose = (node) => {
  if (Array.isArray(node)) return node.map(coerceLoose);
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = coerceLoose(node[k]);
    return out;
  }
  const t = guessType(node);
  return coerceByType(t, node);
};

/**
 * Chuẩn hoá mảng param entries theo đúng logic SQL JSONB:
 * - Nếu có 'value'  -> lấy thẳng value
 * - Nếu có 'values' -> duyệt từng phần tử:
 *    + phần tử là mảng [ {key,value}, ... ] -> object { key: value, ... }
 *    + phần tử là object {key,value}       -> object { [key]: value }
 *    + phần tử kiểu khác                   -> giữ nguyên
 * - Nếu không có 'value'/'values' -> null
 */
function normalizeParamEntries(paramEntries) {
  if (!Array.isArray(paramEntries)) return isPlainObject(paramEntries) ? paramEntries : {};
  const out = {};
  for (const p of paramEntries) {
    const k = p?.key;
    if (!k) continue;

    if ('value' in p) {
      out[k] = p.value;
      continue;
    }
    if (Array.isArray(p.values)) {
      out[k] = p.values.map((v) => {
        if (Array.isArray(v)) {
          // v: [{key,value},...]
          return v.reduce((acc, x) => {
            const kk = x?.key;
            if (kk) acc[kk] = x?.value;
            return acc;
          }, {});
        }
        if (isPlainObject(v) && 'key' in v) {
          return { [v.key]: v.value };
        }
        return v;
      });
      continue;
    }
    out[k] = null;
  }
  return out;
}

// Trích request đầu tiên theo cấu trúc normalizeStep
function pickFirstReq(rawInput) {
  if (Array.isArray(rawInput)) {
    const step = rawInput[0];
    const ip = step?.inputParam?.[0];
    if (!ip) return null;
    const method = ip.method || 'GET';
    const params = Array.isArray(ip.params) ? normalizeParamEntries(ip.params)
      : (ip.params || {});
    return { method, params, step, ip };
  }
  // formatInput kiểu object
  if (isPlainObject(rawInput)) {
    return {
      method: rawInput.method || 'GET',
      params: isPlainObject(rawInput.params) ? rawInput.params : {},
      ip: rawInput
    };
  }
  return null;
}

// key-value array -> object (formatData hoặc formatParam)
const kvArrayToObj = (arr, mode = 'data') => {
  // arr: [{ key, value, dataType }]
  const out = {};
  for (const item of arr || []) {
    const k = item.key;
    if (!k) continue;
    if (mode === 'data') {
      // giữ dataType; nếu value có và không rỗng -> gắn vào "value"; rỗng -> bỏ
      const dt = item.dataType || guessType(item.value);
      const hasVal = !isNil(item.value) && !isEmptyStr(String(item.value));
      out[k] = hasVal ? { dataType: dt, value: item.value } : { dataType: dt };
    } else {
      // param: chỉ giữ giá trị (chưa ép kiểu — sẽ ép theo formatData sau)
      out[k] = isNil(item.value) ? '' : item.value;
    }
  }
  return out;
};

// body từ mảng key-value (hỗ trợ List<Object> với "values")
const bodyArrayToDataShape = (arr) => {
  const out = {};
  for (const f of arr || []) {
    const k = f.key;
    if (!k) continue;
    if (Array.isArray(f.values)) {
      // List<Object>: lấy shape từ phần tử đầu tiên (sau khi normalize)
      const first = f.values[0] || [];
      let obj = {};
      if (Array.isArray(first)) {
        for (const leaf of first) {
          const dt = leaf.dataType || guessType(leaf.value);
          const hasVal = !isNil(leaf.value) && !isEmptyStr(String(leaf.value));
          obj[leaf.key] = hasVal ? { dataType: dt, value: leaf.value } : { dataType: dt };
        }
      } else if (isPlainObject(first) && 'key' in first) {
        const dt = first.dataType || guessType(first.value);
        const hasVal = !isNil(first.value) && !isEmptyStr(String(first.value));
        obj = { [first.key]: hasVal ? { dataType: dt, value: first.value } : { dataType: dt } };
      } else if (isPlainObject(first)) {
        // nếu đã là object { a:1, b:2 } (ít gặp) -> suy kiểu từng field
        obj = Object.keys(first).reduce((acc, kk) => {
          const val = first[kk];
          const dt = guessType(val);
          const hasVal = !isNil(val) && !isEmptyStr(String(val));
          acc[kk] = hasVal ? { dataType: dt, value: val } : { dataType: dt };
          return acc;
        }, {});
      }
      out[k] = [obj];
    } else {
      const dt = f.dataType || guessType(f.value);
      const hasVal = !isNil(f.value) && !isEmptyStr(String(f.value));
      out[k] = hasVal ? { dataType: dt, value: f.value } : { dataType: dt };
    }
  }
  return out;
};

const bodyArrayToParam = (arr) => {
  const out = {};
  for (const f of arr || []) {
    const k = f.key;
    if (!k) continue;
    if (Array.isArray(f.values)) {
      // list các object [{key,value},...] -> [{...}]
      out[k] = f.values.map(row => {
        if (Array.isArray(row)) {
          const obj = {};
          for (const leaf of row) obj[leaf.key] = isNil(leaf.value) ? '' : leaf.value;
          return obj;
        }
        if (isPlainObject(row) && 'key' in row) {
          return { [row.key]: isNil(row.value) ? '' : row.value };
        }
        return row;
      });
    } else {
      out[k] = isNil(f.value) ? '' : f.value;
    }
  }
  return out;
};

// áp kiểu cho param theo formatData
const coerceParamWithFormat = (paramNode, dataNode) => {
  if (Array.isArray(dataNode)) {
    // kỳ vọng mảng object theo shape phần tử đầu
    const shape = dataNode[0];
    if (!Array.isArray(paramNode)) return [];
    return paramNode.map(item => coerceParamWithFormat(item, shape));
  }
  if (dataNode && typeof dataNode === 'object' && !('dataType' in dataNode)) {
    // object
    const out = {};
    for (const key of Object.keys(dataNode)) {
      out[key] = coerceParamWithFormat(paramNode?.[key], dataNode[key]);
    }
    return out;
  }
  if (dataNode && typeof dataNode === 'object' && 'dataType' in dataNode) {
    // lá
    const dt = dataNode.dataType || guessType(paramNode);
    const val = !isNil(paramNode) && !(typeof paramNode === 'string' && paramNode.trim() === '')
      ? paramNode
      : dataNode.value; // fallback sang default trong formatData nếu có
    return coerceByType(dt, val);
  }
  // fallback
  return paramNode;
};

// tìm field thừa so với formatData (trả về danh sách path)
const diffExtraFields = (paramNode, dataNode, path = []) => {
  const extras = [];
  if (Array.isArray(paramNode) && Array.isArray(dataNode)) {
    const shape = dataNode[0] ?? {};
    paramNode.forEach((item, idx) => extras.push(...diffExtraFields(item, shape, [...path, idx])));
    return extras;
  }
  if (paramNode && typeof paramNode === 'object' && !Array.isArray(paramNode)) {
    const allowed = new Set();
    if (Array.isArray(dataNode)) {
      Object.keys(dataNode[0] || {}).forEach(k => allowed.add(k));
    } else if (dataNode && typeof dataNode === 'object' && !('dataType' in dataNode)) {
      Object.keys(dataNode).forEach(k => allowed.add(k));
    } else {
      // dataNode là lá -> paramNode không nên là object
      return [`${path.join('.')}`];
    }
    for (const key of Object.keys(paramNode)) {
      if (!allowed.has(key)) extras.push(`${[...path, key].join('.')}`);
      else extras.push(...diffExtraFields(paramNode[key], Array.isArray(dataNode) ? dataNode[0] : dataNode[key], [...path, key]));
    }
    return extras;
  }
  return extras;
};

// ===== Public mappers =====

// 1) From ConfigurationData.data -> formatData
export function buildFormatDataFromConfigData(raw) {
  // Giả định lấy steps[0].apis[0]; nếu nhiều, truyền thêm index ở service (tuỳ bạn mở rộng sau)
  const step = raw?.steps?.[0];
  const api = step?.apis?.[0];
  if (!api) return null;

  const headers = kvArrayToObj(api.headers || [], 'data');
  const queryParams = kvArrayToObj(api.queryParams || [], 'data');
  const body = bodyArrayToDataShape(api.body || []);

  return {
    domain: api.domain,
    path: api.path,
    method: api.method,
    headers,
    queryParams,
    body,
    expectedResponse: api.expectedResponse || {}
  };
}

// 2) From TestCaseNode.inputParam (+ merged by workflowId/nodeId) -> formatParam
// - Chuẩn hoá params như SQL JSONB (normalizeParamEntries)
// - Route key vào headers/query/body dựa trên spec nếu có; fallback theo method
export function buildFormatParamFromInputParam(rawInput, formatData, opts = { strict: false }) {
  let headers = {};
  let queryParams = {};
  let body = {};

  const first = pickFirstReq(rawInput);
  const method = first?.method || formatData?.method || 'GET';
  const normParams = first?.params || {};

  const specHas = hasSpec(formatData);
  const headerSpecKeys = hasKeys(formatData?.headers) ? new Set(Object.keys(formatData.headers)) : new Set();
  const querySpecKeys = hasKeys(formatData?.queryParams) ? new Set(Object.keys(formatData.queryParams)) : new Set();
  const bodySpecKeys = hasKeys(formatData?.body) ? new Set(Object.keys(formatData.body)) : new Set();

  const knownHeaderKeys = new Set(['Authorization', 'Content-Type', 'Accept', 'User-Agent']);

  if (first) {
    for (const k of Object.keys(normParams)) {
      const val = normParams[k];

      // Ưu tiên header theo spec hoặc known header
      if (headerSpecKeys.has(k) || knownHeaderKeys.has(k)) {
        headers[k] = isNil(val) ? '' : val;
        continue;
      }

      // Theo spec: body / query
      if (specHas) {
        if (bodySpecKeys.has(k)) {
          body[k] = isNil(val) ? '' : val;
          continue;
        }
        if (querySpecKeys.has(k)) {
          queryParams[k] = isNil(val) ? '' : val;
          continue;
        }
        // Không nằm trong spec -> fallback: GET/DELETE -> query, còn lại -> body
        if (['GET', 'DELETE'].includes(String(method).toUpperCase())) {
          queryParams[k] = isNil(val) ? '' : val;
        } else {
          body[k] = isNil(val) ? '' : val;
        }
      } else {
        // Không có spec -> giữ nguyên heuristic: GET -> query, khác -> body
        if (['GET', 'DELETE'].includes(String(method).toUpperCase())) {
          queryParams[k] = isNil(val) ? '' : val;
        } else {
          body[k] = isNil(val) ? '' : val;
        }
      }
    }

    // nếu có rawInput[0].body thì merge thêm (ít gặp)
    if (Array.isArray(rawInput) && rawInput[0]?.body) {
      body = { ...body, ...bodyArrayToParam(rawInput[0].body) };
    }
  } else if (isPlainObject(rawInput)) {
    // formatInput dạng object
    headers = { ...headers, ...(rawInput.headers || {}) };
    queryParams = { ...queryParams, ...(rawInput.queryParams || {}) };
    body = { ...body, ...(rawInput.body || {}) };
  }

  const merged = {
    domain: rawInput?.domain ?? formatData?.domain ?? '',
    path: rawInput?.path ?? formatData?.path ?? '',
    method: method,
    headers,
    queryParams,
    body,
    expectedResponse: rawInput?.expectedResponse ?? {}
  };

  // LOOSE MODE: không có spec -> vẫn ép kiểu theo guessType, không trả extras
  if (!specHas) {
    const coercedLoose = {
      ...merged,
      headers: coerceLoose(merged.headers),
      queryParams: coerceLoose(merged.queryParams),
      body: coerceLoose(merged.body),
    };
    return { formatParam: coercedLoose, extras: [] };
  }

  // STRICT MODE: có spec -> ép kiểu theo spec; extras chỉ tính nếu opts.strict === true
  const coerced = { ...merged };

  if (hasKeys(formatData?.headers)) {
    const out = {};
    for (const k of Object.keys(formatData.headers)) {
      const spec = formatData.headers[k];
      const val = k in merged.headers ? merged.headers[k] : spec.value;
      out[k] = coerceByType(spec.dataType || 'String', val);
    }
    coerced.headers = out;
  }

  if (hasKeys(formatData?.queryParams)) {
    const out = {};
    for (const k of Object.keys(formatData.queryParams)) {
      const spec = formatData.queryParams[k];
      const val = k in merged.queryParams ? merged.queryParams[k] : spec.value;
      out[k] = coerceByType(spec.dataType || 'String', val);
    }
    coerced.queryParams = out;
  }

  coerced.body = hasKeys(formatData?.body)
    ? coerceParamWithFormat(merged.body, formatData.body)
    : merged.body;

  let extras = [];
  if (opts.strict) {
    if (hasKeys(formatData?.headers)) extras.push(...diffExtraFields(merged.headers, formatData.headers, ['headers']));
    if (hasKeys(formatData?.queryParams)) extras.push(...diffExtraFields(merged.queryParams, formatData.queryParams, ['queryParams']));
    if (hasKeys(formatData?.body)) extras.push(...diffExtraFields(merged.body, formatData.body, ['body']));
  }

  return { formatParam: coerced, extras };
}
// Bỏ "Authorization" (case-insensitive) ở mọi nơi
const SENSITIVE_KEYS = new Set(['authorization']);

// normalize 1 mảng [{key,value}|{key,values}] -> object { k: v, ... }
// giữ đúng quy tắc JSONB: value -> giá trị; values -> luôn là mảng;
//   - phần tử là mảng [{key,value},...] -> object gộp
//   - phần tử là object {key,value}     -> { [key]: value }
//   - phần tử primitive                 -> giữ nguyên
function normalizeParamEntriesFiltered(entries, ignore = SENSITIVE_KEYS) {
  if (!Array.isArray(entries)) return isPlainObject(entries) ? entries : {};
  const out = {};
  for (const p of entries) {
    const k = p?.key;
    if (!k) continue;
    if (ignore?.has(String(k).toLowerCase())) continue;

    if ('value' in p) {
      out[k] = p.value;
      continue;
    }
    if (Array.isArray(p.values)) {
      const mapped = p.values.map((v) => {
        if (Array.isArray(v)) {
          const obj = {};
          for (const x of v) {
            const kk = x?.key;
            if (!kk) continue;
            if (ignore?.has(String(kk).toLowerCase())) continue;
            obj[kk] = x?.value;
          }
          return obj;
        }
        if (isPlainObject(v) && 'key' in v) {
          const kk = v.key;
          if (ignore?.has(String(kk).toLowerCase())) return {};
          return { [kk]: v.value };
        }
        return v;
      }).filter(el => !(isPlainObject(el) && Object.keys(el).length === 0));
      out[k] = mapped;
      continue;
    }
    out[k] = null; // không có value/values -> null
  }
  return out;
}

// === NEW: Quét đầy đủ step ===
export function normalizeStepsV2(input) {
  if (!Array.isArray(input)) return [];

  return input.map((s) => {
    const stepOut = { name: s?.name ?? null };

    // method ở cấp step (nếu có)
    if ('method' in (s || {})) stepOut.method = s.method ?? null;

    // headers/queryParams/body là mảng kv -> object (hoặc null nếu không có)
    if (Array.isArray(s?.headers)) {
      const obj = normalizeParamEntriesFiltered(s.headers);
      stepOut.headers = obj; // nếu rỗng -> {}
    } else {
      stepOut.headers = null;
    }

    if (Array.isArray(s?.queryParams)) {
      const obj = normalizeParamEntriesFiltered(s.queryParams);
      stepOut.queryParams = obj;
    } else {
      stepOut.queryParams = null;
    }

    if (Array.isArray(s?.body)) {
      const obj = normalizeParamEntriesFiltered(s.body);
      stepOut.body = obj;
    } else {
      stepOut.body = null;
    }

    // inputParam (nếu có) -> mảng { method, params }
    const ipSrc = Array.isArray(s?.inputParam) ? s.inputParam : [];
    stepOut.inputParam = ipSrc.length
      ? ipSrc.map((ip) => ({
        method: ('method' in (ip || {})) ? (ip.method ?? null) : null,
        params: normalizeParamEntriesFiltered(Array.isArray(ip?.params) ? ip.params : [])
      }))
      : null; // giống jsonb_agg: rỗng -> null

    return stepOut;
  });
}
