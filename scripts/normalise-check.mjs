const UNIT = "g|kg|mg|ml|l|oz|lb|lbs|tbsp|tsp|cup|cups|clove|cloves|slice|slices|pinch";

function normalise(raw) {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // "(optional)", "(about 2)"
  // Leading quantity, with or without a unit fused to it: "400g", "2 tbsp", "1/2".
  s = s.replace(new RegExp(`^[\\d\\s./-]+\\s*(?:${UNIT})?\\b`), " ");
  s = s.replace(
    /\b(fresh|dried|chopped|minced|sliced|diced|ground|whole|large|small|medium)\b/g,
    " ",
  );
  s = s.replace(/,.*$/, " "); // ", finely chopped"
  s = s.replace(/[^a-z\s-]/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Naive de-pluralisation. The guards matter more than the rule: "hummus",
  // "molasses", "watercress" and "couscous" are singular words ending in s, and
  // stripping it would split them from their canonical entry.
  if (s.endsWith("ies") && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith("oes") && s.length > 4) s = s.slice(0, -2);
  else if (
    s.endsWith("s") &&
    !s.endsWith("ss") &&
    !s.endsWith("sses") &&
    !s.endsWith("us") &&
    s.length > 3
  ) {
    s = s.slice(0, -1);
  }

  return s;
}

let fail = 0;
const t = (input, want) => {
  const got = normalise(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(
    `  ${ok ? "\u2713" : "\u2717"} ${JSON.stringify(input).padEnd(34)} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`,
  );
};
t("eggs", "egg");
t("spring onions", "spring onion");
t("tomatoes", "tomato");
t("cherries", "cherry");
t("2 spring onions, finely sliced", "spring onion");
t("400g tinned tomatoes", "tinned tomato");
t("2 tbsp olive oil", "olive oil");
t("garlic (optional)", "garlic");
t("fresh coriander", "coriander");
t("ground cumin", "cumin");
t("hummus", "hummus");
t("molasses", "molasses");
t("watercress", "watercress");
t("couscous", "couscous");
t("olive oil", "olive oil");
t("greek yogurt", "greek yogurt");
t("flat-leaf parsley", "flat-leaf parsley");
console.log(fail === 0 ? "\n  All passed." : `\n  ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
