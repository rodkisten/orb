import { StructuredEditor } from "./structured-editor";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { WorkflowInspector } from "./workflow-inspector";
import { JobInspector } from "./job-inspector";
import { StepEditor } from "./step-editor";
import { ActionInspector } from "./action-inspector";
import { useState } from "react";
import { Workflow, Box, ListOrdered, Plus } from "lucide-react";
import { useRouteState, updateRoute } from "../workspace/state";
export type BuilderEdit = {
  kind:
    | "add-job"
    | "duplicate-job"
    | "add-step"
    | "remove-step"
    | "move-step"
    | "configure-step"
    | "configure-job"
    | "configure-workflow";
  job: string;
  id?: string;
  name?: string;
  run?: string;
  uses?: string;
  inputs?: Record<string, string>;
  index?: number;
  direction?: number;
  condition?: string;
  timeout?: number;
  continueOnError?: boolean;
  env?: Record<string, string>;
  jobFields?: Record<string, string>;
};
export function BuilderForm({
  body,
  disabled,
  onEdit,
}: {
  body: string;
  disabled: boolean;
  onEdit: (edit: BuilderEdit) => void;
}) {
  const route = useRouteState();
  const tabs = [
    { id: "workflow", label: "Workflow", Icon: Workflow },
    { id: "job", label: "Job", Icon: Box },
    { id: "steps", label: "Steps", Icon: ListOrdered },
    { id: "add", label: "Add / Actions", Icon: Plus },
  ];
  const active = tabs.some((t) => t.id === route.inspector)
    ? route.inspector
    : "workflow";
  const [kind, setKind] = useState<BuilderEdit["kind"]>("add-job");
  const [job, setJob] = useState("");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"run" | "uses">("run");
  const [value, setValue] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  let jobs: string[] = [];
  try {
    const data = JSON.parse(body);
    if (Array.isArray(data.jobs))
      jobs = data.jobs.map((j: { id: string }) => j.id);
  } catch {}
  const selected = jobs.includes(job) ? job : (jobs.includes(route.job ?? "") ? route.job! : jobs[0] ?? "");
  if (!jobs.length)
    return (
      <p className="text-sm text-muted-foreground">
        Open or create a valid workflow to enable the inspector.
      </p>
    );
  return (
    <section className="orb-inspector rounded-xl border border-border bg-card p-3 text-card-foreground">
      <div className="mb-2 flex items-center justify-between">
        <h3>Inspector</h3>
        <span className="text-xs text-muted-foreground">
          {disabled ? "Read only" : "Review before applying"}
        </span>
      </div>
      <nav
        aria-label="Inspector sections"
        className="mb-3 grid grid-cols-2 gap-1 sm:grid-cols-4"
      >
        {tabs.map(({ id, label, Icon }) => (
          <Button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => updateRoute({ inspector: id })}
            className="!flex !items-center !justify-center !gap-1 !rounded-md !px-2 !py-2 !text-xs aria-pressed:!bg-primary aria-pressed:!text-primary-foreground"
          >
            <Icon size={14} />
            {label}
          </Button>
        ))}
      </nav>
      <div hidden={active !== "add"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onEdit({
              kind,
              job: selected,
              ...(kind === "add-step"
                ? {
                    name,
                    [mode]: value,
                    ...(mode === "uses" ? { inputs } : {}),
                  }
                : { id }),
            });
          }}
        >
          <fieldset disabled={disabled || !jobs.length}>
            <label>
              Operation
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as BuilderEdit["kind"])}
              >
                <option value="add-job">Add job</option>
                <option value="duplicate-job">Duplicate job</option>
                <option value="add-step">Add step</option>
              </select>
            </label>
            {kind !== "add-job" && (
              <label>
                Job
                <select
                  value={selected}
                  onChange={(e) => setJob(e.target.value)}
                >
                  {jobs.map((j) => (
                    <option key={j}>{j}</option>
                  ))}
                </select>
              </label>
            )}
            {kind === "add-step" ? (
              <>
                <label>
                  Name
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "run" | "uses")}
                  >
                    <option>run</option>
                    <option>uses</option>
                  </select>
                </label>
                <label>
                  {mode}
                  {mode === "run" ? (
                    <StructuredEditor
                      script
                      value={value}
                      onChange={setValue}
                      disabled={disabled}
                    />
                  ) : (
                    <Textarea
                      required
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        setInputs({});
                      }}
                      autoCapitalize="none"
                    />
                  )}
                </label>
                {mode === "uses" && (
                  <ActionInspector
                    uses={value}
                    onUses={(v) => {
                      setValue(v);
                      setInputs({});
                    }}
                    inputs={inputs}
                    onInputs={setInputs}
                  />
                )}
              </>
            ) : (
              <label>
                New job ID
                <Input
                  required
                  pattern="[A-Za-z_][A-Za-z0-9_-]*"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  autoCapitalize="none"
                />
              </label>
            )}
            <Button type="submit">Review patch</Button>
          </fieldset>
        </form>
      </div>
      <div hidden={active !== "workflow"}>
        <WorkflowInspector disabled={disabled} onEdit={onEdit} />
      </div>
      <div hidden={active !== "job"}>
        <JobInspector key={route.job ?? ""} body={body} disabled={disabled} onEdit={onEdit} />
      </div>
      <div hidden={active !== "steps"}>
        <StepEditor key={JSON.stringify([route.job,route.step])} body={body} disabled={disabled} onEdit={onEdit} />
      </div>
    </section>
  );
}
