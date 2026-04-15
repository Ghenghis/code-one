import { describe, it, expect } from "vitest";
import { computePageRank } from "./pagerank.js";

describe("computePageRank", () => {
  it("returns empty map for empty graph", () => {
    const scores = computePageRank([], []);
    expect(scores.size).toBe(0);
  });

  it("assigns equal scores to disconnected nodes", () => {
    const scores = computePageRank(["a", "b", "c"], []);
    // With no edges, each node gets (1-d)/n from random jumps
    // Scores should be roughly equal
    const values = [...scores.values()];
    expect(values).toHaveLength(3);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    for (const v of values) {
      expect(v).toBeCloseTo(avg, 4);
    }
  });

  it("scores sum to approximately 1.0", () => {
    const scores = computePageRank(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "d"],
        ["d", "a"],
      ],
    );
    const sum = [...scores.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("highly-linked node scores higher", () => {
    // "hub" is linked to by a, b, and c
    const nodes = ["a", "b", "c", "hub"];
    const edges: Array<[string, string]> = [
      ["a", "hub"],
      ["b", "hub"],
      ["c", "hub"],
    ];
    const scores = computePageRank(nodes, edges);

    expect(scores.get("hub")!).toBeGreaterThan(scores.get("a")!);
    expect(scores.get("hub")!).toBeGreaterThan(scores.get("b")!);
    expect(scores.get("hub")!).toBeGreaterThan(scores.get("c")!);
  });

  it("respects damping factor", () => {
    // a→b→c chain: higher damping means less random-jump, so the hub "b" is more differentiated
    const nodes = ["a", "b", "c", "hub"];
    const edges: Array<[string, string]> = [
      ["a", "hub"],
      ["b", "hub"],
      ["c", "hub"],
    ];
    const scores1 = computePageRank(nodes, edges, { damping: 0.5 });
    const scores2 = computePageRank(nodes, edges, { damping: 0.99 });

    // Higher damping → hub gets even more relative score
    const ratio1 = scores1.get("hub")! / scores1.get("a")!;
    const ratio2 = scores2.get("hub")! / scores2.get("a")!;
    expect(ratio2).toBeGreaterThan(ratio1);
  });

  it("handles self-loops gracefully", () => {
    const scores = computePageRank(
      ["a", "b"],
      [
        ["a", "a"],
        ["a", "b"],
      ],
    );
    expect(scores.get("a")).toBeGreaterThan(0);
    expect(scores.get("b")).toBeGreaterThan(0);
  });

  it("ignores edges referencing unknown nodes", () => {
    const scores = computePageRank(
      ["a", "b"],
      [
        ["a", "b"],
        ["x", "b"],
      ],
    );
    expect(scores.size).toBe(2);
    const sum = [...scores.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });
});
