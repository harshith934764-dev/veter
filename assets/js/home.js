    function showProduct(product) {
      if (product !== "veteros") return;
      const detail = document.getElementById("veteros-detail");
      detail.hidden = false;
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function hideProduct() {
      const detail = document.getElementById("veteros-detail");
      detail.hidden = true;
      document.getElementById("products").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Browser learning runner for the documented subset of Veter syntax.
    (function () {
      const starter = 'make name "Veter Language"\nmake score 10 + 5 * 2\nsay "Hello from " + name\nsay score';
      const editor = document.getElementById("veter-code");
      const output = document.getElementById("veter-output");
      const examples = {
        starter,
        calculator: 'make price 120\nmake quantity 3\nmake total price * quantity\nsay "Total price:"\nsay total',
        profile: 'make name "Veter learner"\nmake goal "Build something great"\nsay "Hello, " + name\nsay goal',
        rectangle: 'make length 12\nmake width 5\nmake area length * width\nsay "Rectangle area:"\nsay area',
        remainder: 'make total 17\nmake groups 5\nmake left total % groups\nsay "Items left over:"\nsay left',
        invoice: 'make item "Notebook"\nmake price 45\nmake quantity 4\nmake total price * quantity\nsay item\nsay "Amount:"\nsay total'
      };
      const lineCount = document.getElementById("veter-line-count");
      function updateLineCount() {
        const count = editor.value.split(/\\r?\\n/).length;
        lineCount.textContent = count + (count === 1 ? " line" : " lines");
      }
      editor.addEventListener("input", updateLineCount);
      editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const start = editor.selectionStart, end = editor.selectionEnd;
          editor.setRangeText("  ", start, end, "end");
          updateLineCount();
        }
      });
      document.getElementById("veter-example").addEventListener("change", (event) => {
        editor.value = examples[event.target.value] || starter;
        updateLineCount();
        output.textContent = "Example loaded. Press Run code to try it.";
      });
      document.getElementById("veter-copy-output").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.textContent);
          document.getElementById("veter-copy-output").textContent = "Copied!";
        } catch (e) {
          output.textContent += "\\n(Copy is unavailable in this browser.)";
        }
      });

      function tokenize(expr) {
        const out = [];
        let i = 0;
        while (i < expr.length) {
          if (/\s/.test(expr[i])) { i++; continue; }
          if (expr[i] === '"' || expr[i] === "'") {
            const q = expr[i++];
            let v = "";
            while (i < expr.length && expr[i] !== q) {
              if (expr[i] === "\\" && i + 1 < expr.length) { i++; v += expr[i++]; }
              else v += expr[i++];
            }
            if (expr[i] !== q) throw Error("Unclosed string");
            i++;
            out.push({ t: "value", v });
            continue;
          }
          const m = expr.slice(i).match(/^(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\+|-|\*|\/|%|\(|\))/);
          if (!m) throw Error("Unexpected character: " + expr[i]);
          out.push({ t: /^\d/.test(m[0]) ? "number" : /^[A-Za-z_]/.test(m[0]) ? "name" : "op", v: m[0] });
          i += m[0].length;
        }
        return out;
      }

      function valueOf(expr, vars) {
        const ts = tokenize(expr);
        let p = 0;
        function atom() {
          const x = ts[p++];
          if (!x) throw Error("Expected a value");
          if (x.t === "value") return x.v;
          if (x.t === "number") return Number(x.v);
          if (x.t === "name") {
            if (!Object.prototype.hasOwnProperty.call(vars, x.v)) throw Error("Unknown variable: " + x.v);
            return vars[x.v];
          }
          if (x.v === "(") {
            const v = add();
            if (!ts[p] || ts[p++].v !== ")") throw Error("Missing )");
            return v;
          }
          if (x.v === "-") return -Number(atom());
          throw Error("Unexpected token: " + x.v);
        }
        function mul() {
          let a = atom();
          while (ts[p] && ["*", "/", "%"].includes(ts[p].v)) {
            const op = ts[p++].v, b = Number(atom());
            if ((op === "/" || op === "%") && b === 0) throw Error("Division by zero");
            a = op === "*" ? Number(a) * b : op === "/" ? Number(a) / b : Number(a) % b;
          }
          return a;
        }
        function add() {
          let a = mul();
          while (ts[p] && ["+", "-"].includes(ts[p].v)) {
            const op = ts[p++].v, b = mul();
            a = op === "+"
              ? (typeof a === "string" || typeof b === "string" ? String(a) + String(b) : Number(a) + Number(b))
              : Number(a) - Number(b);
          }
          return a;
        }
        const v = add();
        if (p !== ts.length) throw Error("Could not understand expression near " + ts[p].v);
        return v;
      }

      document.getElementById("veter-run").addEventListener("click", () => {
        try {
          const vars = Object.create(null), lines = editor.value.split(/\r?\n/), logs = [];
          for (let n = 0; n < lines.length; n++) {
            const line = lines[n].trim();
            if (!line || line.startsWith("#")) continue;
            let m = line.match(/^(make|set)\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
            if (m) { vars[m[2]] = valueOf(m[3], vars); continue; }
            m = line.match(/^(say|show)\s+(.+)$/);
            if (m) { logs.push(String(valueOf(m[2], vars))); continue; }
            throw Error("Line " + (n + 1) + ": browser runner supports make, set, say and show.");
          }
          output.textContent = logs.length ? logs.join("\n") : "Program finished with no output.";
        } catch (e) {
          output.textContent = "Veter error: " + e.message;
        }
      });

      document.getElementById("veter-reset").addEventListener("click", () => {
        editor.value = starter;
        document.getElementById("veter-example").value = "starter";
        updateLineCount();
        document.getElementById("veter-copy-output").textContent = "Copy output";
        output.textContent = "Example restored. Press Run to execute it.";
      });

      document.getElementById("veter-save").addEventListener("click", () => {
        const blob = new Blob([editor.value], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-veter-project.vtr";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });

      const fileInput = document.getElementById("veter-file");
      document.getElementById("veter-open").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          editor.value = await file.text();
          output.textContent = "Loaded " + file.name + ". Press Run code to execute it.";
        } catch (e) {
          output.textContent = "Could not open this file.";
        }
        fileInput.value = "";
      });

  document.querySelectorAll('[data-veter-action="show-product"]').forEach((button) => {
    button.addEventListener("click", () => showProduct("veteros"));
  });
  document.querySelectorAll('[data-veter-action="hide-product"]').forEach((button) => {
    button.addEventListener("click", hideProduct);
  });
  updateLineCount();
})();
