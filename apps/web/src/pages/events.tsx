import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";

type EventItem = {
  id: string;
  type: string;
  source: string;
  subject_id: string;
  occurred_at: string;
  observed_at: string;
  status: "pending" | "queued" | "processed" | "failed";
  attempts: number;
};
type EventList = {
  items: EventItem[];
  total: number;
  limit: number;
  offset: number;
};

async function fetchEvents(filters: {
  source: string;
  type: string;
  status: string;
  sort: string;
  limit: number;
  offset: number;
}): Promise<EventList> {
  const params = new URLSearchParams();
  if (filters.source) params.set("source", filters.source);
  if (filters.type) params.set("type", filters.type);
  if (filters.status !== "all") params.set("status", filters.status);
  params.set("sort", filters.sort);
  params.set("limit", String(filters.limit));
  params.set("offset", String(filters.offset));
  const response = await fetch("/v1/events?" + params.toString(), {
    credentials: "include",
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Authentication required. Configure a server-side session before connecting to the API."
        : "API request failed (" + response.status + ")",
    );
  return response.json() as Promise<EventList>;
}

async function fetchEvent(id: string): Promise<EventItem> {
  const response = await fetch("/v1/events/" + encodeURIComponent(id), {
    credentials: "include",
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Authentication required."
        : "Unable to load selected event (" + response.status + ")",
    );
  return response.json() as Promise<EventItem>;
}

export function EventExplorer() {
  const search = useSearch({ from: "/events" });
  const navigate = useNavigate({ from: "/events" });
  const offset = (search.page - 1) * search.limit;
  const filters = {
    source: search.source,
    type: search.type,
    status: search.status,
    sort: search.sort,
    limit: search.limit,
    offset,
  };
  const query = useQuery({
    queryKey: ["events", filters],
    queryFn: () => fetchEvents(filters),
  });
  const patch = (updates: Partial<typeof search>) =>
    navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: false,
    });
  const detailQuery = useQuery({
    queryKey: ["event", search.selected],
    queryFn: () => fetchEvent(search.selected),
    enabled: search.panel === "open" && Boolean(search.selected),
  });
  const selected =
    detailQuery.data ??
    query.data?.items.find((item) => item.id === search.selected);
  return (
    <section className="explorer">
      <div className="heading">
        <div>
          <p className="eyebrow">EVENT STREAM</p>
          <h1>Event Explorer</h1>
          <p>
            Shareable filters and navigation. Every change lives in the URL.
          </p>
        </div>
        <Link to="/">Overview</Link>
      </div>
      <div className="toolbar">
        <label>
          Project
          <input
            aria-label="Project"
            value={search.project}
            onChange={(event) =>
              void patch({ project: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Source
          <input
            aria-label="Source"
            placeholder="github"
            value={search.source}
            onChange={(event) =>
              void patch({ source: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Type
          <input
            aria-label="Type"
            placeholder="push"
            value={search.type}
            onChange={(event) =>
              void patch({ type: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Status
          <select
            value={search.status}
            onChange={(event) =>
              void patch({
                status: event.target.value as typeof search.status,
                page: 1,
              })
            }
          >
            {["all", "pending", "queued", "processed", "failed"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Sort
          <select
            value={search.sort}
            onChange={(event) =>
              void patch({
                sort: event.target.value as typeof search.sort,
                page: 1,
              })
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <label>
          Page size
          <select
            value={search.limit}
            onChange={(event) =>
              void patch({ limit: Number(event.target.value), page: 1 })
            }
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          View
          <select
            value={search.view}
            onChange={(event) =>
              void patch({ view: event.target.value as typeof search.view })
            }
          >
            <option value="table">Table</option>
            <option value="cards">Cards</option>
          </select>
        </label>
      </div>
      <div className="results">
        {query.isPending ? (
          <p>Loading events…</p>
        ) : query.isError ? (
          <p role="alert" className="error">
            {query.error.message}
          </p>
        ) : (
          <>
            <div className="result-heading">
              <span>{query.data.total} events</span>
              <span>Page {search.page}</span>
            </div>
            {query.data.items.length === 0 ? (
              <p>No events match these filters.</p>
            ) : (
              <div className={search.view === "cards" ? "cards" : "table"}>
                {query.data.items.map((item) => (
                  <button
                    type="button"
                    className={
                      search.selected === item.id ? "event selected" : "event"
                    }
                    key={item.id}
                    onClick={() =>
                      void patch({ selected: item.id, panel: "open" })
                    }
                  >
                    <span className="event-type">{item.type}</span>
                    <span>{item.source}</span>
                    <span>{item.status}</span>
                    <span>{item.occurred_at}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="pagination">
              <button
                disabled={search.page <= 1}
                onClick={() => void patch({ page: search.page - 1 })}
              >
                Previous
              </button>
              <button
                disabled={offset + search.limit >= query.data.total}
                onClick={() => void patch({ page: search.page + 1 })}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
      {search.panel === "open" && (
        <aside className="detail">
          <div className="detail-heading">
            <h2>Event details</h2>
            <button
              aria-label="Close details"
              onClick={() => void patch({ panel: "closed", selected: "" })}
            >
              Close
            </button>
          </div>
          {detailQuery.isError ? (
            <p role="alert" className="error">
              {detailQuery.error.message}
            </p>
          ) : selected ? (
            <pre>{JSON.stringify(selected, null, 2)}</pre>
          ) : detailQuery.isPending && search.selected ? (
            <p>Loading event…</p>
          ) : (
            <p>Select an event.</p>
          )}
        </aside>
      )}
    </section>
  );
}
