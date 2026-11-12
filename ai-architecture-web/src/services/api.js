// src/services/api.js
// Talks to the FastAPI backend

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Turns a server error into a readable message (including 422 field problems)
const readError = async (res) => {
  let message = `Server error (${res.status})`;
  try {
    const err = await res.json();
    if (typeof err.detail === "string") {
      message = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length) {
      const problems = err.detail.map((d) => {
        const field = (d.loc || []).filter((part) => part !== "body").join(".");
        return `${field || "request"}: ${d.msg}`;
      });
      message = `Invalid data - ${problems.slice(0, 3).join("; ")}`;
    }
  } catch {}
  return message;
};

// Sends the form data to /predict and returns the result
export const predictPlan = async (payload) => {
  let res;
  try {
    res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 8000."
    );
  }

  if (!res.ok) throw new Error(await readError(res));

  return res.json();
};

// Blueprint paths come back like "/blueprints/floor_abc.png"
export const blueprintUrl = (path) =>
  path.startsWith("http") ? path : `${API_BASE}${path}`;

// Asks the backend to build the PDF report and saves it to the computer
export const downloadPdf = async (result, inputs) => {
  let res;
  try {
    res = await fetch(`${API_BASE}/download-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, inputs }),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 8000."
    );
  }
  if (!res.ok) throw new Error(`Could not create the PDF (error ${res.status}).`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Building_Plan_Report.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// Sends a typed change request; the server returns a new set of blueprints
export const editBlueprint = async (payload) => {
  let res;
  try {
    res = await fetch(`${API_BASE}/edit-blueprint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Make sure the backend is running on port 8000."
    );
  }

  if (!res.ok) throw new Error(await readError(res));
  return res.json();
};