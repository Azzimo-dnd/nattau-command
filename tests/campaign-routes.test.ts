import assert from "node:assert/strict";
import test from "node:test";
import { campaignSlugForProtectedPath } from "../lib/campaigns/campaignRoutes";

test("maps Barovia routes to the Barovia membership boundary", () => {
  assert.equal(campaignSlugForProtectedPath("/campaigns/barovia"), "barovia");
  assert.equal(
    campaignSlugForProtectedPath("/campaigns/barovia/characters"),
    "barovia"
  );
});

test("maps modern and legacy Nattau routes to the Nattau membership boundary", () => {
  assert.equal(campaignSlugForProtectedPath("/campaigns/nattau"), "nattau");
  assert.equal(campaignSlugForProtectedPath("/map"), "nattau");
  assert.equal(campaignSlugForProtectedPath("/gm/session"), "nattau");
  assert.equal(campaignSlugForProtectedPath("/vtt/table"), "nattau");
});

test("keeps global account and campaign administration routes campaign-neutral", () => {
  assert.equal(campaignSlugForProtectedPath("/account"), null);
  assert.equal(campaignSlugForProtectedPath("/campaigns"), null);
  assert.equal(campaignSlugForProtectedPath("/gm/campaigns"), null);
  assert.equal(campaignSlugForProtectedPath("/change-password"), null);
});
