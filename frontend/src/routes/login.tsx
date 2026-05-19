import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { AUTH_URL } from "@/constant";
import { isAppRoutePath, type AppRoutePath } from "@/lib/app-routes";
import useAppStore from "@/store/store";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    intent:
      search.intent === "upload" || search.intent === "action"
        ? search.intent
        : undefined,
    redirectTo:
      typeof search.redirectTo === "string" && isAppRoutePath(search.redirectTo)
        ? search.redirectTo
        : undefined,
  }),
  component: RouteComponent,
});

type LoginSearch = {
  intent?: "action" | "upload";
  redirectTo?: AppRoutePath;
};

const GoogleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.2045Z"
      fill="#4285F4"
    />
    <path
      d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z"
      fill="#34A853"
    />
    <path
      d="M3.96409 10.71C3.78409 10.17 3.68182 9.5931 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9581H0.957275C0.347727 6.1731 0 7.5477 0 9C0 10.4522 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
      fill="#FBBC05"
    />
    <path
      d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9254L15.0218 2.344C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9581L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z"
      fill="#EA4335"
    />
  </svg>
);

const MicrosoftIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" />
    <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" />
    <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" />
    <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" />
  </svg>
);

const GitHubIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

type AuthType = "google" | "azure" | "github";

const authUrl = AUTH_URL;
const authOrigins = new Set(
  Object.values(authUrl).map((url) => new URL(url).origin),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAuthMessageToken(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  if (typeof data.token === "string" && data.token.length > 0) {
    return data.token;
  }

  if (isRecord(data.data) && typeof data.data.token === "string") {
    return data.data.token;
  }

  return null;
}

function getAuthMessageStatus(data: unknown) {
  if (!isRecord(data)) {
    return null;
  }

  const status = data.status ?? data.code;
  const numericStatus =
    typeof status === "string" ? Number.parseInt(status, 10) : status;

  return typeof numericStatus === "number" && !Number.isNaN(numericStatus)
    ? numericStatus
    : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}

function getBlockedAuthTabMessage() {
  return "Allow pop-ups and redirects for this site, then try signing in again.";
}

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const shouldShowSignInBanner = Boolean(search.intent);
  const signInBannerMessage =
    search.intent === "upload"
      ? "You need to sign in before uploading a document."
      : "You need to sign in before continuing.";
  const redirectTo = search?.redirectTo ?? "/docs";
  const [signInError, setSignInError] = useState("");
  const [activeAuthType, setActiveAuthType] = useState<AuthType | null>(null);
  const cleanupPopupRef = useRef<() => void>(() => undefined);
  const authTabRef = useRef<Window | null>(null);

  const {
    authError,
    isAuthLoading,
    isUserAuthenticated,
    isUserAuthorized,
    login,
  } = useAppStore(
    useShallow((state) => ({
      authError: state.authError,
      isAuthLoading: state.isAuthLoading,
      isUserAuthenticated: state.isUserAuthenticated,
      isUserAuthorized: state.isUserAuthorized,
      login: state.login,
    })),
  );

  useEffect(() => () => cleanupPopupRef.current(), []);

  useEffect(() => {
    if (!isAuthLoading && isUserAuthenticated && isUserAuthorized) {
      void navigate({ replace: true, to: redirectTo });
    }
  }, [
    isAuthLoading,
    isUserAuthenticated,
    isUserAuthorized,
    navigate,
    redirectTo,
  ]);

  function handleSignIn(authType: AuthType) {
    cleanupPopupRef.current();
    setSignInError("");
    setActiveAuthType(authType);

    let settled = false;

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      authTabRef.current = null;
      cleanupPopupRef.current = () => undefined;
    };

    const finishWithError = (message: string) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      setActiveAuthType(null);
      setSignInError(message);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (!authOrigins.has(event.origin) || settled) {
        return;
      }

      if (authTabRef.current && event.source !== authTabRef.current) {
        return;
      }

      const token = getAuthMessageToken(event.data);
      const status = getAuthMessageStatus(event.data);

      if (!token) {
        if (status && status !== 200) {
          finishWithError("Sign in was not completed.");
        }

        return;
      }

      settled = true;
      const authTab = authTabRef.current;
      cleanup();
      authTab?.close();

      try {
        await login(token);
        setActiveAuthType(null);
        void navigate({ replace: true, to: redirectTo });
      } catch (error) {
        setActiveAuthType(null);
        setSignInError(
          getErrorMessage(error, "We could not verify your session."),
        );
      }
    };

    window.addEventListener("message", handleMessage);
    cleanupPopupRef.current = cleanup;
  }

  function handleSignInClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    authType: AuthType,
  ) {
    if (isSigningIn) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const authTab = window.open(authUrl[authType], "_blank");

    if (!authTab) {
      setSignInError(getBlockedAuthTabMessage());
      return;
    }

    authTabRef.current = authTab;
    authTab.focus();

    handleSignIn(authType);
  }

  const displayedError = signInError || authError;
  const isSigningIn = activeAuthType !== null || isAuthLoading;

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{
        backgroundImage: `url('https://media.base44.com/images/public/6a045a6c5f644b10e4c42479/b927b4c52_generated_image.png')`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white px-12 py-10 text-center shadow-2xl">
        <div className="mb-10">
          <span className="text-xl font-bold text-gray-900">DocuStream</span>
          <span className="mx-2 font-light text-gray-400">/</span>
          <span className="text-sm text-gray-500">Documentation Portal</span>
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome back</h1>
        <p className="mb-8 text-sm text-gray-500">
          Sign in to upload and manage documents
        </p>

        {shouldShowSignInBanner ? (
          <Alert className="mb-6 border-[#d8d5fb] bg-[#f3f2ff] px-3 py-3 text-[#1d1a9d]">
            <IconInfoCircle className="size-4" stroke={2} />
            <AlertTitle className="text-sm font-semibold">
              Sign in required
            </AlertTitle>
            <AlertDescription className="text-sm text-slate-600">
              {signInBannerMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        {displayedError ? (
          <Alert className="mb-6 border-red-200 bg-red-50 px-3 py-3 text-red-900">
            <IconInfoCircle className="size-4" stroke={2} />
            <AlertTitle className="text-sm font-semibold">
              Sign in failed
            </AlertTitle>
            <AlertDescription className="text-sm text-red-700">
              {displayedError}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100! aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={isSigningIn}
          >
            <a
              href={authUrl.google}
              onClick={(event) => handleSignInClick(event, "google")}
            >
              <span className="flex size-5 items-center justify-center">
                <GoogleIcon />
              </span>
              {activeAuthType === "google"
                ? "Signing in..."
                : "Continue with Google"}
            </a>
          </Button>

          <Button
            asChild
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100! aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={isSigningIn}
          >
            <a
              href={authUrl.azure}
              onClick={(event) => handleSignInClick(event, "azure")}
            >
              <span className="flex size-5 items-center justify-center">
                <MicrosoftIcon />
              </span>
              {activeAuthType === "azure"
                ? "Signing in..."
                : "Continue with Microsoft"}
            </a>
          </Button>

          <Button
            asChild
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100! aria-disabled:pointer-events-none aria-disabled:opacity-50"
            aria-disabled={isSigningIn}
          >
            <a
              href={authUrl.github}
              onClick={(event) => handleSignInClick(event, "github")}
            >
              <span className="flex size-5 items-center justify-center text-gray-800">
                <GitHubIcon />
              </span>
              {activeAuthType === "github"
                ? "Signing in..."
                : "Continue with GitHub"}
            </a>
          </Button>
        </div>

        <p className="mt-10 text-xs text-gray-400">
          By signing in, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </div>
  );
}
