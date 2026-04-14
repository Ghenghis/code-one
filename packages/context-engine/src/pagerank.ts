/**
 * PageRank implementation for ranking files by structural importance.
 *
 * Given a directed graph (file → file dependencies), computes a score
 * for each node reflecting how "central" it is. Files imported by many
 * other important files score higher.
 */

export interface PageRankOptions {
  /** Damping factor (probability of following a link vs random jump). Default 0.85. */
  damping?: number;
  /** Number of iterations. Default 20. */
  iterations?: number;
}

/**
 * Compute PageRank scores for nodes in a directed graph.
 *
 * @param nodes - Array of unique node IDs
 * @param edges - Array of [from, to] directed edges
 * @param options - Algorithm parameters
 * @returns Map of node ID to PageRank score (sums to ~1.0)
 */
export function computePageRank(
  nodes: string[],
  edges: Array<[string, string]>,
  options: PageRankOptions = {},
): Map<string, number> {
  const { damping = 0.85, iterations = 20 } = options;
  const n = nodes.length;
  if (n === 0) return new Map();

  // Build adjacency: outgoing links per node
  const outLinks = new Map<string, Set<string>>();
  const inLinks = new Map<string, Set<string>>();
  for (const node of nodes) {
    outLinks.set(node, new Set());
    inLinks.set(node, new Set());
  }

  for (const [from, to] of edges) {
    if (!outLinks.has(from) || !inLinks.has(to)) continue;
    outLinks.get(from)!.add(to);
    inLinks.get(to)!.add(from);
  }

  // Initialize scores uniformly
  let scores = new Map<string, number>();
  for (const node of nodes) {
    scores.set(node, 1 / n);
  }

  // Identify dangling nodes (no outgoing links)
  const danglingNodes = nodes.filter((node) => outLinks.get(node)!.size === 0);

  // Iterate
  for (let i = 0; i < iterations; i++) {
    // Sum of scores from dangling nodes — redistributed evenly
    let danglingSum = 0;
    for (const node of danglingNodes) {
      danglingSum += scores.get(node)!;
    }

    const next = new Map<string, number>();

    for (const node of nodes) {
      let rank = (1 - damping) / n;
      // Dangling redistribution
      rank += damping * (danglingSum / n);

      for (const inNode of inLinks.get(node)!) {
        const outDegree = outLinks.get(inNode)!.size;
        if (outDegree > 0) {
          rank += damping * (scores.get(inNode)! / outDegree);
        }
      }

      next.set(node, rank);
    }

    scores = next;
  }

  return scores;
}
