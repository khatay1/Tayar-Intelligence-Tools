# Mobile model notice

Tayar Tools mobile uses the `u2netp_d0_320_fp16.tflite` model for on-device background removal.

- Upstream architecture: U²-Net / U2Netp by xuebinqin/U-2-Net
- Conversion source: `thetechgeekko/latent-android-models`
- Model file: `u2netp_d0_320_fp16.tflite`
- Input: float32 NHWC `[1, 320, 320, 3]`
- Output: float32 NHWC `[1, 320, 320, 1]`
- Expected size: 2,378,688 bytes
- SHA-256: `357bd5214d6725efd88dc1578de5308f8a80c6df63ac3f35c2021e955f4a4bc5`
- License: Apache-2.0

The build downloads the exact pinned artifact and verifies both byte length and SHA-256 before bundling it. Image processing remains on-device; the selected image is not uploaded for background removal.
