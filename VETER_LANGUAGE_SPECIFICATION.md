# Veter Language Specification 1.0
**Draft standard for the Veter programming language**  
**Project:** Veter  
**File extension:** `.vtr`  
**Status:** Proposed language specification — not a claim that every feature is implemented  
**Date:** 1 November 2026

---

## 1. Purpose and scope

This document defines a consistent design for Veter source files, syntax, types, execution, errors, modules, libraries, tools, and compatibility.

Veter is an independently designed programming language. It is not Python, Java, JavaScript, C++, or HTML with renamed keywords. Its syntax should remain readable and distinctive.

This specification separates:

- **Implemented prototype behaviour:** commands found in the supplied Veter Native Runtime 1.0 source.
- **Proposed standard behaviour:** rules that should be adopted to make the language consistent and implementable.

A feature must not be advertised as implemented until the compiler/runtime supports it and tests pass.

## 2. Language identity and implementation

| Item | Standard |
|---|---|
| Language name | Veter |
| Source extension | `.vtr` |
| Specification version | 1.0 (proposed) |
| Character encoding | UTF-8 |
| Line endings | LF or CRLF |
| Case sensitivity | Keywords and identifiers are case-sensitive |
| Comments | `#` to end of line |
| Native runtime in supplied prototype | C++ source using Win32 API on Windows |
| C++ implementation standard | C++20 in the current prototype build |
| Language implementation | Independent Veter parser/compiler/runtime |

C++20 describes the implementation technology, not the syntax or semantics of Veter programs.

## 3. Design principles

1. Readability before punctuation-heavy syntax.
2. Consistent grammar and predictable behaviour.
3. Clear, useful errors with source locations.
4. Safe defaults for files, networking, and external processes.
5. Portable language semantics where possible; platform features belong in libraries.
6. Backward compatibility within a declared major version.
7. No feature is part of the standard merely because a prototype happens to accept it.

## 4. Source-file structure

A source file is UTF-8 text containing zero or more statements, one statement per line in the initial language profile.

Blank lines are ignored. A line whose first non-whitespace character is `#` is a comment.

Proposed future multi-line blocks must use a single documented block convention consistently. The first 1.0 profile should not mix indentation-based blocks with brace-based blocks.

Example:

```vtr
# A comment
make a website called "My First Site"
set page title "Welcome to Veter"
show a title "Hello from Veter!"
```

## 5. Lexical rules

### 5.1 Identifiers

Proposed identifier form:

- First character: ASCII letter or underscore.
- Remaining characters: ASCII letters, digits, or underscore.
- Identifiers are case-sensitive.
- Reserved keywords cannot be used as unquoted identifiers.

Examples: `name`, `user_name`, `total2`.

### 5.2 Strings

Strings use double quotes.

```vtr
set page title "Welcome to Veter"
```

Proposed escape sequences:

| Escape | Meaning |
|---|---|
| `\\"` | Double quote |
| `\\\\` | Backslash |
| `\\n` | New line |
| `\\r` | Carriage return |
| `\\t` | Tab |

Unterminated strings must produce a compile-time error with a line and column.

### 5.3 Numbers and booleans

Proposed numeric literals:

- Integer: `0`, `42`, `-7`
- Decimal: `3.14`, `0.5`
- Boolean: `true`, `false`

Numeric precision and overflow behaviour must be fixed by the compiler specification before release. Recommended initial types: signed 64-bit integer and 64-bit floating point.

## 6. Existing prototype syntax

The supplied `Veter_Native_Engine.cpp` currently recognizes these line forms:

```vtr
make a website called "My First Site"
set page title "Welcome to my Veter website"
set background color light blue
set text color dark blue
set font "Arial"
center content
show a title "Hello from Veter!"
show a subtitle "My first website"
show text "I built this page using Veter Language."
add a text box called "Your name"
add a password box called "Password"
add a checkbox "I agree to the terms"
add a button "Say hello"
when button "Say hello" show alert "Hello, {name}! Welcome to Veter."
add a link "Visit Veter website" "https://example.com"
```

The current runtime parses these statements and creates a basic native Windows preview. Its README states that text boxes and checkboxes are visual placeholders, buttons display configured alerts, and links open the system browser. It does not generate HTML, CSS, or JavaScript.

## 7. Proposed core language

The following sections define recommended standard behaviour to implement. They are not all supported by the supplied prototype.

### 7.1 Variables

Recommended readable form:

```vtr
make a variable called "user_name" with value "Harshith"
make a variable called "age" with value 23
change "age" to 24
```

Rules:
- A variable must be declared before use.
- A variable has one value at a time.
- Reassignment must preserve the declared type unless an explicit conversion is used.
- Reading an unknown variable is an error.

### 7.2 Data types

Initial standard types:

| Type | Meaning | Example |
|---|---|---|
| `Number` | 64-bit floating-point number | `3.14` |
| `Whole` | Signed 64-bit integer | `42` |
| `Text` | UTF-8 string | `"hello"` |
| `Boolean` | True or false | `true` |
| `List` | Ordered collection | `[1, 2, 3]` |
| `Nothing` | No value | `nothing` |

The compiler should report type errors clearly. Implicit conversions should be limited and documented.

### 7.3 Operators

Proposed operators:

| Group | Operators |
|---|---|
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Comparison | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Logical | `and`, `or`, `not` |
| Assignment | `=` |

Precedence, from highest to lowest:

1. Parentheses
2. Unary `-`, `not`
3. `*`, `/`, `%`
4. `+`, `-`
5. Comparisons
6. `and`
7. `or`

Division by zero must raise a runtime error. Integer overflow behaviour must be specified and tested; it must never silently vary between builds.

### 7.4 Output and input

Recommended forms:

```vtr
say "Hello from Veter!"
show "Welcome"
ask "What is your name?" and store answer in "name"
```

The exact output and input statements must be standardized before implementation. The current native UI prototype does not implement this general-purpose console I/O model.

### 7.5 Conditions

Recommended form:

```vtr
if "age" is greater than 17
    say "Adult"
otherwise
    say "Under 18"
end
```

The language must define:
- Whether conditions require a Boolean.
- Whether `otherwise` is optional.
- How nested blocks are closed.
- Whether `else if` is supported.

Recommended rule: conditions must evaluate to Boolean; every block closes with `end`.

### 7.6 Loops

Recommended form:

```vtr
repeat 5 times
    say "Hello"
end
```

A condition loop may be added with a distinct phrase, for example:

```vtr
repeat while "count" is less than 5
    change "count" to "count" + 1
end
```

The compiler must define `break` and `continue` before including them in the standard.

### 7.7 Functions

Recommended form:

```vtr
make a function called "greet" with input "name"
    say "Hello, " + "name"
end

run function "greet" with "Harshith"
```

This is a design proposal. Function declaration, parameter typing, return values, scope, and recursion rules must be implemented together rather than partially.

### 7.8 Lists and maps

Proposed collection types:
- `List`: ordered values, indexed from zero.
- `Map`: key/value collection with unique keys.

The standard library should define safe operations for creating, reading, updating, and iterating collections.

### 7.9 Errors and exceptions

The language must distinguish:
- Syntax errors: source cannot be parsed.
- Type errors: values are used incompatibly.
- Runtime errors: a valid program fails during execution.
- Environment errors: file, network, permission, or platform failures.

Every compiler diagnostic should include:
- File name
- Line and column
- Error code
- Short explanation
- Optional suggestion

A future exception mechanism may use `try`, `catch`, and `finally`, but it must be formally specified before release.

## 8. Existing native UI profile

The current runtime's supported UI statements are:

| Statement | Current prototype behaviour |
|---|---|
| `make a website called "..."` | Sets page name |
| `set page title "..."` | Sets window title |
| `set background color ...` | Selects a small built-in color set |
| `set text color ...` | Selects a small built-in color set |
| `set font "..."` | Selects a font |
| `center content` | Centers the basic content layout |
| `show a title "..."` | Draws a title |
| `show a subtitle "..."` | Draws a subtitle |
| `show text "..."` | Draws text |
| `add a text box called "..."` | Creates a text input control |
| `add a password box called "..."` | Creates a password input control |
| `add a checkbox "..."` | Creates a checkbox control |
| `add a button "..."` | Creates a button |
| `when button "..." show alert "..."` | Configures a button alert |
| `add a link "..." "..."` | Opens a link in the system browser |

Known prototype limitations from its README:
- Text boxes and checkboxes are visual placeholders.
- Buttons show configured alert messages.
- Links open the system browser.
- Images, complex layouts, networking, navigation, and responsive page behaviour are not implemented.
- The runtime and builder are separate tools.

These limitations must be addressed before this profile is marketed as a complete website framework.

## 9. Modules and packages

Proposed module goals:
- A source file can import a named module.
- Module names are unique within a project.
- Imports resolve only from declared project/library locations.
- Package versions are pinned or constrained in a lock file.
- Package installation must not execute untrusted install scripts by default.

An eventual package manager should provide:
- Search
- Install
- Update
- Remove
- Version pinning
- Dependency resolution
- Integrity verification

No package-manager command syntax is standardized in this draft.

## 10. Standard library roadmap

A first-party standard library should be divided into stable modules:

| Module | Responsibility |
|---|---|
| `Text` | String operations |
| `Math` | Numeric functions |
| `Lists` | List operations |
| `Files` | Safe file access |
| `Time` | Dates and time |
| `System` | Environment and process information |
| `Network` | HTTP and network operations |
| `UI` | User-interface controls |
| `Data` | JSON and structured data |
| `Test` | Unit testing helpers |

This is a roadmap, not a claim that these modules currently exist.

## 11. Frontend, backend, database, and API direction

These are future platform capabilities and require separate detailed specifications.

### Frontend
- UI component model
- Layout and styling system
- Events and state
- Navigation and accessibility
- Responsive layout
- Browser or native rendering target

### Backend
- HTTP server
- Routes and request/response model
- Authentication and authorization
- Configuration and secrets
- Logging and deployment model

### Database
- Supported database drivers
- Connection management
- Parameterized queries
- Transactions
- Schema migrations
- Credential protection

### APIs
- HTTP client
- JSON serialization
- Timeouts and error handling
- Authentication
- API documentation and testing

Security requirements: parameterized database queries, secure password hashing through vetted libraries, TLS for network connections, and no secrets hard-coded in source files.

## 12. Compiler and runtime requirements

A conforming implementation should provide:
1. Lexer/tokenizer.
2. Parser with a documented grammar.
3. Abstract syntax tree or equivalent structured representation.
4. Semantic/type checks.
5. Execution engine or documented compilation target.
6. Standard-library interface.
7. Stable diagnostics.
8. Automated conformance tests.

The compiler and runtime should be versioned independently where necessary, but must publish a compatibility table.

## 13. Tooling requirements

### Veter Studio
- `.vtr` editor
- Syntax highlighting
- Line numbers
- Auto-indentation
- Open/save/project management
- Run/stop
- Output panel
- Source-located errors
- Debugging
- Search and replace
- Build/package commands

### Command-line tools
Proposed command names and behaviour must be finalized before implementation. A future CLI should support checking, running, building, testing, and packaging projects.

### Windows distribution
- Signed installer where feasible
- Uninstaller
- Start Menu shortcut
- File association for `.vtr`
- Required runtime dependencies bundled or installed clearly
- No developer compiler required by end users
- Version and update information

## 14. Security and reliability

Minimum requirements:
- Validate file paths and prevent unintended directory traversal.
- Do not execute downloaded code automatically.
- Make network and filesystem access explicit.
- Keep credentials out of source code and logs.
- Avoid unsafe shell command construction.
- Provide clear permission and error messages.
- Test malformed and hostile input.
- Preserve user files when an application update fails.

## 15. Versioning and compatibility

Recommended semantic versioning:

`MAJOR.MINOR.PATCH`

- MAJOR: incompatible language changes.
- MINOR: backward-compatible language features.
- PATCH: bug fixes that do not change intended semantics.

Every release should state:
- Language specification version
- Compiler version
- Runtime version
- Supported operating systems
- Implemented language features
- Known limitations
- Migration notes, if needed

A program that uses only stable features of a declared specification should keep the same meaning across conforming implementations.

## 16. Testing and conformance

Before calling Veter 1.0 stable, create automated tests for:

- Valid and invalid syntax
- Strings and escaping
- Variables and scope
- Every data type
- Arithmetic precedence
- Comparisons and logical operators
- Conditions and nested blocks
- Loops
- Functions and return values
- File errors
- Runtime errors
- UI controls and events
- Windows packaging
- Backward compatibility

Each test should include source code, expected result, and expected diagnostic when relevant.

## 17. Current implementation status

Based only on the supplied `Veter-Native-Runtime-1.0` ZIP:

| Capability | Evidence in supplied files |
|---|---|
| `.vtr` file input | Implemented in prototype |
| Line-based parsing | Implemented in prototype |
| `#` comments | Implemented in prototype |
| Basic page/window properties | Implemented in prototype |
| Basic native text and controls | Partially implemented |
| Button alert | Implemented in prototype |
| Open external link | Implemented in prototype |
| General variables/types/functions/loops | Not demonstrated by this runtime |
| Full frontend/backend/database/API stack | Not demonstrated |
| Full IDE/debugger/package manager | Not demonstrated |
| Finished standalone Windows installer | Not demonstrated |

This table is deliberately conservative. Other Veter compiler versions may support additional features, but they were not included in the ZIP inspected for this document.

## 18. Release acceptance checklist

A release may be called **Veter Language 1.0** only when:

- [ ] Grammar and semantics are approved and published.
- [ ] Implemented features match this specification.
- [ ] Conformance tests pass.
- [ ] Errors include file, line, and column.
- [ ] Standard library functions are documented.
- [ ] Compiler/runtime compatibility is documented.
- [ ] Example programs run on a clean supported machine.
- [ ] Windows distribution has been tested without developer tools installed.
- [ ] Security and regression tests pass.
- [ ] Known limitations are published.

Until then, use the label **Veter Language Specification 1.0 — Draft**.

## 19. Governance and change process

Changes to the language standard should:
1. Describe the problem and proposed change.
2. Include syntax examples.
3. Define exact behaviour and error cases.
4. Include compatibility impact.
5. Include tests.
6. Be reviewed before adoption.
7. Be recorded in a change log.

The language owner/project maintainers should publish the accepted specification and keep older versions available.

---

## Appendix A — Current native UI example

This example is based on the supplied `website.vtr` file and the commands recognized by the supplied native runtime:

```vtr
make a website called "My First Site"
set page title "Welcome to my Veter website"
set background color light blue
set text color dark blue
set font "Arial"
center content
show a title "Hello from Veter!"
show a subtitle "My first website"
show text "I built this page using Veter Language."
add a text box called "Your name"
add a button "Say hello"
when button "Say hello" show alert "Hello, {name}! Welcome to Veter."
add a password box called "Password"
add a checkbox "I agree to the terms"
add a link "Visit Veter website" "https://example.com"
```

## Appendix B — Important distinction

- **Veter language specification:** defines what `.vtr` programs mean.
- **Compiler:** checks and translates/executes Veter programs.
- **Runtime:** provides services needed while programs run.
- **Veter Studio:** editor and development environment.
- **C++20:** current implementation technology in the supplied native runtime, not Veter's language standard.

**End of draft.**
