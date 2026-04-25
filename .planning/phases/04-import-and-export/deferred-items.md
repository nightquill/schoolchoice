# Deferred Items (out of scope for 04-03)

## Pre-existing build errors (existed before wave 2)

1. `frontend/postcss.config.js` — Uses CommonJS `module.exports` syntax in an ESM project.
   Error: "module is not defined in ES module scope". Fix: rename to `postcss.config.cjs`.

2. `frontend/src/components/EntityForm/fieldComponents.js` — Contains JSX syntax in a `.js` file
   without JSX parser enabled. Error: "Unexpected JSX expression". Fix: rename to `.jsx`.

Both errors existed before plan 04-03 (confirmed by stash test). Not introduced by this plan.
