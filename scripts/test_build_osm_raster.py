import io
from pathlib import Path
import sqlite3
import tempfile
import unittest
from PIL import Image
from build_osm_raster import BOUNDS, project, tile_range, validate, road_style, preflight


class RasterValidationTests(unittest.TestCase):
    def test_preflight_rejects_large_invalid_and_excessive_tile_regions(self):
        for bounds,reason in [((108,16,109,17),'REGION_TOO_LARGE'),
                              ((108,16,108.35,16.35),'TILE_LIMIT_EXCEEDED'),
                              ((108,16,float('nan'),17),'BOUNDS_INVALID'),
                              ((108,84,109,86),'REGION_UNSUPPORTED')]:
            with self.assertRaisesRegex(RuntimeError,reason): preflight(bounds)

    def test_two_regions_have_independent_tile_coverage(self):
        for bounds in [(108.26,16.09,108.30,16.13),(108.42,11.92,108.46,11.96)]:
            counts=preflight(bounds)
            self.assertEqual(set(counts),set(range(12,17)))
            self.assertTrue(all(value>0 for value in counts.values()))

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
