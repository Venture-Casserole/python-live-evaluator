# Python Live Evaluator

A VSCode extension that provides live evaluation for Python with advanced features including explicit evaluation mode, rate limiting for APIs, and free-threaded Python support.

## ✨ Features

- 🚀 **Live Evaluation** - See Python code results as you type, inline with your code
- 🎯 **Explicit Mode** - Control exactly where results appear with comment markers
- ⏱️ **Rate Limiting** - Protect API quotas with configurable evaluation delays
- 🧵 **Free-threaded Python Support** - Full support for Python 3.13+ no-GIL builds
- 🔍 **Smart Block Detection** - Correctly handles functions, classes, loops, and indentation
- 📊 **Rich Output Display** - Shows variables, expressions, print outputs, and errors inline
- 🎨 **Customizable Markers** - Define your own comment markers for explicit mode
- 🐛 **Debug Mode** - Detailed logging for troubleshooting

## 📦 Installation

### Prerequisites

- VSCode 1.74.0 or higher
- Python 3.6 or higher
- Microsoft Python extension (`ms-python.python`)

### Install from VSIX

```bash
code --install-extension python-live-evaluator-*.vsix
```

### Build from Source

```bash
git clone <repository>
cd python-live-evaluator
npm install
# Press F5 in VSCode to run
```

## 🚀 Quick Start

1. **Open any Python file** - The extension activates automatically
2. **Start typing** - See results appear inline as you code
3. **Use markers in explicit mode** - Add `# ?` to any line to see its result

### Basic Example

```python
x = 10          # x: 10
y = 20          # x: 10, y: 20
z = x + y       # x: 10, y: 20, z: 30
z               # → 30
print("Hello")  # ▶ Hello
```

## ⚙️ Configuration Settings

All settings are prefixed with `pythonLiveEvaluator.` in your VSCode settings.

### Core Settings

| Setting                 | Type                   | Default          | Description                                                                                                   |
| ----------------------- | ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **`evaluationMode`**    | `"auto" \| "explicit"` | `"explicit"`     | **Evaluation display mode**<br>• `auto`: Show results on all lines<br>• `explicit`: Only show on marked lines |
| **`evaluationMarkers`** | `string[]`             | `["# ?", "# /"]` | Comment markers that trigger display in explicit mode                                                         |
| **`autoStart`**         | `boolean`              | `true`           | Automatically start evaluation when opening Python files                                                      |
| **`debug`**             | `boolean`              | `false`          | Enable detailed debug output in the Output panel                                                              |

### Performance Settings

| Setting                    | Type      | Default | Range   | Description                                                                     |
| -------------------------- | --------- | ------- | ------- | ------------------------------------------------------------------------------- |
| **`debounceDelay`**        | `number`  | `300`   | 0-5000  | Milliseconds to wait after typing stops before evaluating                       |
| **`evaluationDelay`**      | `number`  | `0`     | 0-10000 | Milliseconds to wait between evaluating each code block (for rate-limited APIs) |
| **`showWaitingIndicator`** | `boolean` | `true`  | -       | Show "⏳ waiting..." when evaluation delay ≥ 1000ms                             |

### Display Settings

| Setting                    | Type      | Default | Range   | Description                                                |
| -------------------------- | --------- | ------- | ------- | ---------------------------------------------------------- |
| **`maxOutputLength`**      | `number`  | `200`   | 50-1000 | Maximum characters for inline output display               |
| **`showThreadingMetrics`** | `boolean` | `true`  | -       | Show special decorations for threading/performance metrics |

## 🎯 Evaluation Modes

### Auto Mode

Shows results on all lines automatically:

```json
{
  "pythonLiveEvaluator.evaluationMode": "auto"
}
```

```python
x = 10      # // x: 10
y = 20      # // x: 10, y: 20
z = x + y   # // x: 10, y: 20, z: 30
```

### Explicit Mode (Default)

Only shows results on lines with markers:

```json
{
  "pythonLiveEvaluator.evaluationMode": "explicit",
  "pythonLiveEvaluator.evaluationMarkers": ["# ?", "# /"]
}
```

```python
x = 10      # No output
y = 20      # No output
z = x + y   # ?  Shows: // z: 30
print(z)    # /  Shows: ▶ 30
```

## 🔧 Custom Evaluation Markers

Create your own marker convention:

```json
{
  "pythonLiveEvaluator.evaluationMarkers": [
    "# check",
    "# show",
    "# debug",
    "# !"
  ]
}
```

```python
result = calculate()  # check
api_response = fetch()  # debug
final_value = process()  # show
```

## ⏱️ Rate Limiting for APIs

Protect your API quotas with evaluation delays:

```json
{
  "pythonLiveEvaluator.evaluationDelay": 1000, // 1 second between blocks
  "pythonLiveEvaluator.showWaitingIndicator": true
}
```

### Recommended Delays by Service

| API Service      | Recommended Delay | Notes              |
| ---------------- | ----------------- | ------------------ |
| OpenAI GPT       | 1000-2000ms       | Varies by tier     |
| Anthropic Claude | 500-1000ms        | Moderate limits    |
| Google Cloud     | 100-500ms         | Higher limits      |
| Twitter/X API    | 3000-5000ms       | Very strict        |
| Local/Database   | 0-100ms           | Prevent exhaustion |

## 🧵 Free-threaded Python Support

The extension automatically detects and supports Python 3.13+ free-threaded (no-GIL) builds:

### Check GIL Status

Command: `Python Live: Show GIL Status`

### Threading Demo

Command: `Python Live: Insert Threading Demo`

### Visual Indicators

- 🟢 **Green**: Threading information
- 🟠 **Orange**: Performance metrics
- 🚀 **Status bar**: Shows "Free-threaded mode" when detected

## 📝 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                              | Description                         | Keyboard Shortcut           |
| ------------------------------------ | ----------------------------------- | --------------------------- |
| `Python Live: Start Evaluation`      | Start live evaluation               | `Ctrl+Shift+P Ctrl+Shift+S` |
| `Python Live: Stop Evaluation`       | Stop live evaluation                | `Ctrl+Shift+P Ctrl+Shift+X` |
| `Python Live: Clear Results`         | Clear all inline decorations        | -                           |
| `Python Live: Show GIL Status`       | Check if using free-threaded Python | `Ctrl+Shift+P Ctrl+Shift+G` |
| `Python Live: Insert Threading Demo` | Insert example threading code       | -                           |

## 🎨 Visual Indicators

| Indicator       | Meaning            | Example                  |
| --------------- | ------------------ | ------------------------ |
| `// var: value` | Variable values    | `// x: 10, y: 20`        |
| `→ result`      | Expression result  | `→ 30`                   |
| `▶ output`      | Print output       | `▶ Hello World`          |
| `⚠ error`       | Error message      | `⚠ NameError: undefined` |
| `🧵 threads`    | Threading info     | `🧵 Active threads: 5`   |
| `⚡ metric`     | Performance metric | `⚡ Time: 0.5s`          |
| `⏳ waiting`    | Evaluation delay   | `⏳ waiting 1000ms...`   |

## 🐛 Debug Mode

Enable detailed logging for troubleshooting:

```json
{
  "pythonLiveEvaluator.debug": true
}
```

View output: `View → Output → Select "Python Live Evaluator"`

Debug output shows:

- Evaluation mode and settings
- Marked line detection (explicit mode)
- Block parsing details
- Decoration decisions
- Timing information
- Error details

## 💡 Usage Examples

### Example 1: API Development with Rate Limiting

```json
{
  "pythonLiveEvaluator.evaluationMode": "explicit",
  "pythonLiveEvaluator.evaluationDelay": 1000
}
```

```python
import openai

# Setup - no decoration
client = openai.Client(api_key="...")

# Only check specific calls
response = client.chat.completions.create(...)  # ?
print(response.choices[0].message)  # ?
```

### Example 2: Teaching with Explicit Markers

```python
# Students work through the code
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

# Check understanding at key points
factorial(5)  # ?  → 120
factorial(10)  # ?  → 3628800
```

### Example 3: Data Science Exploration

```json
{
  "pythonLiveEvaluator.evaluationMode": "auto"
}
```

```python
import pandas as pd
df = pd.read_csv('data.csv')  # // df: <DataFrame>
df.shape  # → (1000, 5)
df.columns.tolist()  # → ['id', 'name', 'value', ...]
df.describe()  # → <statistics>
```

## 🔍 Troubleshooting

### No decorations appearing

1. Check evaluation mode in settings
2. In explicit mode, ensure you have markers (`# ?`)
3. Check Output panel for errors
4. Verify Python interpreter is selected

### Decorations on wrong lines

1. Enable debug mode to see block parsing
2. Check indentation is consistent
3. Ensure markers are properly formatted

### Performance issues

1. Increase `debounceDelay` (try 1000ms)
2. Add `evaluationDelay` for API calls
3. Use explicit mode to reduce decorations
4. Check for infinite loops in code

### API rate limits

1. Increase `evaluationDelay` (start with 2000ms)
2. Use explicit mode to evaluate less frequently
3. Watch for rate limit warnings in output

## 🏗️ Project Structure

```
python-live-evaluator/
├── extension.js        # Main extension code
├── package.json        # Extension manifest
├── README.md          # This file
├── CHANGELOG.md       # Version history
├── LICENSE            # MIT License
└── .vscode/
    └── launch.json    # Debug configuration
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/Venture-Casserole/python-live-evaluator/issues)

## 🌟 Tips

1. **Start with explicit mode** for cleaner display
2. **Use rate limiting** when working with APIs
3. **Enable debug mode** when troubleshooting
4. **Customize markers** to match your workflow
5. **Check GIL status** for threading performance

---

**Enjoy live Python evaluation!** 🐍✨
