import { performance } from "node:perf_hooks";

const isTTY = Boolean(process.stdout.isTTY);
const useColor =
  !process.env.NO_COLOR &&
  (isTTY || Boolean(process.env.FORCE_COLOR) || Boolean(process.env.CI));

const ansi = (code) => (str) =>
  useColor ? `\x1b[${code}m${str}\x1b[0m` : String(str);

export const c = {
  bold: ansi("1"),
  dim: ansi("2"),
  red: ansi("31"),
  green: ansi("32"),
  yellow: ansi("33"),
  cyan: ansi("36"),
  gray: ansi("90"),
  bgRed: ansi("41;37;1"),
  bgGreen: ansi("42;30;1"),
  bgCyan: ansi("46;30;1"),
};

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function createLogger(suiteName) {
  const suiteStart = performance.now();

  console.log(
    `\n ${c.bgCyan(` ${suiteName} `)} ${c.dim("starting pipeline...")}\n`,
  );

  async function step(title, fn) {
    const start = performance.now();
    let frameIndex = 0;
    let subtext = "";
    let timer = null;

    const renderSpinner = () => {
      const frame = c.cyan(frames[frameIndex % frames.length]);
      const extra = subtext ? c.dim(` (${subtext})`) : "";
      process.stdout.write(`\r\x1b[2K ${frame} ${title}${extra}`);
      frameIndex++;
    };

    if (isTTY) {
      renderSpinner();
      timer = setInterval(renderSpinner, 80);
    } else {
      console.log(` ${c.cyan("❯")} ${title}...`);
    }

    const ctx = {
      update(text) {
        subtext = text;
        if (!isTTY) console.log(`   ${c.dim("↳ " + text)}`);
      },
    };

    try {
      const result = await fn(ctx);
      if (timer) clearInterval(timer);

      const duration = c.dim(formatDuration(performance.now() - start));
      const line = ` ${c.green("✓")} ${title} ${duration}`;
      process.stdout.write(isTTY ? `\r\x1b[2K${line}\n` : `${line}\n`);
      return result;
    } catch (err) {
      if (timer) clearInterval(timer);

      const duration = c.dim(formatDuration(performance.now() - start));
      const reason = err.missingVars?.length
        ? c.yellow(` → faltando: ${c.bold(err.missingVars.join(", "))}`)
        : c.dim(` → ${err.message}`);

      const line = ` ${c.red("❯")} ${c.red(title)}${reason} ${duration}`;
      process.stdout.write(isTTY ? `\r\x1b[2K${line}\n` : `${line}\n`);
      throw err;
    }
  }

  function requireEnv(keys) {
    const missing = keys.filter((key) => !process.env[key]?.trim());
    if (missing.length > 0) {
      const err = new Error(`Variáveis não definidas: ${missing.join(", ")}`);
      err.missingVars = missing;
      throw err;
    }
  }

  function summary() {
    const total = formatDuration(performance.now() - suiteStart);
    console.log(
      `\n ${c.bgGreen(" PASS ")} ${c.green("All checks & deployment steps succeeded")} ${c.dim(`(${total})`)}\n`,
    );
  }

  function fail(err) {
    const total = formatDuration(performance.now() - suiteStart);
    console.error(
      `\n ${c.bgRed(" FAIL ")} ${c.bold(c.red(err.message))} ${c.dim(`(${total})`)}\n`,
    );

    if (err.missingVars?.length) {
      for (const key of err.missingVars) {
        console.error(
          `   ${c.red("✖")} ${c.bold(key)} ${c.dim("(não definida ou vazia)")}`,
        );
      }
      console.error("");
    } else if (err.stderr) {
      console.error(c.dim(String(err.stderr).trim()) + "\n");
    }

    process.exitCode = 1;
  }

  return { step, requireEnv, summary, fail };
}
