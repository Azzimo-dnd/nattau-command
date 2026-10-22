import assert from "node:assert/strict";
import { test } from "node:test";
import { orbitMouseButtons } from "../components/vtt/vttCameraInput";

test("select/move mode does not bind left mouse to camera orbit", () => {
  assert.equal(orbitMouseButtons(true).LEFT, -1);
});
test("ordinary navigation restores left mouse orbit", () => {
  assert.equal(orbitMouseButtons(false).LEFT, 0);
});
