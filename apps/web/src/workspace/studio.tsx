import { useRouteState, updateRoute } from "./state";
import { WorkspaceExplorer, type OpenWorkflow } from "./explorer";
import { ApiWorkbench } from "../pages/api-workbench";
export function WorkspaceStudio() {
  const route = useRouteState();
  const file: OpenWorkflow | undefined =
    route.repo && route.path
      ? { repo: route.repo, path: route.path, ref: route.ref }
      : undefined;
  const panel =
    route.panel ??
    (location.pathname === "/api" || file || route.draft
      ? "studio"
      : "explorer");
  const setPanel = (panel: string) => updateRoute({ panel });
  return (
    <section className="orb-workspace">
      <div className="orb-workspace-nav">
        <button
          aria-pressed={panel === "explorer"}
          onClick={() => setPanel("explorer")}
        >
          Explorer
        </button>
        <button
          aria-pressed={panel === "studio"}
          onClick={() => setPanel("studio")}
        >
          Studio
        </button>
        <a href={(location.pathname === "/api" ? "/workspace" : "/api") + location.search}>{location.pathname === "/api" ? "Studio" : "API Lab"}</a>
      </div>
      <div className="workspace-unified">
        <div
          className={
            panel === "explorer" ? "workspace-visible" : "workspace-secondary"
          }
        >
          <WorkspaceExplorer
            onOpen={(next) => {
              updateRoute({
                repo: next.repo,
                path: next.path,
                ref: next.ref ?? null,
                panel: "studio",
                draft: null,
              });
            }}
          />
        </div>
        <div
          className={
            panel === "studio" ? "workspace-visible" : "workspace-secondary"
          }
        >
          <ApiWorkbench file={file} />
        </div>
      </div>
    </section>
  );
}
