import { StructuredEditor } from "./structured-editor";
import { useRouteState, updateRoute } from "../workspace/state";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { useState } from "react";
import type { BuilderEdit } from "./builder-form";
type Job = {
  id: string;
  steps: {
    index: number;
    name: string | null;
    uses: string | null;
    kind: string;
    run?: string | null;
    shell?: string | null;
  }[];
};
export function StepEditor({
  body,
  disabled,
  onEdit,
}: {
  body: string;
  disabled: boolean;
  onEdit: (edit: BuilderEdit) => void;
}) {
  const route = useRouteState();
  const job = route.job ?? "";
  const index = Number(route.step ?? 0);
  const [condition, setCondition] = useState(""),
    [timeout, setTimeoutValue] = useState(""),
    [allow, setAllow] = useState(false),
    [env, setEnv] = useState("");
  const [error, setError] = useState("");
  let jobs: Job[] = [];
  try {
    jobs = JSON.parse(body).details ?? [];
  } catch {}
  const current = jobs.find((j) => j.id === job) ?? jobs[0];
  const step =
    current?.steps.find((s) => s.index === index) ?? current?.steps[0];
  const changed = Boolean(condition || timeout || allow || env);
  function submit(kind: BuilderEdit["kind"], direction?: number) {
    if (!current || !step) return;
    setError("");
    try {
      if(kind==="configure-step" && timeout && (!Number.isInteger(Number(timeout)) || Number(timeout)<1 || Number(timeout)>360)) throw Error("Timeout must be an integer from 1 to 360");
      const vars: Record<string, string> = Object.create(null);
      for (const line of (kind==="configure-step" ? env : "").split("\n").filter(Boolean)) {
        const at = line.indexOf("=");
        if (at < 1) throw Error("Use KEY=value");
        const key=line.slice(0,at).trim();
        if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw Error("Invalid environment variable: "+key);
        vars[key] = line.slice(at + 1);
      }
      onEdit({
        kind,
        job: current.id,
        index: step.index,
        direction,
        ...(kind === "configure-step"
          ? {
              ...(condition ? { condition } : {}),
              ...(timeout ? { timeout: Number(timeout) } : {}),
              ...(allow ? { continueOnError: true } : {}),
              ...(env ? { env: vars } : {}),
            }
          : {}),
      });
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <fieldset disabled={disabled || !step}>
      <legend>Existing steps</legend>
      <label>
        Job
        <select
          value={current?.id ?? ""}
          onChange={(e) => {
            updateRoute({ job: e.target.value, step: "0" });
          }}
        >
          {jobs.map((j) => (
            <option key={j.id}>{j.id}</option>
          ))}
        </select>
      </label>
      <label>
        Step
        <select
          value={step?.index ?? 0}
          onChange={(e) => updateRoute({ step: e.target.value })}
        >
          {current?.steps.map((s) => (
            <option key={s.index} value={s.index}>
              {s.index + 1}. {s.name ?? s.uses ?? s.kind}
            </option>
          ))}
        </select>
      </label>
      {current && step && typeof step.run === "string" && (
        <ScriptPanel
          key={JSON.stringify([current.id, step.index, step.run])}
          value={step.run}
          shell={step.shell ?? "default shell"}
          disabled={disabled}
          onSave={(run) =>
            onEdit({
              kind: "configure-step",
              job: current.id,
              index: step.index,
              run,
            })
          }
        />
      )}
      <Button
        type="button"
        disabled={!step || step.index === 0}
        onClick={() => submit("move-step", -1)}
      >
        Move up
      </Button>
      <Button
        type="button"
        disabled={!step || step.index === (current?.steps.length ?? 0) - 1}
        onClick={() => submit("move-step", 1)}
      >
        Move down
      </Button>
      <Button
        type="button"
        disabled={(current?.steps.length ?? 0) < 2}
        onClick={() => submit("remove-step")}
      >
        Review removal
      </Button>
      <label>
        if
        <Input
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        />
      </label>
      <label>
        Timeout minutes
        <Input
          type="number"
          min="1"
          max="360"
          value={timeout}
          onChange={(e) => setTimeoutValue(e.target.value)}
        />
      </label>
      <label>
        <Input
          type="checkbox"
          checked={allow}
          onChange={(e) => setAllow(e.target.checked)}
        />{" "}
        Continue on error
      </label>
      <label>
        Environment (KEY=value)
        <Textarea value={env} onChange={(e) => setEnv(e.target.value)} />
      </label>
      <Button type="button" disabled={!changed} onClick={() => submit("configure-step")}>
        Review configuration
      </Button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}

function ScriptPanel({
  value,
  shell,
  disabled,
  onSave,
}: {
  value: string;
  shell: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [expanded,setExpanded]=useState(false);
  const [copyError,setCopyError]=useState(false);
  return (
    <section className={"orb-script-panel"+(expanded?" orb-script-expanded":"")}>
      <div className="orb-script-toolbar"><h3>Script · {shell}</h3><Button type="button" onClick={()=>setExpanded(!expanded)}>{expanded?"Collapse":"Expand"}</Button></div>
      <small>{draft.split("\n").length} lines · {draft===value?"Unchanged":"Unsaved changes"}</small>
      <StructuredEditor
        script
        value={draft}
        onChange={setDraft}
        disabled={disabled}
      />
      <div className="orb-script-toolbar"><Button type="button" disabled={disabled || draft===value} onClick={()=>setDraft(value)}>Reset</Button><Button type="button" onClick={()=>{void navigator.clipboard.writeText(draft).catch(()=>setCopyError(true));}}>Copy</Button>
      <Button
        type="button"
        disabled={disabled || draft === value}
        onClick={() => onSave(draft)}
      >
        Review script patch
      </Button></div>{copyError && <p role="alert">Clipboard unavailable</p>}
    </section>
  );
}
