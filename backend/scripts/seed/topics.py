"""
Seed: Topics — Princeton Algorithms hierarchy
"""
from app.db.models import Topic

TOPICS = [
    # ── Top-level ──────────────────────────────────────────────────────
    {
        "slug": "fundamentals",
        "name": "Fundamentals",
        "description": "Core concepts: data abstraction, primitive types, arrays, I/O, and the scientific method for algorithm analysis.",
        "book_chapter": "Chapter 1",
        "book_url": "https://algs4.cs.princeton.edu/10fundamentals/",
        "display_order": 1,
        "parent_slug": None,
    },
    {
        "slug": "union-find",
        "name": "Union-Find",
        "description": "Dynamic connectivity, quick-find, quick-union, and weighted union-find with path compression.",
        "book_chapter": "1.5",
        "book_url": "https://algs4.cs.princeton.edu/15uf/",
        "display_order": 2,
        "parent_slug": "fundamentals",
    },
    {
        "slug": "sorting",
        "name": "Sorting",
        "description": "Comparison-based sorting algorithms, lower bounds, and applications.",
        "book_chapter": "Chapter 2",
        "book_url": "https://algs4.cs.princeton.edu/20sorting/",
        "display_order": 3,
        "parent_slug": None,
    },
    {
        "slug": "elementary-sorts",
        "name": "Elementary Sorts",
        "description": "Selection sort, insertion sort, shellsort — and why simple algorithms matter.",
        "book_chapter": "2.1",
        "book_url": "https://algs4.cs.princeton.edu/21elementary/",
        "display_order": 4,
        "parent_slug": "sorting",
    },
    {
        "slug": "mergesort",
        "name": "Mergesort",
        "description": "Top-down and bottom-up mergesort. Guaranteed O(n log n) with stable sort property.",
        "book_chapter": "2.2",
        "book_url": "https://algs4.cs.princeton.edu/22mergesort/",
        "display_order": 5,
        "parent_slug": "sorting",
    },
    {
        "slug": "quicksort",
        "name": "Quicksort",
        "description": "Partitioning, randomized quicksort, 3-way quicksort for duplicate keys.",
        "book_chapter": "2.3",
        "book_url": "https://algs4.cs.princeton.edu/23quicksort/",
        "display_order": 6,
        "parent_slug": "sorting",
    },
    {
        "slug": "priority-queues",
        "name": "Priority Queues & Heapsort",
        "description": "Binary heap, heap-ordered trees, heapsort, and the priority queue API.",
        "book_chapter": "2.4",
        "book_url": "https://algs4.cs.princeton.edu/24pq/",
        "display_order": 7,
        "parent_slug": "sorting",
    },
    {
        "slug": "searching",
        "name": "Searching",
        "description": "Symbol-table API, various implementations, and performance trade-offs.",
        "book_chapter": "Chapter 3",
        "book_url": "https://algs4.cs.princeton.edu/30searching/",
        "display_order": 8,
        "parent_slug": None,
    },
    {
        "slug": "bst",
        "name": "Binary Search Trees",
        "description": "BST definition, search, insert, floor/ceiling, deletion (Hibbard).",
        "book_chapter": "3.2",
        "book_url": "https://algs4.cs.princeton.edu/32bst/",
        "display_order": 9,
        "parent_slug": "searching",
    },
    {
        "slug": "balanced-bst",
        "name": "Balanced BSTs (Red-Black Trees)",
        "description": "2-3 trees, left-leaning red-black BSTs, rotations and color flips.",
        "book_chapter": "3.3",
        "book_url": "https://algs4.cs.princeton.edu/33balanced/",
        "display_order": 10,
        "parent_slug": "searching",
    },
    {
        "slug": "hash-tables",
        "name": "Hash Tables",
        "description": "Hash functions, separate chaining, linear probing, and resizing.",
        "book_chapter": "3.4",
        "book_url": "https://algs4.cs.princeton.edu/34hash/",
        "display_order": 11,
        "parent_slug": "searching",
    },
    {
        "slug": "graphs",
        "name": "Graphs",
        "description": "Graph terminology, representations, and foundational traversal algorithms.",
        "book_chapter": "Chapter 4",
        "book_url": "https://algs4.cs.princeton.edu/40graphs/",
        "display_order": 12,
        "parent_slug": None,
    },
    {
        "slug": "undirected-graphs",
        "name": "Undirected Graphs",
        "description": "DFS, BFS, connected components, bipartite detection.",
        "book_chapter": "4.1",
        "book_url": "https://algs4.cs.princeton.edu/41graph/",
        "display_order": 13,
        "parent_slug": "graphs",
    },
    {
        "slug": "directed-graphs",
        "name": "Directed Graphs (Digraphs)",
        "description": "Reachability, topological sort, Kosaraju-Sharir SCC algorithm.",
        "book_chapter": "4.2",
        "book_url": "https://algs4.cs.princeton.edu/42digraph/",
        "display_order": 14,
        "parent_slug": "graphs",
    },
    {
        "slug": "mst",
        "name": "Minimum Spanning Trees",
        "description": "Kruskal's, Prim's, and the cut property proof.",
        "book_chapter": "4.3",
        "book_url": "https://algs4.cs.princeton.edu/43mst/",
        "display_order": 15,
        "parent_slug": "graphs",
    },
    {
        "slug": "shortest-paths",
        "name": "Shortest Paths",
        "description": "Dijkstra's algorithm, Bellman-Ford, edge-weighted DAGs.",
        "book_chapter": "4.4",
        "book_url": "https://algs4.cs.princeton.edu/44sp/",
        "display_order": 16,
        "parent_slug": "graphs",
    },
    {
        "slug": "strings",
        "name": "Strings",
        "description": "String sorts, tries, KMP, Boyer-Moore, Rabin-Karp substring search.",
        "book_chapter": "Chapter 5",
        "book_url": "https://algs4.cs.princeton.edu/50strings/",
        "display_order": 17,
        "parent_slug": None,
    },
    {
        "slug": "dynamic-programming",
        "name": "Dynamic Programming",
        "description": "Memoization, tabulation, classic DP problems: LCS, knapsack, edit distance.",
        "book_chapter": "Appendix / Extended",
        "book_url": "https://algs4.cs.princeton.edu/",
        "display_order": 18,
        "parent_slug": None,
    },
]


def seed_topics(db) -> dict:
    """Returns slug -> Topic ORM object mapping."""
    slug_map: dict[str, Topic] = {}

    # First pass: create all topics without parent
    for t in TOPICS:
        topic = Topic(
            name=t["name"],
            description=t["description"],
            book_chapter=t["book_chapter"],
            book_url=t["book_url"],
            display_order=t["display_order"],
        )
        db.add(topic)
        db.flush()
        slug_map[t["slug"]] = topic

    # Second pass: assign parents
    for t in TOPICS:
        if t["parent_slug"]:
            slug_map[t["slug"]].parent_topic_id = slug_map[t["parent_slug"]].id

    db.flush()
    print(f"  ✓ {len(slug_map)} topics seeded")
    return slug_map
