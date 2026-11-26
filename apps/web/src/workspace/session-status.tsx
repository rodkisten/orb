import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
export function SessionStatus() {
  const session = useQuery({
    queryKey: ["access-session"],
    queryFn: async ({ signal }) => {
      const r = await fetch("/v1/session", {
        signal,
        credentials: "same-origin",
        redirect: "manual",
        cache: "no-store",
      });
      return r.type === "opaqueredirect" ? 401 : r.status;
    },
    retry: false,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  const status = session.data;
  if (!session.error && (status === undefined || status === 200)) return null;
  return (
    <aside
      role="alert"
      className="mx-3 my-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
    >
      <ShieldAlert size={20} />
      <div className="min-w-0 flex-1">
        <strong>
          {status === 401
            ? "Access session not verified"
            : status === 403
              ? "Access denied"
              : "Session check unavailable"}
        </strong>
        <p className="text-muted-foreground">
          {status === 401
            ? "Refresh your Access login, then check again. Your local drafts remain on this device."
            : "Check service configuration or connectivity, then retry."}
        </p>
      </div>
      <Button
        type="button"
        onClick={() => void session.refetch()}
        disabled={session.isFetching}
      >
        <RefreshCw size={14} /> Check again
      </Button>
      {status === 401 && (
        <a
          className="underline"
          href="/cdn-cgi/access/logout"
          target="_blank"
          rel="noreferrer"
        >
          Renew login
        </a>
      )}
    </aside>
  );
}
