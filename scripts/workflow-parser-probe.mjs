import {
  parseWorkflow,
  NoOperationTraceWriter,
} from "@actions/workflow-parser";
import { createActionsAdapter } from "../packages/workflow-core/src/adapters.ts";
import { Parser } from "web-tree-sitter";
const validate = createActionsAdapter({ parseWorkflow });
const valid = validate(
  "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n",
);
const invalid = validate("on: push\njobs:\n  build:\n    nonexistent: true\n");
if (!valid.valid || invalid.valid) throw Error("Official parser smoke failed");
await Parser.init();
const parser = new Parser();
parser.delete();
console.log(
  JSON.stringify(
    { official: valid, invalid, wasmRuntime: "initialized" },
    null,
    2,
  ),
);
