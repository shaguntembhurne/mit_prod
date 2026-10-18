#!/bin/bash
set -euo pipefail

LLAMA="/home/adwait/llama.cpp/build/bin/llama-server"
MODEL="/home/adwait/models/gemma4-12B/gemma-4-12B-it-qat-UD-Q4_K_XL.gguf"

GPU_IDS="${1:?Usage: ./start_gemma.sh 0 OR ./start_gemma.sh 0,2}"

if ! [[ "$GPU_IDS" =~ ^[0-3](,[0-3])?$ ]]; then
    echo "Choose one GPU (e.g. 0) or two GPUs (e.g. 0,2)."
    exit 1
fi

IFS=',' read -ra GPUS <<< "$GPU_IDS"
GPU_COUNT="${#GPUS[@]}"

if [[ "$GPU_COUNT" -eq 2 && "${GPUS[0]}" == "${GPUS[1]}" ]]; then
    echo "Duplicate GPU IDs."
    exit 1
fi

if [[ ! -x "$LLAMA" || ! -r "$MODEL" ]]; then
    echo "Cannot access llama-server or model file."
    exit 1
fi

echo "GPU memory before startup:"
nvidia-smi --query-gpu=index,memory.free --format=csv

export CUDA_VISIBLE_DEVICES="$GPU_IDS"

if [[ "$GPU_COUNT" -eq 1 ]]; then
    exec "$LLAMA" \
        --model "$MODEL" \
        --n-gpu-layers 99 \
        --ctx-size 8192 \
        --parallel 4 \
        --cont-batching \
        --flash-attn on \
        --host 127.0.0.1 \
        --port 2001
else
    exec "$LLAMA" \
        --model "$MODEL" \
        --n-gpu-layers 99 \
        --split-mode layer \
        --tensor-split 1,1 \
        --ctx-size 32768 \
        --parallel 8 \
        --cont-batching \
        --flash-attn on \
        --host 127.0.0.1 \
        --port 2001
fi