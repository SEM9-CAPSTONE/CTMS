import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/camper/data/survival_model_store.dart';

SurvivalModelRelease _release(List<int> bytes) =>
    SurvivalModelRelease('', bytes.length, sha256.convert(bytes).toString());

void main() {
  late Directory directory;
  late SurvivalModelStore store;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('ctms-survival-model');
    store = SurvivalModelStore(directory);
  });

  tearDown(() => directory.delete(recursive: true));

  Future<void> install(
    SurvivalModelRelease release,
    List<int> bytes, {
    int capacity = 100,
    Future<void> Function(String)? probe,
  }) => store.install(
    release,
    availableBytes: () async => capacity,
    download: () => Stream.value(bytes),
    probe: probe ?? (_) async {},
    progress: (_) {},
  );

  test('activates a matching artifact only after the runtime probe', () async {
    final release = _release([1, 2, 3]);
    await install(
      release,
      [1, 2, 3],
      probe: (path) async {
        expect(await File(path).readAsBytes(), [1, 2, 3]);
        expect(await store.active([release]), isNull);
      },
    );
    final active = (await store.active([release]))!;
    expect(await active.readAsBytes(), [1, 2, 3]);
    await active.writeAsBytes([1, 1, 1]);
    expect(await store.active([release]), isNull);
  });

  test(
    'a bad digest, short download or runtime error leaves the old model usable',
    () async {
      final current = _release([1, 2, 3]);
      final candidate = _release([3, 4, 5]);
      await install(current, [1, 2, 3]);
      for (final badBytes in [
        [3, 4],
        [4, 5, 6],
      ]) {
        await expectLater(
          install(candidate, badBytes),
          throwsA(LocalModelFailure.download),
        );
      }
      await expectLater(
        install(
          candidate,
          [3, 4, 5],
          probe: (_) async {
            throw LocalModelFailure.inference;
          },
        ),
        throwsA(LocalModelFailure.inference),
      );
      expect(await store.active([candidate]), isNull);
      final active = (await store.active([candidate, current]))!;
      expect(await active.readAsBytes(), [1, 2, 3]);
      expect(await directory.list().length, 1);
    },
  );

  test('does not start downloading without staging space', () async {
    final release = _release([1, 2, 3]);
    await expectLater(
      store.install(
        release,
        availableBytes: () async => 2,
        download: () => throw StateError('Unexpected download'),
        probe: (_) async {},
        progress: (_) {},
      ),
      throwsA(LocalModelFailure.storage),
    );
    expect(await directory.list().isEmpty, isTrue);
  });
}
