Tayar security patch of micromatch/braces 3.0.3 (MIT).

Package version 3.0.4 is a local workspace version only, not an upstream release. The workspace installs the reviewed source and its fill-range dependency in a clean build; existing transitive semver ranges deduplicate to this package. Audit does not inspect this local fork, so the behavioral regression is required.

GHSA-vfj7-8cjw-p6xm: reject brace/parenthesis nesting at depth 64 before recursive processing. Exported AST compile/expand/stringify also reject depth >64, cycles and >65536 nodes using an iterative guard. No option can remove this bound. Normal glob syntax is unchanged. Remove this fork when an upstream fixed release is available.
