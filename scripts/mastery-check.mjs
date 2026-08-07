const LEVELS = ["untried", "attempted", "learning", "reliable", "mastered"];
const isGood = (o) => o === "good" || o === "nailed";
function deriveMastery(o) {
  if (!o.length) return "untried";
  let s = 0;
  for (const x of o) {
    if (!isGood(x)) break;
    s++;
  }
  if (s >= 3) return "mastered";
  if (s >= 2) return "reliable";
  if (o.some(isGood)) return "learning";
  return "attempted";
}
const rank = (l) => LEVELS.indexOf(l);
function inherited(p) {
  if (p === "untried" || p === "attempted") return p;
  return LEVELS[Math.max(rank(p) - 1, rank("learning"))];
}

let fail = 0;
const t = (d, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${d.padEnd(52)} ${got}${ok ? "" : ` (want ${want})`}`);
};

console.log("  --- derivation from log history (most recent first) ---");
t("no logs", deriveMastery([]), "untried");
t("one flop", deriveMastery(["flopped"]), "attempted");
t("two rough", deriveMastery(["rough", "rough"]), "attempted");
t("one good, ever", deriveMastery(["flopped", "good"]), "learning");
t("good then flop (most recent flop)", deriveMastery(["flopped", "good", "good"]), "learning");
t("two consecutive good", deriveMastery(["good", "good"]), "reliable");
t("nailed + good", deriveMastery(["nailed", "good"]), "reliable");
t("three consecutive good", deriveMastery(["good", "good", "good"]), "mastered");
t("four good then an old flop", deriveMastery(["nailed", "good", "good", "flopped"]), "mastered");

console.log("  --- a flop demotes from mastered ---");
t("mastered then flops", deriveMastery(["flopped", "good", "good", "good"]), "learning");

console.log("  --- variant inheritance: one level down, floored at learning ---");
t("parent mastered", inherited("mastered"), "reliable");
t("parent reliable", inherited("reliable"), "learning");
t("parent learning", inherited("learning"), "learning");
t("parent attempted", inherited("attempted"), "attempted");
t("parent untried", inherited("untried"), "untried");

console.log(fail === 0 ? "\n  All passed." : `\n  ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
