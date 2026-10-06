Tayar security patch of micromatch/braces 3.0.3 (MIT).

GHSA-vfj7-8cjw-p6xm: reject brace/parenthesis nesting at depth 64 before recursive processing. Exported AST compile/expand/stringify also reject depth >64, cycles and >65536 nodes using an iterative guard. No option can remove this bound. Normal glob syntax is unchanged. Remove this fork when an upstream fixed release is available.
