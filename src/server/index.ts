import express from "express";
import path from "path";
import { config as loadEnv } from "dotenv";
import { apiRouter } from "./api";

loadEnv();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../../public")));

app.use("/api", apiRouter);

// Serve the UI for any non-API route
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Confluence to Markdown server running at http://localhost:${PORT}`);
});

export default app;
