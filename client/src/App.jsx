import { useState } from "react";
import "./App.css";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return alert("Enter a prompt");

    setLoading(true);
    setOutput("⏳ AI is writing code and packaging your project...\nThis might take a minute.");

    try {
      // Call your Express backend
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: prompt,
          // We pass a session ID so the backend knows what folder to zip
          sessionId: `project-${Date.now()}` 
        }),
      });

      if (!response.ok) {
        throw new Error("Server failed to generate the project.");
      }

      // 1. Receive the ZIP file as a binary Blob
      const blob = await response.blob();
      
      // 2. Create a temporary URL for the Blob
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // 3. Create a hidden <a> tag and click it to trigger the download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = "ai-website.zip"; // The downloaded file name
      document.body.appendChild(link);
      link.click();
      
      // 4. Clean up
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setOutput("✅ Success! Your website folder has been downloaded as a .zip file.");
      
    } catch (err) {
      console.error(err);
      setOutput(`❌ Error generating website: ${err.message}`);
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
            {loading ? "Generating..." : "Generate & Download"}
          </button>
        </div>

        <div className="outputBox">
          <h3>🖥 Status Output</h3>
          <pre>{output}</pre>
        </div>
      </div>
    </div>
  );
}