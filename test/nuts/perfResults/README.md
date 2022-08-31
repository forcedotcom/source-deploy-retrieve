# Perf Testing Results

These are intended to

1. set baselines
2. prevent perf regressions due to changes
3. validate perf improvements

They run as part of the scale-nuts.

When you see these change in a PR, you can compare the "before" and "after". They're organized by machine (arch-os-coreQuantity_x_CoreTypes) so it's easier to compare apples to apples. They also run and commit as part of CI so that we get a comparison on a consistent machine.

You can definitely use your machine's baseline to compare against while working on SDR locally via
`yarn test:nuts:scale` (with the appropriate `TESTKIT_` envs for your hub)

Currently, windows NUTs do not commit perf information. Someday!
