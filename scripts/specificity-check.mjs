function normalise(raw) {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/,.*$/, " ");
  s = s.replace(/[^a-z\s-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("oes") && s.length > 4) s = s.slice(0, -2);
  else if (
    s.endsWith("s") &&
    !s.endsWith("ss") &&
    !s.endsWith("sses") &&
    !s.endsWith("us") &&
    s.length > 3
  )
    s = s.slice(0, -1);
  return s;
}
function isMoreSpecificThan(input, candidate) {
  const i = normalise(input).split(" ").filter(Boolean);
  const c = normalise(candidate).split(" ").filter(Boolean);
  if (i.length <= c.length) return false;
  return c.every((w) => i.includes(w));
}
let fail = 0;
const t = (input, cand, want, note = "") => {
  const got = isMoreSpecificThan(input, cand);
  const ok = got === want;
  if (!ok) fail++;
  console.log(
    `  ${ok ? "✓" : "✗"} ${(input + " vs " + cand).padEnd(42)} ${got ? "distinct" : "same"}${note ? "  " + note : ""}`,
  );
};

console.log("  --- must be treated as DIFFERENT ingredients ---");
t("white wine vinegar", "white wine", true, "the bug");
t("coconut milk", "coconut", true);
t("spring onion", "onion", true);
t("smoked paprika", "paprika", true);
t("greek yogurt", "yogurt", true);
t("dark chocolate", "chocolate", true);

console.log("  --- must still match (typos, plurals, same thing) ---");
t("tomatos", "tomato", false);
t("olive oil", "olive oil", false);
t("garlick", "garlic", false);
t("onion", "spring onion", false, "shorter input never blocks");

console.log(fail === 0 ? "\n  All passed." : `\n  ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
