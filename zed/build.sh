#!/bin/bash

# Build script for MarkAsset Zed Extension

echo "Building MarkAsset Zed Extension..."

# Build for WASM target (required for Zed extensions)
cargo build --target wasm32-wasip1 --release

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📁 Extension binary: target/wasm32-wasi/release/markasset.wasm"
    echo ""
    echo "To install in Zed:"
    echo "1. Copy this entire 'zed' folder to your Zed extensions directory"
    echo "2. Or use Zed's extension installation command"
else
    echo "❌ Build failed!"
    exit 1
fi
