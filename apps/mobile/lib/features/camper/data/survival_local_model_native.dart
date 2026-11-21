import 'dart:async';
import 'dart:ffi';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:fllama/fllama.dart';
import 'package:path_provider/path_provider.dart';

import '../../offline_packages/data/device_package_storage_capacity.dart';
import 'survival_local_runtime_v1.dart';
import 'survival_model_store.dart';

// Keep compatible previous releases in this list when shipping a replacement.
const _trustedSurvivalReleases = [survivalModelRelease];

class SurvivalLocalModel {
  SurvivalLocalModel({required this.enabled});

  final bool enabled;
  bool _busy = false;

  bool get supported =>
      enabled &&
      (Abi.current() == Abi.androidArm64 || Abi.current() == Abi.iosArm64);

  Future<SurvivalModelStore> _store() async {
    final directory = await getApplicationSupportDirectory();
    return SurvivalModelStore(Directory('${directory.path}/survival-models'));
  }

  Future<bool> latestReady() async =>
      supported &&
      await (await _store()).active(const [survivalModelRelease]) != null;

  Future<void> download(void Function(int) progress) async {
    if (!supported || _busy) throw LocalModelFailure.unavailable;
    _busy = true;
    final http = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    try {
      await (await _store()).install(
        survivalModelRelease,
        availableBytes: DevicePackageStorageCapacity().availableBytes,
        download: () async* {
          final response = await http.get<ResponseBody>(
            survivalModelRelease.url,
            options: Options(responseType: ResponseType.stream),
          );
          final body = response.data;
          if (response.statusCode != HttpStatus.ok || body == null) {
            throw LocalModelFailure.download;
          }
          yield* body.stream.timeout(const Duration(seconds: 30));
        },
        probe: (path) => _withContext(path, (_, _) async {}),
        progress: progress,
      );
    } on LocalModelFailure {
      rethrow;
    } catch (_) {
      throw LocalModelFailure.download;
    } finally {
      http.close(force: true);
      _busy = false;
    }
  }

  Future<SurvivalLocalReply> generate(String question) async {
    if (!supported || _busy) throw LocalModelFailure.unavailable;
    _busy = true;
    try {
      final file = await (await _store()).active(_trustedSurvivalReleases);
      if (file == null) throw LocalModelFailure.unavailable;
      final release = _trustedSurvivalReleases.firstWhere(
        (release) => file.uri.pathSegments.last == '${release.digest}.gguf',
      );
      return await _withContext(file.path, (runtime, context) async {
        final observedAt = DateTime.now().toUtc();
        final completion = runtime.completion(
          context,
          prompt: renderLocalPromptV1(question),
          nPredict: localOutputTokensV1,
          nThreads: localThreadsV1,
          temperature: localTemperatureV1,
          stop: localStopV1,
        );
        final result = await completion.timeout(
          localTimeoutV1,
          onTimeout: () async {
            try {
              await runtime.stopCompletion(contextId: context);
            } finally {
              // Do not release the context while the native worker still owns it.
              try {
                await completion;
              } catch (_) {}
            }
            throw LocalModelFailure.inference;
          },
        );
        final value = result?['text'];
        if (value is! String || value.trim().isEmpty) {
          throw LocalModelFailure.inference;
        }
        return (
          text: value.trim(),
          modelId: release.modelId,
          modelVersion: release.digest,
          observedAt: observedAt,
          runtimeConfigVersion: localRuntimeConfigV1,
        );
      });
    } on LocalModelFailure {
      rethrow;
    } catch (_) {
      throw LocalModelFailure.inference;
    } finally {
      _busy = false;
    }
  }

  Future<T> _withContext<T>(
    String path,
    Future<T> Function(Fllama, double) use,
  ) async {
    final runtime = Fllama.instance();
    if (runtime == null) throw LocalModelFailure.unavailable;
    final result = await runtime.initContext(
      path,
      nCtx: localContextTokensV1,
      nBatch: localBatchTokensV1,
      nThreads: localThreadsV1,
      useMlock: localUseMlockV1,
    );
    final id = double.tryParse('${result?['contextId']}');
    if (id == null || !id.isFinite || id <= 0) {
      throw LocalModelFailure.inference;
    }
    try {
      return await use(runtime, id);
    } finally {
      await runtime.releaseContext(id);
    }
  }
}
