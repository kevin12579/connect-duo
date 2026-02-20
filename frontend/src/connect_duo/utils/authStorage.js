export const AUTH_STORAGE_EVENT = 'connectduo-auth-changed';

export const getStoredUser = () => {
    try {
        const raw = localStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const getAuthState = () => {
    const token = localStorage.getItem('accessToken');
    const user = getStoredUser();

    return {
        token,
        user,
        isLoggedIn: Boolean(token) && Boolean(user),
    };
};

const notifyAuthChanged = () => {
    window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
};

export const setAuthSession = ({ token, user }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    notifyAuthChanged();
};

export const clearAuthSession = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    notifyAuthChanged();
};
