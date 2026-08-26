import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import fetch_opening_popularity as fop


def leaf(uci):
    return {"uci": uci, "children": []}


def node(uci, *children):
    return {"uci": uci, "children": list(children)}


class LeafCountTests(unittest.TestCase):
    def test_a_leaf_counts_as_one(self):
        self.assertEqual(fop.leaf_count(leaf("e2e4")), 1)

    def test_counts_leaves_below_a_branching_node(self):
        tree = node("e2e4", leaf("e7e5"), leaf("c7c5"), leaf("e7e6"))
        self.assertEqual(fop.leaf_count(tree), 3)

    def test_counts_leaves_recursively(self):
        tree = node("e2e4", node("e7e5", leaf("g1f3"), leaf("f1c4")), leaf("c7c5"))
        self.assertEqual(fop.leaf_count(tree), 3)


class DefiningPathTests(unittest.TestCase):
    def test_always_takes_the_first_ply_even_with_no_majority(self):
        # A dead-even split right at the root -- no "real" first move -- still
        # needs to take one step, or every family with this shape would query
        # the bare starting position instead of anything family-specific.
        tree = node("root", leaf("e2e4"), leaf("d2d4"))
        self.assertEqual(fop.defining_path(tree), ["e2e4"])  # first (most-weighted-or-tied) child

    def test_keeps_walking_through_a_dominant_branch(self):
        # 9 leaves down the e4 branch vs 1 down d4 -- 90% dominance, clearly
        # "the real line", so it should walk all the way to the real fork.
        e4_branch = node("e2e4", *[leaf(f"x{i}") for i in range(9)])
        d4_branch = leaf("d2d4")
        tree = node("root", e4_branch, d4_branch)
        self.assertEqual(fop.defining_path(tree), ["e2e4"])

    def test_stops_at_a_genuine_comparable_split(self):
        # After the dominant first move, three roughly-comparable branches --
        # a real theory fork -- should stop the walk right there.
        a = node("a", *[leaf(f"a{i}") for i in range(7)])  # ~78% of the e4 branch
        tree = node("root", node("e2e4", a, node("b", leaf("b0")), node("c", leaf("c0"))), leaf("d2d4"))
        path = fop.defining_path(tree)
        self.assertEqual(path, ["e2e4"])  # stops right after the dominant first ply

    def test_dominance_threshold_is_inclusive(self):
        # Exactly 80% should still count as dominant and keep walking.
        dominant = node("dom", *[leaf(f"d{i}") for i in range(8)])
        other = node("oth", leaf("o0"), leaf("o1"))
        tree = node("root", dominant, other)
        self.assertEqual(fop.defining_path(tree), ["dom"])


if __name__ == "__main__":
    unittest.main()
