// run_engine.js —— Node 对拍测试：JS 静态引擎 vs 60 条评测用例
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const kbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "kb.json"), "utf-8"));
const code = fs.readFileSync(path.join(ROOT, "assets", "engine.js"), "utf-8");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Engine = sandbox.LindaEngine;
Engine.loadKB(kbRaw);

const INTENT_CN = { policy_qa: "制度问答", service: "事务办理", complaint: "投诉报修" };
const byId = Object.fromEntries(kbRaw.clauses.map(c => [c.id, c]));

function loadCases(name) {
  const p = path.join(ROOT, "..", "tests", name);
  return JSON.parse(fs.readFileSync(p, "utf-8")).cases;
}

let ok = 0, total = 0;
const fails = [];
for (const name of ["cases_30.json", "cases_30b.json"]) {
  for (const c of loadCases(name)) {
    total++;
    const res = Engine.handle("js_" + c.id, c.query, c.user_profile || {});
    const problems = [];
    if (c.refuse) {
      if (!res.refused) problems.push("应拒答但作答");
      if (res.ticket) problems.push("范围外问题不应建单");
    } else {
      if (c.intent && res.intent !== c.intent) problems.push(`意图错(期望${c.intent}/实得${res.intent})`);
      if (res.refused) problems.push("不应拒答但拒答");
      if (!res.refused && res.follow_up.needed) problems.push("不应追问但追问");
      if (!res.refused && !res.follow_up.needed) {
        if (!res.answer) problems.push("空回答");
        const srcs = res.sources.map(s => s.file + "#" + s.clause);
        if (!srcs.length) problems.push("无出处");
        else {
          const expIds = c.expect_clause || [];
          const expPairs = expIds.map(id => {
            const e = byId[id];
            return e ? e.f + "#" + e.n : id;
          });
          const hit = srcs.some(s => expPairs.some(p => {
            const [f, n] = p.split("#");
            return s === `${f}#${n}`;
          }));
          if (!hit) problems.push(`出处错(期望${expPairs.join("|")})`);
        }
      }
    }
    if (problems.length) {
      fails.push([c.id, c.query, res, problems]);
    } else ok++;
  }
}

console.log(`JS 静态引擎对拍：${ok}/${total}`);
if (fails.length) {
  console.log("\n出错项:");
  for (const [id, q, res, problems] of fails) {
    console.log(`  [${id}] ${q}  意图=${INTENT_CN[res.intent] || res.intent} 拒答=${res.refused}`);
    console.log(`       → ${(res.answer || "").slice(0, 90)}`);
    console.log(`       ✗ ${problems.join("；")}`);
  }
} else {
  console.log("全部通过，无出错项");
}
