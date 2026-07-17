#!/usr/bin/env bash
# Generates a large SFDX project with CustomLabels split across multiple package directories.
# Used to QA the heap OOM fix for large CustomLabels deployments.
#
# Usage:
#   ./scripts/generate-large-labels-project.sh [output_dir] [labels_per_pkg] [num_packages]
#
# Defaults: ./large-labels-project, 5000 labels per package, 3 packages (= 15k total labels)

set -euo pipefail

OUTPUT_DIR="${1:-./large-labels-project}"
LABELS_PER_PKG="${2:-5000}"
NUM_PACKAGES="${3:-3}"

echo "Generating project: $NUM_PACKAGES packages × $LABELS_PER_PKG labels = $(( NUM_PACKAGES * LABELS_PER_PKG )) total labels"
echo "Output: $OUTPUT_DIR"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Build packageDirectories JSON array
PKG_DIRS="["
for i in $(seq 1 "$NUM_PACKAGES"); do
  if [ "$i" -eq 1 ]; then
    PKG_DIRS="$PKG_DIRS{\"path\": \"pkg$i\", \"default\": true}"
  else
    PKG_DIRS="$PKG_DIRS, {\"path\": \"pkg$i\"}"
  fi
done
PKG_DIRS="$PKG_DIRS]"

cat > "$OUTPUT_DIR/sfdx-project.json" <<EOF
{
  "name": "large-labels-project",
  "namespace": "",
  "packageDirectories": $PKG_DIRS,
  "sourceApiVersion": "62.0"
}
EOF

for pkg in $(seq 1 "$NUM_PACKAGES"); do
  LABELS_DIR="$OUTPUT_DIR/pkg$pkg/main/default/labels"
  mkdir -p "$LABELS_DIR"

  FILE="$LABELS_DIR/CustomLabels.labels-meta.xml"

  # Use awk for fast generation instead of a bash loop
  awk -v pkg="$pkg" -v count="$LABELS_PER_PKG" 'BEGIN {
    print "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
    print "<CustomLabels xmlns=\"http://soap.sforce.com/2006/04/metadata\">"
    for (i = 1; i <= count; i++) {
      print "    <labels>"
      print "        <fullName>Pkg" pkg "_Label_" i "</fullName>"
      print "        <language>en_US</language>"
      print "        <protected>false</protected>"
      print "        <shortDescription>Package " pkg " Label " i "</shortDescription>"
      print "        <value>Value for pkg" pkg " label " i "</value>"
      print "    </labels>"
    }
    print "</CustomLabels>"
  }' > "$FILE"

  echo "  Created pkg$pkg with $LABELS_PER_PKG labels ($(wc -c < "$FILE" | tr -d ' ') bytes)"
done

echo ""
echo "Done! To test the OOM fix:"
echo "  cd $OUTPUT_DIR"
echo "  NODE_OPTIONS='--max-old-space-size=512' sf project convert source --output-dir mdapi-output"
echo ""
echo "Without the fix, this OOMs. With the fix, it should complete in seconds."
