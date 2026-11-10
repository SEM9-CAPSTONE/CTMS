import io
from pathlib import Path
import sqlite3
import tempfile
import unittest
from PIL import Image
from build_osm_raster import BOUNDS, project, tile_range, validate, road_style


class RasterValidationTests(unittest.TestCase):
    def test_road_hierarchy_and_trail_pattern_are_distinct(self):
        self.assertGreater(road_style('primary',16)[2],road_style('residential',16)[2])
        self.assertTrue(road_style('path',16)[3])
        self.assertFalse(road_style('primary',16)[3])
    def test_web_mercator_reference_and_northward_y(self):
        self.assertEqual(project(0, 0, 0), (128, 128))
        self.assertLess(project(0, 16, 12)[1], project(0, 0, 12)[1])

    def test_expected_coverage_counts(self):
        self.assertEqual([len(tile_range(BOUNDS, z)[0]) * len(tile_range(BOUNDS, z)[1])
                          for z in range(12, 17)], [4, 12, 36, 121, 420])

    def test_complete_placeholder_tiles_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'placeholder.mbtiles'
            db = sqlite3.connect(path)
            db.execute('CREATE TABLE tiles(zoom_level,tile_column,tile_row,tile_data)')
            buf = io.BytesIO()
            Image.new('RGB', (256, 256), 'white').save(buf, format='PNG')
            for z in range(12, 17):
                xs, ys = tile_range(BOUNDS, z)
                db.executemany('INSERT INTO tiles VALUES(?,?,?,?)',
                    [(z, x, (1 << z) - 1 - y, buf.getvalue()) for x in xs for y in ys])
            db.commit()
            db.close()
            with self.assertRaisesRegex(RuntimeError, 'Placeholder'):
                validate(path)

    def test_missing_tile_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'missing.mbtiles'
            db = sqlite3.connect(path)
            db.execute('CREATE TABLE tiles(zoom_level,tile_column,tile_row,tile_data)')
            db.commit()
            db.close()
            with self.assertRaisesRegex(RuntimeError, 'coverage mismatch'):
                validate(path)


if __name__ == '__main__':
    unittest.main()
