// extension.js
const vscode = require("vscode");
const { spawn } = require("child_process");

class PythonLiveEvaluator {
  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        textDecoration: "none",
      },
    });

    this.errorDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        textDecoration: "none",
        color: "#ff6b6b",
      },
      backgroundColor: "rgba(255, 0, 0, 0.1)",
    });

    this.threadingDecorationType = vscode.window.createTextEditorDecorationType(
      {
        after: {
          margin: "0 0 0 1em",
          textDecoration: "none",
          color: "#66bb6a",
          fontStyle: "italic",
        },
      }
    );

    this.performanceDecorationType =
      vscode.window.createTextEditorDecorationType({
        after: {
          margin: "0 0 0 1em",
          textDecoration: "none",
          color: "#ffa726",
          fontWeight: "bold",
        },
      });

    this.waitingDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: "0 0 0 1em",
        textDecoration: "none",
        color: "#808080",
        fontStyle: "italic",
      },
    });

    this.outputChannel = vscode.window.createOutputChannel(
      "Python Live Evaluator"
    );
    this.evaluationResults = new Map();
    this.debounceTimer = null;
    this.pythonPath = null;
    this.isFreethreaded = false;
    this.cumulativeCode = [];
    this.isEvaluating = false;
  }

  async activate(context) {
    const pythonExt = vscode.extensions.getExtension("ms-python.python");
    if (!pythonExt) {
      vscode.window.showErrorMessage(
        "Python Live Evaluator requires the Microsoft Python extension. Please install it first."
      );
      return;
    }
    if (!pythonExt.isActive) {
      await pythonExt.activate();
    }
    this.pythonApi = pythonExt.exports;
    let startCommand = vscode.commands.registerCommand(
      "pythonLiveEvaluator.start",
      () => {
        this.startEvaluation();
      }
    );

    let stopCommand = vscode.commands.registerCommand(
      "pythonLiveEvaluator.stop",
      () => {
        this.stopEvaluation();
      }
    );

    let clearCommand = vscode.commands.registerCommand(
      "pythonLiveEvaluator.clear",
      () => {
        this.clearDecorations();
        this.cumulativeCode = [];
      }
    );

    let showGilStatusCommand = vscode.commands.registerCommand(
      "pythonLiveEvaluator.showGilStatus",
      () => {
        this.showGilStatus();
      }
    );

    let runThreadingDemoCommand = vscode.commands.registerCommand(
      "pythonLiveEvaluator.runThreadingDemo",
      () => {
        this.insertThreadingDemo();
      }
    );

    context.subscriptions.push(
      startCommand,
      stopCommand,
      clearCommand,
      showGilStatusCommand,
      runThreadingDemoCommand
    );
    context.subscriptions.push(this.outputChannel);

    if (vscode.window.activeTextEditor?.document.languageId === "python") {
      this.startEvaluation();
    }

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === "python") {
        this.startEvaluation();
      } else {
        this.stopEvaluation();
      }
    });

    this.pythonApi.environments.onDidChangeActiveEnvironmentPath(() => {
      this.updatePythonPath();
      if (this.changeListener) {
        this.evaluateDocument(vscode.window.activeTextEditor?.document);
      }
    });
  }

  async updatePythonPath() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const environment = await this.pythonApi.environments.resolveEnvironment(
      this.pythonApi.environments.getActiveEnvironmentPath(workspaceFolder?.uri)
    );

    if (environment) {
      this.pythonPath = environment.executable.uri?.fsPath || "python";
      this.outputChannel.appendLine(
        `Using Python interpreter: ${this.pythonPath}`
      );

      await this.checkFreethreadedPython();
    } else {
      this.pythonPath = "python";
    }
  }

  async checkFreethreadedPython() {
    return new Promise((resolve) => {
      const checkCode = `
import sys
import sysconfig
gil_disabled = sysconfig.get_config_var("Py_GIL_DISABLED")
print(f"GIL_DISABLED:{gil_disabled}")
print(f"VERSION:{sys.version}")
`;
      const python = spawn(this.pythonPath, ["-c", checkCode]);
      let output = "";

      python.stdout.on("data", (data) => {
        output += data.toString();
      });

      python.on("close", () => {
        this.isFreethreaded = output.includes("GIL_DISABLED:1");
        const version = output.match(/VERSION:(.*)/)?.[1] || "Unknown";

        if (this.isFreethreaded) {
          vscode.window.showInformationMessage(
            `🚀 Free-threaded Python detected! Version: ${version.trim()}`
          );
          this.outputChannel.appendLine(
            `Free-threaded Python (no-GIL) detected: ${version}`
          );
        } else {
          this.outputChannel.appendLine(`Standard Python with GIL: ${version}`);
        }
        resolve();
      });
    });
  }

  async showGilStatus() {
    await this.checkFreethreadedPython();
    const status = this.isFreethreaded
      ? "✅ Free-threaded Python (GIL disabled) - True parallelism enabled!"
      : "⚠️ Standard Python (GIL enabled) - Threading limited to I/O parallelism";

    vscode.window.showInformationMessage(status);
  }

  insertThreadingDemo() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const demoCode = `
import threading
import time
import sys
import sysconfig

gil_disabled = sysconfig.get_config_var("Py_GIL_DISABLED")
print(f"GIL Disabled: {gil_disabled == 1}")
print(f"Python Version: {sys.version}\\n")

def cpu_intensive_task(n, thread_id):
    """Compute prime numbers up to n"""
    start = time.perf_counter()
    primes = []
    for num in range(2, n):
        if all(num % i != 0 for i in range(2, int(num ** 0.5) + 1)):
            primes.append(num)
    elapsed = time.perf_counter() - start
    print(f"Thread {thread_id}: Found {len(primes)} primes in {elapsed:.3f}s")
    return primes

print("=" * 50)
print("Threaded Execution (4 threads)")
threads = []
start_threaded = time.perf_counter()

for i in range(4):
    t = threading.Thread(target=cpu_intensive_task, args=(10000, f"thread-{i}"))
    threads.append(t)
    t.start()

for t in threads:
    t.join()

threaded_time = time.perf_counter() - start_threaded
print(f"Total time: {threaded_time:.3f}s")
`;

    editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, demoCode);
    });

    vscode.window.showInformationMessage(
      "Threading demo inserted. Save and watch the live evaluation!"
    );
  }

  async startEvaluation() {
    await this.updatePythonPath();

    this.outputChannel.appendLine("Starting Python Live Evaluator...");
    this.outputChannel.appendLine(`Python interpreter: ${this.pythonPath}`);
    this.outputChannel.appendLine(`Free-threaded mode: ${this.isFreethreaded}`);

    const config = vscode.workspace.getConfiguration("pythonLiveEvaluator");
    const evaluationMode = config.get("evaluationMode", "auto");
    this.outputChannel.appendLine(`Evaluation mode: ${evaluationMode}`);

    this.cumulativeCode = [];

    this.clearDecorations();

    this.changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        event.document === vscode.window.activeTextEditor?.document &&
        event.document.languageId === "python"
      ) {
        this.scheduleEvaluation(event.document);
      }
    });

    this.configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("pythonLiveEvaluator.evaluationMode") ||
        event.affectsConfiguration("pythonLiveEvaluator.evaluationMarkers")
      ) {
        this.clearDecorations();

        if (vscode.window.activeTextEditor?.document.languageId === "python") {
          this.evaluateDocument(vscode.window.activeTextEditor.document);
        }
      }
    });

    if (vscode.window.activeTextEditor) {
      this.evaluateDocument(vscode.window.activeTextEditor.document);
    }

    const statusMsg = this.isFreethreaded
      ? "Python Live Evaluator started (Free-threaded mode 🚀)"
      : "Python Live Evaluator started";
    vscode.window.showInformationMessage(statusMsg);
  }

  stopEvaluation() {
    if (this.changeListener) {
      this.changeListener.dispose();
      this.changeListener = null;
    }
    if (this.configListener) {
      this.configListener.dispose();
      this.configListener = null;
    }
    this.clearDecorations();
    this.cumulativeCode = [];
    vscode.window.showInformationMessage("Python Live Evaluator stopped");
  }

  scheduleEvaluation(document) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const delay = vscode.workspace
      .getConfiguration("pythonLiveEvaluator")
      .get("debounceDelay", 300);
    this.debounceTimer = setTimeout(() => {
      this.evaluateDocument(document);
    }, delay);
  }

  async evaluateDocument(document) {
    if (!document) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) return;

    if (this.isEvaluating) {
      this.outputChannel.appendLine(
        "[DEBUG] Skipping evaluation - already in progress"
      );
      return;
    }

    this.isEvaluating = true;

    this.outputChannel.appendLine("[DEBUG] Clearing all decorations");
    this.clearDecorations();

    const code = document.getText();
    const lines = code.split("\n");

    const decorations = [];
    const errorDecorations = [];
    const threadingDecorations = [];
    const performanceDecorations = [];

    this.cumulativeCode = [];

    const config = vscode.workspace.getConfiguration("pythonLiveEvaluator");
    const debug = config.get("debug", true);
    const evaluationDelay = config.get("evaluationDelay", 0);
    const showWaitingIndicator = config.get("showWaitingIndicator", true);
    const evaluationMode = String(config.get("evaluationMode", "explicit"));
    const evaluationMarkers = config.get("evaluationMarkers", ["# ?", "# /"]);

    this.outputChannel.appendLine("========================================");
    this.outputChannel.appendLine("[DEBUG] Starting evaluation");
    this.outputChannel.appendLine(`[DEBUG] Mode: ${evaluationMode}`);
    this.outputChannel.appendLine(
      `[DEBUG] Markers: ${evaluationMarkers.join(", ")}`
    );
    this.outputChannel.appendLine(`[DEBUG] Total lines: ${lines.length}`);

    const markedLines = new Set();

    if (evaluationMode === "explicit") {
      this.outputChannel.appendLine(
        "[DEBUG] EXPLICIT MODE - Looking for markers..."
      );

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let foundMarker = null;

        for (const marker of evaluationMarkers) {
          if (line.includes(marker)) {
            foundMarker = marker;
            markedLines.add(i);
            break;
          }
        }

        if (foundMarker) {
          this.outputChannel.appendLine(
            `[DEBUG] Line ${i} has marker "${foundMarker}": ${line.substring(
              0,
              50
            )}`
          );
        }
      }

      this.outputChannel.appendLine(
        `[DEBUG] Total marked lines: ${markedLines.size}`
      );

      if (markedLines.size === 0) {
        this.outputChannel.appendLine(
          "[DEBUG] NO MARKERS FOUND - No decorations will be shown"
        );
        this.isEvaluating = false;
        return;
      }
    } else {
      this.outputChannel.appendLine(
        "[DEBUG] AUTO MODE - Will show all decorations"
      );
    }

    const blocks = this.parseIntoBlocks(lines);
    this.outputChannel.appendLine(`[DEBUG] Parsed ${blocks.length} blocks`);

    let statusBarItem = null;
    if (evaluationDelay > 0 && blocks.length > 0) {
      statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      statusBarItem.text = `$(sync~spin) Python Live: Evaluating...`;
      statusBarItem.show();
    }

    try {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (!block.code.trim()) continue;

        this.outputChannel.appendLine(
          `[DEBUG] Block ${i + 1}: lines ${block.startLine}-${block.endLine}`
        );

        if (statusBarItem) {
          statusBarItem.text = `$(sync~spin) Python Live: Block ${i + 1}/${
            blocks.length
          }`;
        }

        if (evaluationDelay > 0 && i > 0) {
          await this.delay(evaluationDelay);
        }

        const codeToEval =
          this.cumulativeCode.join("\n") +
          (this.cumulativeCode.length > 0 ? "\n" : "") +
          block.code;

        const result = await this.evaluatePythonCode(
          codeToEval,
          block.code,
          block.endLine
        );

        if (result.success) {
          this.cumulativeCode.push(block.code);

          if (evaluationMode === "explicit") {
            this.outputChannel.appendLine(
              `[DEBUG] EXPLICIT: Checking block ${i + 1} for marked lines...`
            );

            let addedDecoration = false;
            for (
              let lineIdx = block.startLine;
              lineIdx <= block.endLine;
              lineIdx++
            ) {
              if (markedLines.has(lineIdx)) {
                this.outputChannel.appendLine(
                  `[DEBUG] EXPLICIT: Adding decoration to marked line ${lineIdx}`
                );

                const lineContent = lines[lineIdx].trim();
                const cleanLine = lineContent.split("#")[0].trim();
                let decorationText = "";

                const isExpression =
                  cleanLine &&
                  !cleanLine.includes("=") &&
                  !cleanLine.startsWith("def ") &&
                  !cleanLine.startsWith("class ") &&
                  !cleanLine.startsWith("import ") &&
                  !cleanLine.startsWith("from ") &&
                  !cleanLine.startsWith("print");

                if (isExpression) {
                  if (result.variables && result.variables[cleanLine]) {
                    decorationText = ` → ${result.variables[cleanLine]}`;
                  } else if (result.expression && lineIdx === block.endLine) {
                    decorationText = ` → ${result.expression}`;
                  } else {
                    if (
                      result.variables &&
                      Object.keys(result.variables).length > 0
                    ) {
                      const varDisplay = Object.entries(result.variables)
                        .slice(-3)
                        .map(([k, v]) => {
                          const val =
                            v.length > 30 ? v.substring(0, 27) + "..." : v;
                          return `${k}: ${val}`;
                        })
                        .join(", ");
                      decorationText = ` // ${varDisplay}`;
                    }
                  }
                } else if (cleanLine.includes("print")) {
                  if (result.output) {
                    const lines = result.output.split("\n");
                    decorationText = ` ▶ ${
                      result.print_outputs[lines.length - 1].text
                    }`;
                    this.outputChannel.appendLine(
                      `[DEBUG] Print output for line ${lineIdx}: "${
                        result.print_outputs[lines.length - 1].text
                      }"`
                    );
                  } else if (
                    result.print_outputs &&
                    result.print_outputs.length > 0
                  ) {
                    const lastPrint =
                      result.print_outputs[result.print_outputs.length - 1];
                    decorationText = ` ▶ ${lastPrint.text}`;
                    this.outputChannel.appendLine(
                      `[DEBUG] Using print_outputs for line ${lineIdx}: "${lastPrint.text}"`
                    );
                  }
                } else {
                  if (
                    result.variables &&
                    Object.keys(result.variables).length > 0
                  ) {
                    if (cleanLine.includes("=")) {
                      const varName = cleanLine.split("=")[0].trim();
                      if (result.variables[varName]) {
                        decorationText = ` // ${varName}: ${result.variables[varName]}`;
                      } else {
                        const varDisplay = Object.entries(result.variables)
                          .slice(-3)
                          .map(([k, v]) => {
                            const val =
                              v.length > 30 ? v.substring(0, 27) + "..." : v;
                            return `${k}: ${val}`;
                          })
                          .join(", ");
                        decorationText = ` // ${varDisplay}`;
                      }
                    } else {
                      const varDisplay = Object.entries(result.variables)
                        .slice(-3)
                        .map(([k, v]) => {
                          const val =
                            v.length > 30 ? v.substring(0, 27) + "..." : v;
                          return `${k}: ${val}`;
                        })
                        .join(", ");
                      decorationText = ` // ${varDisplay}`;
                    }
                  }
                }

                if (decorationText) {
                  decorations.push({
                    range: new vscode.Range(lineIdx, 1000, lineIdx, 1000),
                    renderOptions: {
                      after: {
                        contentText: decorationText,
                        color: "#4fc3f7",
                      },
                    },
                  });
                  addedDecoration = true;
                  this.outputChannel.appendLine(
                    `[DEBUG] EXPLICIT: Added decoration: "${decorationText}"`
                  );
                } else {
                  this.outputChannel.appendLine(
                    `[DEBUG] EXPLICIT: No decoration text generated for line ${lineIdx}`
                  );
                }
              }
            }

            if (!addedDecoration) {
              this.outputChannel.appendLine(
                `[DEBUG] EXPLICIT: No marked lines in this block - NO DECORATION ADDED`
              );
            }
          } else if (evaluationMode === "auto") {
            this.outputChannel.appendLine(
              `[DEBUG] AUTO: Adding decoration to line ${block.endLine}`
            );

            const decorationLine = block.endLine;

            if (result.variables && Object.keys(result.variables).length > 0) {
              const varDisplay = Object.entries(result.variables)
                .slice(-5)
                .map(([k, v]) => {
                  const val = v.length > 50 ? v.substring(0, 47) + "..." : v;
                  return `${k}: ${val}`;
                })
                .join(", ");

              decorations.push({
                range: new vscode.Range(
                  decorationLine,
                  1000,
                  decorationLine,
                  1000
                ),
                renderOptions: {
                  after: {
                    contentText: ` // ${varDisplay}`,
                    color: "#9e9e9e",
                  },
                },
              });
            }

            if (result.expression) {
              decorations.push({
                range: new vscode.Range(
                  decorationLine,
                  1000,
                  decorationLine,
                  1000
                ),
                renderOptions: {
                  after: {
                    contentText: ` → ${result.expression}`,
                    color: "#4fc3f7",
                  },
                },
              });
            }

            if (result.output) {
              decorations.push({
                range: new vscode.Range(
                  decorationLine,
                  1000,
                  decorationLine,
                  1000
                ),
                renderOptions: {
                  after: {
                    contentText: ` ▶ ${result.output}`,
                    color: "#4fc3f7",
                  },
                },
              });
            }
          } else {
            this.outputChannel.appendLine(
              `[DEBUG] Unknown mode: ${evaluationMode}`
            );
          }
        } else if (result.error) {
          this.outputChannel.appendLine(
            `[DEBUG] Error in block: ${result.error}`
          );

          if (evaluationMode === "explicit") {
            for (
              let lineIdx = block.startLine;
              lineIdx <= block.endLine;
              lineIdx++
            ) {
              if (markedLines.has(lineIdx)) {
                this.outputChannel.appendLine(
                  `[DEBUG] EXPLICIT: Adding error to marked line ${lineIdx}`
                );
                errorDecorations.push({
                  range: new vscode.Range(lineIdx, 1000, lineIdx, 1000),
                  renderOptions: {
                    after: {
                      contentText: ` ⚠ ${result.error}`,
                    },
                  },
                });
                break;
              }
            }
          } else if (evaluationMode === "auto") {
            errorDecorations.push({
              range: new vscode.Range(block.endLine, 1000, block.endLine, 1000),
              renderOptions: {
                after: {
                  contentText: ` ⚠ ${result.error}`,
                },
              },
            });
          }
        }
      }
    } finally {
      if (statusBarItem) {
        statusBarItem.dispose();
      }
      this.isEvaluating = false;
    }

    this.outputChannel.appendLine(
      `[DEBUG] Applying decorations: ${decorations.length} normal, ${errorDecorations.length} errors`
    );

    editor.setDecorations(this.decorationType, decorations);
    editor.setDecorations(this.errorDecorationType, errorDecorations);
    editor.setDecorations(this.threadingDecorationType, threadingDecorations);
    editor.setDecorations(
      this.performanceDecorationType,
      performanceDecorations
    );

    this.outputChannel.appendLine("[DEBUG] Evaluation complete");
    this.outputChannel.appendLine("========================================");
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  parseIntoBlocks(lines) {
    const blocks = [];
    let currentBlock = [];
    let blockStartLine = 0;
    let inBlock = false;
    let baseIndent = 0;

    const config = vscode.workspace.getConfiguration("pythonLiveEvaluator");
    const evaluationMode = String(config.get("evaluationMode", "explicit"));
    const evaluationMarkers = config.get("evaluationMarkers", ["# ?", "# /"]);

    const lineHasMarker = (line) => {
      return evaluationMarkers.some((marker) => line.includes(marker));
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (
        !trimmedLine ||
        (trimmedLine.startsWith("#") &&
          !lineHasMarker(trimmedLine) &&
          currentBlock.length === 0)
      ) {
        continue;
      }

      const indent = line.length - line.trimStart().length;

      const startsBlock =
        trimmedLine.endsWith(":") &&
        (trimmedLine.startsWith("def ") ||
          trimmedLine.startsWith("class ") ||
          trimmedLine.startsWith("if ") ||
          trimmedLine.startsWith("elif ") ||
          trimmedLine.startsWith("else") ||
          trimmedLine.startsWith("for ") ||
          trimmedLine.startsWith("while ") ||
          trimmedLine.startsWith("with ") ||
          trimmedLine.startsWith("try:") ||
          trimmedLine.startsWith("except") ||
          trimmedLine.startsWith("finally:"));

      if (startsBlock) {
        if (currentBlock.length > 0) {
          blocks.push({
            code: currentBlock.join("\n"),
            startLine: blockStartLine,
            endLine: i - 1,
          });
        }

        currentBlock = [line];
        blockStartLine = i;
        inBlock = true;
        baseIndent = indent;
      } else if (inBlock) {
        if (indent > baseIndent || !trimmedLine) {
          currentBlock.push(line);
        } else {
          blocks.push({
            code: currentBlock.join("\n"),
            startLine: blockStartLine,
            endLine: i - 1,
          });

          currentBlock = [line];
          blockStartLine = i;
          inBlock = false;
        }
      } else {
        if (evaluationMode === "explicit" && lineHasMarker(line)) {
          if (currentBlock.length > 0) {
            blocks.push({
              code: currentBlock.join("\n"),
              startLine: blockStartLine,
              endLine: i - 1,
            });
          }
          blocks.push({
            code: line,
            startLine: i,
            endLine: i,
          });
          currentBlock = [];
          blockStartLine = i + 1;
        } else if (currentBlock.length > 0 && indent === 0) {
          blocks.push({
            code: currentBlock.join("\n"),
            startLine: blockStartLine,
            endLine: i - 1,
          });
          currentBlock = [line];
          blockStartLine = i;
        } else {
          if (currentBlock.length === 0) {
            blockStartLine = i;
          }
          currentBlock.push(line);
        }
      }
    }

    if (currentBlock.length > 0) {
      blocks.push({
        code: currentBlock.join("\n"),
        startLine: blockStartLine,
        endLine: lines.length - 1,
      });
    }

    const debug = config.get("debug", false);
    if (debug) {
      this.outputChannel.appendLine("[DEBUG] Block parsing results:");
      blocks.forEach((block, idx) => {
        this.outputChannel.appendLine(
          `[DEBUG]   Block ${idx + 1}: lines ${block.startLine}-${
            block.endLine
          }, code: "${block.code.substring(0, 50)}..."`
        );
      });
    }

    return blocks;
  }

  evaluatePythonCode(fullCode, currentBlock, lineNumber) {
    return new Promise((resolve) => {
      const pythonCode = `
import sys
import io
import json
import ast
import traceback

old_stdout = sys.stdout
sys.stdout = io.StringIO()

result = {
    'success': False,
    'variables': {},
    'expression': None,
    'output': None,
    'error': None,
    'print_outputs': []
}

_print_counter = 0
_original_print = print

def print(*args, **kwargs):
    global _print_counter
    output = io.StringIO()
    _original_print(*args, file=output, **kwargs)
    output_text = output.getvalue().rstrip()
    result['print_outputs'].append({
        'index': _print_counter,
        'text': output_text
    })
    _print_counter += 1
    _original_print(*args, **kwargs)
    output.close()

try:
    exec(${JSON.stringify(fullCode)})

    local_vars = {}
    locals_snapshot = list(locals().items())

    for k, v in locals_snapshot:
        if not k.startswith('_') and k not in ['sys', 'io', 'json', 'ast', 'traceback', 'old_stdout', 'result', 'local_vars', 'locals_snapshot', 'k', 'v', 'print']:
            try:
                if callable(v):
                    if hasattr(v, '__name__'):
                        local_vars[k] = f'<function {v.__name__}>'
                    elif hasattr(v, '__class__'):
                        local_vars[k] = f'<{v.__class__.__name__} object>'
                    else:
                        local_vars[k] = '<callable>'
                else:
                    val_repr = repr(v)
                    if len(val_repr) > 100:
                        val_repr = val_repr[:97] + '...'
                    local_vars[k] = val_repr
            except Exception as e:
                local_vars[k] = f'<{type(v).__name__}>'

    current_block = ${JSON.stringify(currentBlock.trim())}
    block_lines = current_block.split('\\n')

    if len(block_lines) == 1:
        line = block_lines[0].strip()
        if line and not any(line.startswith(kw + ' ') for kw in ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'with', 'try', 'import', 'from', 'return', 'raise', 'assert', 'del', 'pass', 'break', 'continue', 'global', 'nonlocal', 'yield']):
            import re
            simple_assignment = re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*[^=]', line)

            if not simple_assignment:
                try:
                    expr_result = eval(line)
                    if expr_result is not None:
                        expr_repr = repr(expr_result)
                        if len(expr_repr) > 200:
                            expr_repr = expr_repr[:197] + '...'
                        result['expression'] = expr_repr
                except:
                    pass

    result['success'] = True
    result['variables'] = local_vars

except SyntaxError as e:
    result['error'] = f"Syntax Error: {str(e).split(' (', 1)[0]}"
except NameError as e:
    result['error'] = f"Name Error: {str(e)}"
except IndentationError as e:
    result['error'] = f"Indentation Error: {str(e)}"
except RuntimeError as e:
    result['error'] = f"Runtime Error: {str(e)}"
except Exception as e:
    error_msg = str(e)
    if len(error_msg) > 100:
        error_msg = error_msg[:97] + '...'
    result['error'] = f"{type(e).__name__}: {error_msg}"

output = sys.stdout.getvalue()
if output:
    lines = output.strip().split('\\n')
    if len(lines) > 10:
        result['output'] = '\\n'.join(lines[:10]) + f'\\n... ({len(lines)-10} more lines)'
    else:
        result['output'] = output.strip()

sys.stdout = old_stdout

print(json.dumps(result))
`;

      const python = spawn(this.pythonPath || "python", ["-c", pythonCode]);
      let output = "";
      let error = "";
      let timeout = null;

      python.stdout.on("data", (data) => {
        output += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (timeout) clearTimeout(timeout);

        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          const debug = vscode.workspace
            .getConfiguration("pythonLiveEvaluator")
            .get("debug", false);

          if (debug) {
            this.outputChannel.appendLine(
              `Failed to parse output: ${output.substring(0, 200)}`
            );
            if (error) {
              this.outputChannel.appendLine(
                `Stderr: ${error.substring(0, 200)}`
              );
            }
          }

          if (error) {
            const lines = error.split("\n");
            let errorMsg = lines.find((l) => l.includes("Error")) || lines[0];
            resolve({
              success: false,
              error: errorMsg.trim(),
            });
          } else if (output.trim()) {
            resolve({
              success: false,
              error: `Invalid output: ${output.substring(0, 100)}`,
            });
          } else {
            resolve({
              success: false,
              error: "No output from evaluation",
            });
          }
        }
      });

      python.on("error", (err) => {
        if (timeout) clearTimeout(timeout);
        resolve({
          success: false,
          error: `Python process error: ${err.message}`,
        });
      });

      timeout = setTimeout(() => {
        python.kill();
        resolve({
          success: false,
          error: "Evaluation timeout (5s)",
        });
      }, 5000);
    });
  }

  clearDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this.decorationType, []);
      editor.setDecorations(this.errorDecorationType, []);
      editor.setDecorations(this.threadingDecorationType, []);
      editor.setDecorations(this.performanceDecorationType, []);
      editor.setDecorations(this.waitingDecorationType, []);
    }
    this.evaluationResults.clear();
    this.cumulativeCode = [];
  }

  deactivate() {
    this.stopEvaluation();
    this.outputChannel.dispose();
  }
}

function activate(context) {
  const evaluator = new PythonLiveEvaluator();
  evaluator.activate(context);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
