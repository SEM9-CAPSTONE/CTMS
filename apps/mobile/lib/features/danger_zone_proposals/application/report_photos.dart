import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

/// Returns the picked photo already resized for upload, or null when the Porter cancels.
typedef ReportPhotoPicker = Future<Uint8List?> Function(ImageSource source);

final reportPhotoPickerProvider = Provider<ReportPhotoPicker>(
  (ref) => (source) async {
    final file = await ImagePicker().pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 80,
    );
    return file?.readAsBytes();
  },
);

/// The server checks the same signatures; checking here keeps unusable files out of the queue.
bool isSupportedReportPhoto(Uint8List bytes) {
  final jpeg =
      bytes.length > 3 &&
      bytes[0] == 0xff &&
      bytes[1] == 0xd8 &&
      bytes[2] == 0xff;
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  final png =
      bytes.length > 8 &&
      List.generate(8, (i) => bytes[i] == pngSignature[i]).every((v) => v);
  final webp =
      bytes.length > 12 &&
      String.fromCharCodes(bytes.sublist(0, 4)) == 'RIFF' &&
      String.fromCharCodes(bytes.sublist(8, 12)) == 'WEBP';
  return jpeg || png || webp;
}
