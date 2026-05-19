import {
  clearStoredSessionToken,
  logoutSession,
  persistSessionToken,
  readStoredSessionToken,
  resolveAuthenticatedSession,
  type User,
} from "@/lib/services";
import { create } from "zustand";

type AppStore = {
  token: string | null;
  user: User | null;
  authError: string | null;
  isUserAuthenticated: boolean;
  isUserAuthorized: boolean;
  isAuthLoading: boolean;

  // login function
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;

  // store initializer
  authInit: (token?: string) => Promise<void>;

  // store setters
  setUserAuthenticated: (value: boolean) => void;
  setUserAuthorized: (value: boolean) => void;
  setAuthLoading: (value: boolean) => void;
};

let authInitPromise: Promise<void> | null = null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}

const signedOutState = {
  authError: null,
  isAuthLoading: false,
  isUserAuthenticated: false,
  isUserAuthorized: false,
  token: null,
  user: null,
} satisfies Pick<
  AppStore,
  | "authError"
  | "isAuthLoading"
  | "isUserAuthenticated"
  | "isUserAuthorized"
  | "token"
  | "user"
>;

const useAppStore = create<AppStore>((set, get) => ({
  token: null,
  user: null,
  authError: null,
  isUserAuthenticated: false,
  isUserAuthorized: false,
  isAuthLoading: true,

  login: async (token: string): Promise<void> => {
    set({ authError: null, isAuthLoading: true });

    try {
      const session = await resolveAuthenticatedSession(token);

      persistSessionToken(session.token);
      set({
        authError: null,
        isAuthLoading: false,
        isUserAuthenticated: true,
        isUserAuthorized: true,
        token: session.token,
        user: session.user,
      });
    } catch (error) {
      const authError = getErrorMessage(
        error,
        "We could not complete sign in.",
      );

      clearStoredSessionToken();
      set({
        authError,
        isAuthLoading: false,
        isUserAuthenticated: false,
        isUserAuthorized: false,
        token: null,
        user: null,
      });
      throw new Error(authError, { cause: error });
    }
  },

  authInit: async (token?: string) => {
    if (authInitPromise) {
      return authInitPromise;
    }

    authInitPromise = (async () => {
      const sessionToken = token ?? readStoredSessionToken();

      if (!sessionToken) {
        clearStoredSessionToken();
        set(signedOutState);
        return;
      }

      set({ authError: null, isAuthLoading: true });

      try {
        const session = await resolveAuthenticatedSession(sessionToken);

        persistSessionToken(session.token);
        set({
          authError: null,
          isAuthLoading: false,
          isUserAuthenticated: true,
          isUserAuthorized: true,
          token: session.token,
          user: session.user,
        });
      } catch (error) {
        clearStoredSessionToken();
        set({
          ...signedOutState,
          authError: getErrorMessage(error, "Your session has expired."),
        });
      }
    })();

    try {
      await authInitPromise;
    } finally {
      authInitPromise = null;
    }
  },

  logout: async () => {
    const token = get().token ?? readStoredSessionToken();

    clearStoredSessionToken();
    set(signedOutState);

    await logoutSession(token);
  },

  setAuthLoading: (value) => set({ isAuthLoading: value }),
  setUserAuthenticated: (value) => set({ isUserAuthenticated: value }),
  setUserAuthorized: (value) => set({ isUserAuthorized: value }),
}));

export default useAppStore;
