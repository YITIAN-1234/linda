// debug_engine.js —— 对比 JS 与 Python 的关键案例
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const kbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "kb.json"), "utf-8"));
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "engine.js"), "utf-8"), sandbox);
const Engine = sandbox.LindaEngine;
Engine.loadKB(kbRaw);

for (const q of ["装修保证金最多收多少", "装修要提前申报吗", "周末可以敲墙吗"]) {
  console.log("=".repeat(60));
  console.log("Q:", q);
  const res = Engine.handle("dbg_" + q.slice(0, 4), q, {});
  console.log("intent:", res.intent, "| refused:", res.refused, "| follow_up:", res.follow_up.needed);
  console.log("answer:", (res.answer || "").slice(0, 100));
  console.log("sources:", JSON.stringify(res.sources));
  console.log("candidates:", (res.candidates || []).map(c => `${c.id}(${c.score})`).join(" "));
}
