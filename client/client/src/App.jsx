import { useState } from "react";
import "./App.css";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return alert("Enter a prompt");

    setLoading(true);
    setOutput("⏳ Generating...\n");

    try {
      // 🔥 replace this with backend later
      await new Promise((res) => setTimeout(res, 1500));

      const fakeResponse = `
mkdir ai-website
touch index.html style.css script.js

cat <<EOF > index.html
<!DOCTYPE html>
<html>
<head>
<title>${prompt}</title>
</head>
<body>
<h1>${prompt}</h1>
</body>
</html>
EOF
      `;

      setOutput(fakeResponse);
    } catch (err) {
      setOutput("❌ Error generating website");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>🚀 AI Website Builder</h1>
        <p className="subtitle">
          Describe your idea and generate a full website instantly
        </p>

        <div className="inputBox">
          <textarea
            placeholder="e.g. Build a course selling website with login and payment..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <button onClick={handleGenerate} disabled={loading}>
            {loading ? "Generating..." : "Generate Website"}
          </button>
        </div>

        <div className="outputBox">
          <h3>🖥 Terminal Output</h3>
          <pre>{output}</pre>
        </div>
      </div>
    </div>
  );
}