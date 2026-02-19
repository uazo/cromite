#!/usr/bin/env bash
set -euo pipefail

#######################################
# Globals
#######################################
declare -A commitmsg_to_files
declare -A commitmsg_to_date
declare -A file_status

MAX_FILES=0   # 0 = nessun limite

#######################################
# Logging
#######################################
log_info() { echo "$*"; }
log_warn() { echo "[WARN] $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }

usage() {
    cat <<EOF
Usage: $0 [-n NUM]

Options:
  -n NUM   Limit the number of analyzed files (0 = no limit)
  -h       Show this help
EOF
}

#######################################
# Git helpers
#######################################
get_modified_files() {
    git status --porcelain | while IFS= read -r line; do
        # primi 2 caratteri = status, poi spazio, poi filename
        status="${line:0:2}"
        file="${line:3}"
        echo "$status|$file"
    done
}

get_commits_for_file() {
    local file="$1"
    git log --follow --pretty=format:'%H|%ct|%s' -- "$file" | awk '!seen[$0]++'
}

#######################################
# Process a single file (include commit classification)
#######################################
process_file() {
    local status="$1"
    local file="$2"

    log_info "Analyse file: $file (status: $status)"
    file_status["$file"]="$status"

    # --- commit analysis inline ---
    mapfile -t commits < <(get_commits_for_file "$file")
    local count="${#commits[@]}"
    local commit_msg
    local commit_ts

    log_info "  Commits found: $count"

    if (( count == 0 )); then
        commit_msg="NO_COMMITS"
        commit_ts=0
        log_warn "  No commits found → classified as NO_COMMITS"

    elif (( count == 1 || count == 2 )); then
        selected="${commits[0]}"
        commit_ts="$(cut -d'|' -f2 <<< "$selected")"
        commit_msg="$(cut -d'|' -f3- <<< "$selected")"

    else
        selected="${commits[0]}"
        commit_ts="$(cut -d'|' -f2 <<< "$selected")"
        commit_msg="MULTIPLE_COMMITS"
        log_warn "  >2 commits → classified as MULTIPLE_COMMITS"
    fi

    # popula commitmsg_to_date se necessario
    if [[ -z "${commitmsg_to_date[$commit_msg]:-}" ]]; then
        commitmsg_to_date["$commit_msg"]="$commit_ts"
    fi

    commitmsg_to_files["$commit_msg"]+="$file"$'\n'
}

#######################################
# Output
#######################################
print_results() {
    log_info "Generate final output..."

    # ordinamento per timestamp
    mapfile -t ordered_msgs < <(
        for msg in "${!commitmsg_to_date[@]}"; do
            echo "${commitmsg_to_date[$msg]}|$msg"
        done | sort -nr | cut -d'|' -f2-
    )

    for msg in "${ordered_msgs[@]}"; do
        log_info "----------------------------------------"
        log_info ""
        log_info "Commit group: $msg"

        log_info "Files:"
        while IFS= read -r file; do
            [[ -z "$file" ]] && continue
            log_info "  $file"
        done <<< "${commitmsg_to_files[$msg]}"

        add_files=()
        rm_files=()

        while IFS= read -r file; do
            [[ -z "$file" ]] && continue
            status="${file_status[$file]}"

            if [[ "${status:0:1}" == "D" || "${status:1:1}" == "D" ]]; then
                rm_files+=("$file")
            else
                add_files+=("$file")
            fi
        done <<< "${commitmsg_to_files[$msg]}"

        if (( ${#add_files[@]} )); then
            log_info "  git add ${add_files[*]}"
        fi

        if (( ${#rm_files[@]} )); then
            log_info "  git rm ${rm_files[*]}"
        fi

        log_info "  git commit -m \"$msg (fixup)\""
    done
}

#######################################
# Main
#######################################
main() {
    while getopts ":n:h" opt; do
        case "$opt" in
            n)
                MAX_FILES="$OPTARG"
                [[ "$MAX_FILES" =~ ^[0-9]+$ ]] || {
                    log_error "-n requires a numeric argument"
                    exit 1
                }
                ;;
            h)
                usage
                exit 0
                ;;
            *)
                usage
                exit 1
                ;;
        esac
    done

    log_info "Detection of modified files..."

    mapfile -t entries < <(get_modified_files)

    if (( MAX_FILES > 0 && ${#entries[@]} > MAX_FILES )); then
        entries=( "${entries[@]:0:MAX_FILES}" )
        log_info "Limiting analysis to first $MAX_FILES files"
    fi

    log_info "Analysing ${#entries[@]} files"

    for entry in "${entries[@]}"; do
        status="${entry%%|*}"
        file="${entry#*|}"
        process_file "$status" "$file"
    done

    print_results
    log_info "Completed."
}

main "$@"
