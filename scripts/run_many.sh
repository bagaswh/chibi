#!/bin/bash

pids=()

n=$1

for ((i = 1; i <= n; i++)); do
    HOSTNAME=$i npm run build:start-dev -- --config.file examples/etc/app/config2.yaml &
    pids+=($!)
done

pids_count=${#pids[@]}
for ((i = 0; i < ${pids_count}; i += 2)); do
    wait ${pids[$i]} || let "FAIL+=1"
done
