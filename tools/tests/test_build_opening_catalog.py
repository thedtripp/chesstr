import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import build_opening_catalog as boc


class FamilyOfTests(unittest.TestCase):
    def test_strips_everything_after_the_first_colon(self):
        self.assertEqual(boc.family_of("Sicilian Defense: Najdorf Variation"), "Sicilian Defense")

    def test_leaves_a_name_with_no_colon_untouched(self):
        self.assertEqual(boc.family_of("Vienna Gambit"), "Vienna Gambit")


class SlugifyTests(unittest.TestCase):
    def test_lowercases_and_underscores(self):
        self.assertEqual(boc.slugify("Queen's Gambit Declined"), "queen_s_gambit_declined")

    def test_strips_leading_and_trailing_separators(self):
        self.assertEqual(boc.slugify("  Réti Opening!! "), "r_ti_opening")


class BuildFamilyTreeTests(unittest.TestCase):
    def test_merges_rows_sharing_a_move_prefix_into_one_branching_tree(self):
        entries = [
            ("B00", "King's Pawn Game", "1. e4"),
            ("B01", "Scandinavian Defense", "1. e4 d5"),
            ("B02", "Alekhine Defense", "1. e4 Nf6"),
        ]
        tree = boc.build_family_tree(entries)

        self.assertEqual(len(tree["children"]), 1)  # single shared first move
        e4 = tree["children"][0]
        self.assertEqual(e4["uci"], "e2e4")
        self.assertEqual(e4["name"], "King's Pawn Game")
        self.assertEqual(len(e4["children"]), 2)  # branches into d5 and Nf6

        names = sorted(c["name"] for c in e4["children"])
        self.assertEqual(names, ["Alekhine Defense", "Scandinavian Defense"])

    def test_untagged_intermediate_nodes_have_no_name_key(self):
        entries = [("C00", "French Defense: Advance Variation", "1. e4 e6 2. d4 d5 3. e5")]
        tree = boc.build_family_tree(entries)
        e4 = tree["children"][0]
        self.assertNotIn("name", e4)  # only the row's terminal node is tagged
        e6 = e4["children"][0]
        self.assertNotIn("name", e6)


if __name__ == "__main__":
    unittest.main()
