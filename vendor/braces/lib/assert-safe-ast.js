'use strict';

// Guard public AST entrypoints without recursing into attacker-controlled trees.
module.exports = root => {
  const pending = [{ node: root, depth: 0 }];
  const seen = new Set();
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object') throw new TypeError('Invalid brace AST');
    if (seen.has(node) || depth > 64 || ++count > 65536) {
      throw new RangeError('Brace nesting exceeds safety limit (64)');
    }
    seen.add(node);
    if (Array.isArray(node.nodes)) {
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
  }
};
