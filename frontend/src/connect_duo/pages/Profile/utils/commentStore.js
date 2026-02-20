const COMMENT_STORAGE_KEY = 'connectduo-comments-by-taxpro';
const COMMENT_DEBUG = true;

const debugLog = (...args) => {
    if (!COMMENT_DEBUG) return;
    // eslint-disable-next-line no-console
    console.log('[commentStore]', ...args);
};

const readCommentMap = () => {
    try {
        const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeCommentMap = (map) => {
    localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(map));
};

export const getCommentsByTaxProId = (taxProId) => {
    if (taxProId == null) return [];
    const map = readCommentMap();
    const bucket = map[String(taxProId)];
    const result = Array.isArray(bucket) ? bucket : [];
    debugLog('getCommentsByTaxProId', { taxProId, count: result.length });
    return result;
};

export const saveCommentsByTaxProId = (taxProId, comments) => {
    if (taxProId == null) return;
    const map = readCommentMap();
    map[String(taxProId)] = Array.isArray(comments) ? comments : [];
    debugLog('saveCommentsByTaxProId', { taxProId, count: map[String(taxProId)].length });
    writeCommentMap(map);
};

export const getMyCommentCounts = (userId) => {
    if (!userId) return [];
    const map = readCommentMap();

    return Object.entries(map)
        .map(([taxProId, comments]) => ({
            taxProId: Number(taxProId),
            count: Array.isArray(comments) ? comments.filter((comment) => comment?.userId === userId).length : 0,
        }))
        .filter((item) => item.count > 0);
};
