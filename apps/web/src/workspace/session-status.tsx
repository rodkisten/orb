import { useQuery } from "@tanstack/react-query";
import { SessionAlert } from "../components/shared/session-alert";
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
    <div className="mx-3 my-2">
      <SessionAlert
        title={
          status === 401
            ? "Access session not verified"
            : status === 403
              ? "Access denied"
              : "Session check unavailable"
        }
        description={
          status === 401
            ? "Refresh your Access login, then check again. Your local drafts remain on this device."
            : "Check service configuration or connectivity, then retry."
        }
        busy={session.isFetching}
        onRetry={() => void session.refetch()}
        action={
          status === 401 ? (
            <a
              className="underline"
              href="/cdn-cgi/access/logout"
              target="_blank"
              rel="noreferrer"
            >
              Renew login
            </a>
          ) : undefined
        }
      />
    </div>
  );
}
