# Local Background Remover

Tayar's Background Remover runs image inference in the user's browser. The selected image is not uploaded to Tayar, Supabase, fal.ai, Gemini, or another image-processing API.

## Runtime

- Model: U²-Net-P (`u2netp.onnx`), 320×320 salient-object segmentation.
- Model delivery: pinned `NovareOrbis/nova-ai-models@v3` asset via jsDelivr.
- Inference runtime: pinned `onnxruntime-web@1.22.0` via jsDelivr, WASM execution.
- The browser may cache the runtime/model after first use.
- Tayar still performs its normal tool-access check and records a completed usage counter after successful local processing. No image bytes are included in those Supabase RPCs.

## Licensing

U²-Net code/models are Apache-2.0 licensed by the upstream authors. The pinned model mirror documents the same upstream Apache-2.0 license. ONNX Runtime is MIT licensed.

## Legacy provider endpoint

The old Supabase `background-remover` Edge Function is retained only as a retired compatibility endpoint (`410 Gone`) after the local client is released, so older clients cannot accidentally incur fal.ai charges.
