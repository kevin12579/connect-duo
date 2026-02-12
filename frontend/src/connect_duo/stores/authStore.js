import { devtools } from 'zustand/middleware';
import { create } from 'zustand';
// authStore.js
export const useAuthStore = create(
    devtools((set) => ({
        authUser: null, //인증받은 사용자 정보
        loginAuthUser: (user) =>
            set({
                authUser: user,
            }),
        logout: () => set({ authUser: null }),
    }))
);
