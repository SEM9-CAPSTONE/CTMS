import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

import 'report_photo_store.dart';

ReportPhotoStore createReportPhotoStore() => FileReportPhotoStore();

/// One file per photo in private application support storage; a flushed temporary file is
/// renamed into place so a crash never leaves a half-written photo behind.
class FileReportPhotoStore implements ReportPhotoStore {
  FileReportPhotoStore({this.root});
  final Directory? root;

  Future<File> _file(String key) async {
    final base = root ?? await getApplicationSupportDirectory();
    final directory = await Directory(
      '${base.path}/danger-zone-report-photos',
    ).create(recursive: true);
    return File('${directory.path}/${base64Url.encode(utf8.encode(key))}.bin');
  }

  @override
  Future<void> put(String key, Uint8List bytes) async {
    final file = await _file(key);
    final temporary = File('${file.path}.tmp');
    await temporary.writeAsBytes(bytes, flush: true);
    await temporary.rename(file.path);
  }

  @override
  Future<Uint8List?> get(String key) async {
    final file = await _file(key);
    return await file.exists() ? file.readAsBytes() : null;
  }

  @override
  Future<void> delete(String key) async {
    final file = await _file(key);
    if (await file.exists()) await file.delete();
  }
}
