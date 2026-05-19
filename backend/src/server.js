import app from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

app.listen(port, () => {
  console.log(`DocuStream backend listening on http://localhost:${port}`);
});
