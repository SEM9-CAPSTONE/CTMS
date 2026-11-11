abstract class PackageStorageCapacity {
  Future<int> availableBytes();
}

class PackageStorageException implements Exception {
  const PackageStorageException(this.message);
  final String message;
  @override
  String toString() => message;
}
