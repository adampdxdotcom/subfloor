#!/bin/bash
ROOT="${1:-.}"
OUT="tree.txt"

count_items() {
    find "$1" -mindepth 1 -maxdepth 1 | wc -l
}

print_tree() {
    local dir="$1"
    local prefix="$2"

    local items=()
    while IFS= read -r entry; do
        items+=("$entry")
    done < <(find "$dir" -mindepth 1 -maxdepth 1 | LC_ALL=C sort)

    for path in "${items[@]}"; do
        name="${path##*/}"
        echo "${prefix}|____${name}"

        if [ -d "$path" ]; then
            local c
            c=$(count_items "$path")
            if [ "$c" -le 50 ]; then
                print_tree "$path" "   $prefix"
            fi
        fi
    done
}

{
    echo "."
    print_tree "$ROOT" ""
} > "$OUT"

echo "Wrote $OUT"
