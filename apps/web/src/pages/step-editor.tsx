import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useState } from "react";
import type { BuilderEdit } from "./builder-form";
type Job = {
  id: string;
  steps: {
    index: number;
    name: string | null;
    uses: string | null;
    kind: string;
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
  const [job, setJob] = useState(""),
    [index, setIndex] = useState(0),
    [condition, setCondition] = useState(""),
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
  function submit(kind: BuilderEdit["kind"], direction?: number) {
    if (!current || !step) return;
    setError("");
    try {
      const vars: Record<string, string> = {};
      for (const line of env.split("\n").filter(Boolean)) {
        const at = line.indexOf("=");
        if (at < 1) throw Error("Use KEY=value");
        vars[line.slice(0, at)] = line.slice(at + 1);
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
            setJob(e.target.value);
            setIndex(0);
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
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {current?.steps.map((s) => (
            <option key={s.index} value={s.index}>
              {s.index + 1}. {s.name ?? s.uses ?? s.kind}
            </option>
          ))}
        </select>
      </label>
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
      <Button type="button" onClick={() => submit("configure-step")}>
        Review configuration
      </Button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
