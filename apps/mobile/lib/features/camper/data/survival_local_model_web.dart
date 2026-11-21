import 'survival_model_store.dart';

class SurvivalLocalModel {
  SurvivalLocalModel({required bool enabled});

  bool get enabled => false;
  bool get supported => false;
  Future<bool> latestReady() async => false;

  Future<void> download(void Function(int) progress) async =>
      throw LocalModelFailure.unavailable;

  Future<SurvivalLocalReply> generate(String question) async =>
      throw LocalModelFailure.unavailable;
}
