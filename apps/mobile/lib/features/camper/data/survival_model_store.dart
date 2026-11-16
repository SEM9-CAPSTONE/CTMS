import 'dart:io';

import 'package:crypto/crypto.dart';

enum LocalModelFailure { unavailable, storage, download, inference }

typedef SurvivalLocalReply = ({
  String text,
  String? modelId,
  String? modelVersion,
  DateTime observedAt,
  String? runtimeConfigVersion,
});

class SurvivalModelRelease {
  const SurvivalModelRelease(
    this.url,
    this.byteLength,
    this.digest, {
    this.modelId,
  });

  final String url;
  final int byteLength;
  final String digest;
  final String? modelId;
}

const survivalModelRelease = SurvivalModelRelease(
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/'
      '6dd44a1fb35d11b5d1b28902876ce3cc9e882d0e/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  491400032,
  '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
  modelId: 'Qwen2.5-0.5B-Instruct-GGUF-Q4_K_M',
);

class SurvivalModelStore {
  SurvivalModelStore(this.root);

  final Directory root;

  File _file(SurvivalModelRelease release) =>
      File('${root.path}/${release.digest}.gguf');

  Future<File?> active(List<SurvivalModelRelease> trustedReleases) async {
    for (final release in trustedReleases) {
      final file = _file(release);
      if (await _matches(file, release)) return file;
    }
    return null;
  }

  Future<void> install(
    SurvivalModelRelease release, {
    required Future<int> Function() availableBytes,
    required Stream<List<int>> Function() download,
    required Future<void> Function(String) probe,
    required void Function(int) progress,
  }) async {
    if (await active([release]) != null) return;
    await root.create(recursive: true);
    final destination = _file(release);
    final staged = File('${destination.path}.part.gguf');
    if (await staged.exists()) await staged.delete();
    if (await availableBytes() < release.byteLength) {
      throw LocalModelFailure.storage;
    }
    try {
      final sink = staged.openWrite();
      var bytes = 0;
      try {
        await sink.addStream(
          download().map((block) {
            bytes += block.length;
            if (bytes > release.byteLength) throw LocalModelFailure.download;
            progress(bytes);
            return block;
          }),
        );
      } finally {
        await sink.close();
      }
      if (!await _matches(staged, release)) throw LocalModelFailure.download;
      await probe(staged.path);
      await staged.rename(destination.path);
    } finally {
      if (await staged.exists()) await staged.delete();
    }
  }

  Future<bool> _matches(File file, SurvivalModelRelease release) async {
    if (!await file.exists() || await file.length() != release.byteLength) {
      return false;
    }
    return (await sha256.bind(file.openRead()).first).toString() ==
        release.digest;
  }
}
