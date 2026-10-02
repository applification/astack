const variant = process.env.REFERENCE_VARIANT ?? "fixed";
if (!["buggy", "fixed"].includes(variant)) throw new Error("Unknown reference variant");
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Selection proof reference</title>
<h1>Selection proof reference</h1><p role="status">Idle selected</p>
<button aria-pressed="true" id="idle">Idle</button>
<button id="playback">Pause sequence</button>
<script>
let selected = 'idle';
let playing = true;
const render = () => { document.querySelector('#playback').textContent = playing ? 'Pause sequence' : 'Play sequence'; };
document.querySelector('#idle').onclick = () => {
  ${variant === "buggy" ? "if (selected === 'idle') return;" : ""}
  selected = 'idle';
  playing = false;
  render();
};
document.querySelector('#playback').onclick = () => { playing = !playing; render(); };
</script></html>`;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.argv[2] ?? 0),
  fetch() {
    return new Response(html, { headers: {
      "content-type": "text/html",
      "x-reference-run": process.env.REFERENCE_WRONG_INSTANCE === "1"
        ? "another-run" : process.env.REFERENCE_RUN_ID ?? "manual-reference",
      "x-reference-source": process.env.REFERENCE_SOURCE ?? "unidentified",
    } });
  },
});
console.log(`Reference ${variant} ready at ${server.url}`);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { server.stop(true); process.exit(0); });
}
