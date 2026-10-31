#!/usr/bin/env python3
"""Automated Unit Tests for BIG/BIX Archive Parser.

Tests parsing logic, mathematical invariants, synthetic corruption, and bounds checking.
"""

import struct
import unittest
from pathlib import Path
from tools.big_bix_inspector import parse_bix_file, verify_archive, BIX_MAGIC

class TestBigBixParser(unittest.TestCase):

    def setUp(self):
        self.game_dir = Path(r"C:\Program Files (x86)\Steam\steamapps\common\SleepingDogsDefinitiveEdition")

    def test_prefab_data_real(self):
        bix_path = self.game_dir / "PrefabData.bix"
        if not bix_path.is_file():
            self.skipTest("Game file not present")
        archive = parse_bix_file(bix_path)
        self.assertEqual(archive.name, "PrefabData")
        self.assertEqual(archive.entry_count, 1)
        self.assertEqual(len(archive.entries), 1)
        v = verify_archive(archive)
        self.assertTrue(v["integrity_ok"])

    def test_global_bix_invariants(self):
        bix_path = self.game_dir / "Global.bix"
        if not bix_path.is_file():
            self.skipTest("Game file not present")
        archive = parse_bix_file(bix_path)
        self.assertEqual(archive.name, "Global")
        self.assertEqual(archive.entry_count, 913)
        v = verify_archive(archive)
        self.assertTrue(v["integrity_ok"])
        self.assertEqual(v["invariant_failures"], 0)
        self.assertEqual(v["bounds_failures"], 0)

    def test_synthetic_malformed_magic(self):
        # Create a synthetic 216-byte buffer with invalid magic
        bad_data = bytearray(216)
        struct.pack_into("<IIII", bad_data, 0, 0x12345678, 200, 200, 0)
        
        # Test directly
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bix") as tmp:
            tmp.write(bad_data)
            tmp_path = Path(tmp.name)
        
        try:
            with self.assertRaises(ValueError) as ctx:
                parse_bix_file(tmp_path)
            self.assertIn("Invalid BIX magic", str(ctx.exception))
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_synthetic_truncated_file(self):
        # Header specifies 10 entries (requires 0xC0 + 240 = 432 bytes), but file is only 200 bytes
        trunc_data = bytearray(200)
        struct.pack_into("<IIII", trunc_data, 0, BIX_MAGIC, 184, 184, 0)
        struct.pack_into("<I", trunc_data, 0x70, 10) # 10 entries claimed
        
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bix") as tmp:
            tmp.write(trunc_data)
            tmp_path = Path(tmp.name)
        
        try:
            with self.assertRaises(ValueError) as ctx:
                parse_bix_file(tmp_path)
            self.assertIn("Truncated BIX", str(ctx.exception))
        finally:
            tmp_path.unlink(missing_ok=True)

    def test_synthetic_out_of_bounds_detection(self):
        # Valid header with 1 entry that points way past the .big file size
        data = bytearray(0xC0 + 24)
        struct.pack_into("<IIII", data, 0, BIX_MAGIC, 0xC0 + 24 - 16, 0xC0 + 24 - 16, 0)
        struct.pack_into("<I", data, 0x70, 1) # 1 entry
        # Entry at 0xC0: offset = 10,000, total_span = 5,000 (exceeds a 1,000 byte dummy .big)
        struct.pack_into("<IIIIII", data, 0xC0, 0xCAFEBABE, 10000, 0, 0, 0, 5000)

        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".bix") as tmp_bix, \
             tempfile.NamedTemporaryFile(delete=False, suffix=".big") as tmp_big:
            tmp_bix.write(data)
            tmp_big.write(b"\0" * 1000) # Only 1000 bytes
            bix_p = Path(tmp_bix.name)
            big_p = Path(tmp_big.name)

        try:
            archive = parse_bix_file(bix_p)
            v = verify_archive(archive, big_path=big_p)
            self.assertFalse(v["integrity_ok"])
            self.assertEqual(v["bounds_failures"], 1)
        finally:
            bix_p.unlink(missing_ok=True)
            big_p.unlink(missing_ok=True)

if __name__ == "__main__":
    unittest.main()
