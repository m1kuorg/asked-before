// The app's page entry, served at every path under /app (dist/_redirects).
// It asks who is logged in (a 401 goes to log in and comes back here), with
// the shell's frame drawn while it waits, then draws the shell around the
// current screen. If it can't ask, it says why, with "Try again" when a retry
// can help. The screens in chunks of their own are fetched meanwhile.

import type { Account } from "@asked-before/sdk";
import { Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ErrorNotice } from "@/components/error-notice";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { navigate, NotFoundBoundary, preloadScreens, reportCaughtError, useRouter, type ScreenProps } from "@/app/router";
import { ScreenSkeleton, Shell, ShellSkeleton } from "@/app/shell";
import { useResource } from "@/app/use-resource";
import { client } from "@/lib/client";
import { markSignedIn } from "@/lib/signed-in";
import { NotFound } from "@/screens/not-found";

function App({ initial }: { initial: Account }) {
  const [account, setAccount] = useState(initial);
  const view = useRouter();
  const Screen = view.route.screen;
  const props: ScreenProps<string> = {
    params: view.params,
    query: view.query,
    client,
    account,
    setAccount,
    navigate,
    setTitle: view.setTitle,
    signal: view.signal,
  };
  return (
    <Shell account={account} route={view.route} params={view.params} title={view.title} routeKey={view.key}>
      <NotFoundBoundary key={view.key} fallback={<NotFound {...props} />}>
        <Suspense fallback={<ScreenSkeleton said="Opening the page…" />}>
          <Screen {...props} />
        </Suspense>
      </NotFoundBoundary>
    </Shell>
  );
}

function Start() {
  const me = useResource(() => client.auth.me(), []);
  useEffect(() => {
    if (me.data) markSignedIn();
  }, [me.data]);
  if (me.data) return <App initial={me.data} />;
  if (me.error === null) return <ShellSkeleton />;
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16 text-sm">
      <h1 className="text-2xl font-semibold">Asked Before</h1>
      <ErrorNotice error={me.error} title="Asked Before couldn't open your account." onRetry={me.retry} />
    </main>
  );
}

preloadScreens();
createRoot(document.getElementById("app")!, { onCaughtError: reportCaughtError }).render(
  <TooltipProvider>
    <Toaster>
      <Start />
    </Toaster>
  </TooltipProvider>,
);
