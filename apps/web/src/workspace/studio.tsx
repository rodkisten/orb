import { useRouteState, updateRoute } from "./state";
import { WorkspaceExplorer, type OpenWorkflow } from "./explorer";
import { Button } from "../components/ui/button";
import { FolderGit2, Workflow, Play } from "lucide-react";
import { ApiWorkbench } from "../pages/api-workbench";
export function WorkspaceStudio() {
  const route = useRouteState();
  const file: OpenWorkflow | undefined =
    route.repo && route.path
      ? { repo: route.repo, path: route.path, ref: route.ref }
      : undefined;
  const panel =
    (route.panel==="explorer"||route.panel==="studio"?route.panel:undefined) ??
    (location.pathname === "/api" || file || route.draft
      ? "studio"
      : "explorer");
  const setPanel = (panel: string) => updateRoute({ panel });
  return (
    <section className="orb-workspace">
      <div className="orb-workspace-nav">
        <Button type="button" variant="ghost"
          aria-pressed={panel === "explorer"}
          onClick={() => setPanel("explorer")}
        >
          <FolderGit2 size={14}/> Explorer
        </Button>
        <Button type="button" variant="ghost"
          aria-pressed={panel === "studio" && route.inspector!=="runner"}
          onClick={() => updateRoute({panel:"studio",inspector:route.inspector==="runner"?null:route.inspector??null})}
        >
          <Workflow size={14}/> Builder
        </Button>
        {file&&<Button type="button" variant="ghost" aria-pressed={panel==="studio"&&route.inspector==="runner"} onClick={()=>updateRoute({panel:"studio",pane:"inspector",inspector:"runner"})}><Play size={14}/> Runner</Button>}
        <a
          href={
            (location.pathname === "/api" ? "/workspace" : "/api") +
            location.search
          }
        >
          {location.pathname === "/api" ? "Studio" : "API Lab"}
        </a>
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
                pane:"source",job:null,step:null,inspector:null,
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
