# Recipe vocabulary (v1)

The stage on the public site is driven by *recipes*: lists of operations from the closed
set below. Content comes from the frad repository (`kb/chapters/*.md`, `kb/features/*.md`);
a generator there validates every recipe against this file and emits `content.js`. An
unknown verb or a wrong argument fails the frad build, never the site.

`content.js` sets `window.FRAD_CONTENT`:

```
{ chapters: [ { slug, label, title, accent, intro, tour: <recipe>,
                features: [ { slug, title, status, summary, details: [..], adr, tests, recipe: <recipe> } ] } ] }
```

- `slug` is the URL part (`#zfs-scale`, `#zfs-scale/evacuate`). Lower case, dashes.
- `label` is the tab text (one or two words); `title` the chapter heading; `intro` one paragraph.
- `accent` is one of `zfs`, `ceph`, `ctl`, `ok`, `warn`.
- `layout` is optional: `diagram` hides the terminal strip and the legend while the chapter plays and widens the
  stage, for chapters whose verbs fill the whole stage (`pipe`, `chain`).
- `status` is `built` or `designed`. The generator derives it: every test in `tests` exists
  in the repo -> built, else an ADR -> designed. `tests` is a count on the site, never a path.
- `details` is a list of plain-text paragraphs. No HTML.
- `recipe` is optional on a feature: without one the stage holds the chapter's end state.

## The tour and the three levels

The tour is the concatenation of every chapter's `tour` recipe, played in a loop. A chapter
view plays the chapter's own steps from the state the previous chapters left, then every
feature of the chapter in order, and loops. A feature view plays the feature recipe once. In
both, a feature starts from that same starting state with the overlays (`screen`, `verify`,
`inside`, `media`, `chain`, `pipe`) cleared, so a feature recipe stands alone: it sets up what it needs (a silent step without `type` is enough) and then
shows the feature.

State is replayed, never stored: the picture at step k is the result of applying every
scene verb of steps 0..k to the starting state. Jumping to any step is therefore exact.

## Verbs

A recipe is an array of arrays: `[verb, arg, ...]`.

### Narration and terminal

| verb | args | meaning |
|---|---|---|
| `step` | title, text, flag? | starts a step; `flag` may be `"designed"` |
| `type` | command, node? | the operator types the command at the frad_cli prompt of `node` (default `h1`, prompt `h1> `), then Enter; the scope is part of the command (`node …`, `cluster …`) |
| `note` | text | a comment line in the terminal, shown at once |
| `out` | line | an output line, printed after the stage has reacted; `@<example>` prints the example's lines |
| `err` | line | an output line in the refusal colour; the stage changes nothing |
| `hold` | ms | extra time on this step in autoplay |

Scene verbs that follow a `type` apply when Enter is pressed, so the picture changes as the
command runs. Scene verbs in a step without `type` apply when the step starts.

### Scene

Nodes are `h1`..`h9`. Disk indexes are 0..3 (`sda`..`sdd`). Backends are `free`, `ceph`, `zfs`.

| verb | args | meaning |
|---|---|---|
| `node` | id, "installing"? | a node appears, four free disks |
| `ready` | id | the node has finished installing |
| `drop` | id | the node leaves |
| `disks` | id, [backend x4] | set every disk |
| `disk` | id, index, backend | set one disk; it is highlighted for this step |
| `control` | [ids] | the control group is exactly these nodes |
| `vip` | on/off | the virtual IP badge over the control group |
| `bus` | on/off | the cluster network |
| `services` | on/off | the "live on the cluster" banner |
| `screen` | id, example | a console screen beside node `id`, its text from the example (see Examples); `null` clears it |
| `inside` | mode or null | the "inside h1" inlay: `channels`, `clone`, `rollback`, `frbe` |
| `verify` | subject, mode? | a verification card beside the subject: `image` with `online` or `offline`, or a node id with `peers`; `null` clears it |
| `down` | id | the node loses power; control and VIP recompute |
| `pipe` | stage or `done` | the release pipeline over the whole stage: ten stages in a row (build, unit, frad, sys, fts, cluster, e2e, sbom, scan, sign), stages below `stage` done, `stage` running and explained below the row; `done` lights all; `null` clears it |
| `chain` | step or `done` | the release chain diagram over the whole stage (source, build, release key, log, store, trust root, node): steps below `step` are done, `step` is in flight; `done` lights all; `null` clears it |
| `media` | id, kind, phase? | the boot medium feeding node `id`, a card with its stages: `iso`, `usb`, `pxe` or `http`; `phase` = stages done so far (default: all); `null` clears it |
| `up` | id | the node is back |

Reserved for the next engine release (the validator rejects them until then): `evacuate`,
`vdev`, `pool`, `lock`, `replica`, `pulse`, `client`.

## Examples

`examples.js` sets `window.FRAD_EXAMPLES`: `{ <id>: { source, date, build?, lines: [..] } }`. An example
is what the operator typed at the prompt and what the CLI or a screen printed back, cut from a
passing e2e `.test` log; harness lines (markers, return-code checks, verification) never appear.
`source` is the test's path in the repo, `date` the run, `build` the commit the node ran. Recipes use
an example by id: `["screen", "h1", "fts-menu"]`, `["out", "@cli-cluster-status"]`.
`examples-cli.js` adds the recorded CLI runs under `cli-<command path with dashes>`
(`cli-node-disks-show`), one example per command, every run of it the suite logged:
`tools/examples-from-logs.py` cuts them from `tests/e2e/cli` logs. The manual replays the
example of the page's path; `cli-login` is the root page.

## Public text rules

Commands appear as typed at the frad_cli prompt, never as a root shell command (`frad_cli -c`,
`frad_cli -0`) and never with `su - admin`. Hosts are `h1`..`h9`; addresses are in `10.0.0.0/24` or
the test kit's own ranges (`10.254.0.0/16`) as the logs print them. Nothing else leaves the repo: no
real host names, addresses, key names or home paths. The generator refuses such text.
