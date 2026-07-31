import assert from "node:assert/strict";
import test from "node:test";
import { PERIODS, TYPES } from "../back/script.js";

test("aceita somente os filtros suportados", () => {
  assert.equal(PERIODS.has("1_mes"), true);
  assert.equal(PERIODS.has("6_meses"), true);
  assert.equal(PERIODS.has("todo_tempo"), true);
  assert.equal(PERIODS.has("semana"), false);
  assert.equal(TYPES.has("musicas"), true);
  assert.equal(TYPES.has("artistas"), true);
  assert.equal(TYPES.has("albuns"), true);
  assert.equal(TYPES.has("podcasts"), false);
});
