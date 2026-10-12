# FRAD Storage OS: public site

The public face of FRAD, an appliance operating system for storage. Static pages, no build
step, served by GitHub Pages at https://chienpanglee.github.io/frad-site/.

FRAD itself is closed-source; this repository holds only the website.

## Logo

`logo/` holds the mark and wordmark as SVG: the fifth wheel. The rim and its five nodes are
the cluster (Ceph), the hub is the node you start with (local ZFS). `frad-logo.svg` and
`frad-logo-dark.svg` are the horizontal lockups, `frad-logo-stacked.svg` the square one,
`frad-mark*.svg` the mark alone, `frad-social.png` the 1200x630 link preview. The letters are
drawn as strokes, so no font is needed. `favicon.svg` at the root is the mark.

## Pages

`index.html` is the shell, `stage.js` the stage engine, `examples.js` real outputs cut from e2e test logs (screens and command output the recipes reference by id), `examples-cli.js` the recorded CLI runs (generated), `content.js` the content:
eleven chapters in recipe form, each with a short tour, a feature list and feature recipes.
`VOCABULARY.md` is the contract between the two: the closed set of recipe verbs and the
shape of `content.js`. Content is meant to come from the frad repository's kb (a generator
there validates recipes against the vocabulary and emits `content.js`); until then it is
hand-written here. Three levels: the tour loops; a chapter tab opens the chapter, looping its
own steps beside its feature list; a feature plays once with its details. Deep links:
`#<chapter>`, `#<chapter>/<feature>`, `#step-N`. Only the tour autoplays; a chapter or a feature
waits for Play.

`cli.html` is the CLI manual: the command tree from frad's `cli_tree.lst` baseline
(`cli-tree.js`, generated), one page per path (`cli.html#node/disks/zfs_add`) with the prompt
forms, the usage, and a replay of the command's recorded runs when there are any.
`term.js` is the terminal player both pages share, `site.css` the shared styles.

`tools/examples-from-logs.py` writes `examples-cli.js` from the logs of frad's generated CLI
e2e suite (`tests/e2e/cli/<mode>/test_<command>.test`): every `frad_cli -c` a passing test ran,
with what the CLI printed, becomes `h1> <command>` plus its output under the id
`cli-<path-with-dashes>`. Runs that print a key are left out; text naming the lab stops the
run. Until the frad repository emits the file itself:

    python3 -I tools/examples-from-logs.py --tree cli-tree.js --out examples-cli.js \
        --root /path/to/tests/e2e/cli $(find /path/to/tests/e2e/cli -name '*.test')
