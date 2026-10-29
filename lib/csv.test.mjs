import assert from "node:assert/strict";
import { csvCell, toCsv } from "./csv.ts";

assert.equal(csvCell('Unit 4, "Blue" Bldg'), '"Unit 4, ""Blue"" Bldg"', "commas and quotes stay in one cell");
assert.equal(csvCell(null), '""');
assert.equal(csvCell(4299), '"4299"');
assert.equal(csvCell(-50), '"-50"', "negative numbers are not treated as formulas");
assert.equal(csvCell("-50"), '"-50"', "a typed negative amount stays a number");
assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"', "formulas are defused");
assert.equal(csvCell("+639171234567"), '"\'+639171234567"', "leading + is defused");
assert.equal(csvCell("@cmd"), '"\'@cmd"');
assert.equal(csvCell("-cmd"), '"\'-cmd"');
assert.equal(toCsv([["a", "b"], [1, "x\ny"]]), '"a","b"\r\n"1","x\ny"');

console.log("csv tests passed");
