import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useAuthStore = create(
    devtools((set) => ({
        authUser: null,
        isAuthLoading: true,
        setAuthLoading: (loading) => set({ isAuthLoading: loading }),
        loginAuthUser: (user) =>
            set({
                authUser: user,
                isAuthLoading: false, // 로그인 성공 시 로딩 해제
            }),
        // 로그아웃 시 모든 저장소 비우기
        logout: () => {
            set({ authUser: null, isAuthLoading: false });
            sessionStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userBackup');
        },
    })),
);
