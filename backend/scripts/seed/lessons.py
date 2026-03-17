"""
Seed: Lessons & Materials — Princeton Algorithms
"""
from app.db.models import Lesson, Material


LESSONS_DATA = {
    "union-find": [
        {
            "title": "Dynamic Connectivity & Union-Find",
            "summary": "Introduction to the union-find data structure. We model connectivity as an equivalence relation and develop increasingly efficient implementations.",
            "content_markdown": """## Dynamic Connectivity

The **Union-Find** (Disjoint-Set Union) data structure solves the **dynamic connectivity** problem:

> Given a set of N objects, support two operations:
> - **Union**: connect two objects
> - **Find/Connected**: is there a path connecting two objects?

### Applications
- Network connectivity (Ethernet segments, social networks)
- Kruskal's MST algorithm
- Percolation (physics simulations)

### Implementations
| Algorithm | Union | Find | Notes |
|---|---|---|---|
| Quick-Find | O(n) | O(1) | Too slow for large inputs |
| Quick-Union | O(n) | O(n) | Tall trees → slow |
| Weighted QU | O(log n) | O(log n) | Bounded tree height |
| Weighted + Path Compression | ≈ O(1) amortized | ≈ O(1) | Near optimal |

### Weighted Quick-Union with Path Compression
```python
class UnionFind:
    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x

    def union(self, x, y):
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        if self.size[px] < self.size[py]:
            px, py = py, px
        self.parent[py] = px
        self.size[px] += self.size[py]
        return True
```
""",
            "estimated_minutes": 25,
            "display_order": 1,
            "princeton_section": "1.5 Union-Find",
            "materials": [
                {
                    "title": "Princeton Lecture Slides — Union-Find",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/15uf/15UnionFind.pdf",
                    "description": "Official Princeton COS226 lecture slides on Union-Find",
                },
                {
                    "title": "Union-Find Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/15uf/",
                    "description": "Interactive visualization of Union-Find operations",
                },
            ],
        }
    ],
    "elementary-sorts": [
        {
            "title": "Selection & Insertion Sort",
            "summary": "Two fundamental O(n²) sorting algorithms. Simple to implement, effective for small arrays, and important for understanding what makes better algorithms better.",
            "content_markdown": """## Elementary Sorting Algorithms

### Selection Sort
At each step, find the **minimum** element from the unsorted portion and swap it to its final position.

- **Time:** O(n²) always — makes exactly n(n-1)/2 comparisons
- **Swaps:** O(n) — data movement is minimal
- **Stable?** No

```python
def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i+1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
```

### Insertion Sort
Build a sorted sub-array one element at a time by shifting elements right.

- **Time:** O(n²) worst, O(n) best (already sorted)
- **Best for:** small arrays, nearly-sorted data
- **Stable?** Yes

```python
def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j+1] = arr[j]
            j -= 1
        arr[j+1] = key
```

### When to use each?
- Selection sort: when data movement is expensive
- Insertion sort: small arrays, nearly sorted data, as a subroutine in hybrid algorithms (like Timsort)
""",
            "estimated_minutes": 20,
            "display_order": 1,
            "princeton_section": "2.1 Elementary Sorts",
            "materials": [
                {
                    "title": "Princeton Slides — Elementary Sorts",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/21elementary/21ElementarySorts.pdf",
                    "description": "Official lecture slides",
                },
                {
                    "title": "Sorting Algorithms Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/21elementary/",
                    "description": "Visual comparison of elementary sorting algorithms",
                },
            ],
        }
    ],
    "mergesort": [
        {
            "title": "Mergesort",
            "summary": "Divide-and-conquer sorting. Guaranteed O(n log n) performance. The algorithm of choice for sorting linked lists and external sorting.",
            "content_markdown": """## Mergesort

### Core idea: Divide and Conquer
1. Divide array in half
2. Recursively sort each half
3. **Merge** the two sorted halves

### Complexity
| Case | Time | Space |
|---|---|---|
| Best | O(n log n) | O(n) |
| Average | O(n log n) | O(n) |
| Worst | O(n log n) | O(n) |

**Stable? Yes** — equal elements preserve their original order.

### Top-down (recursive)
```python
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]
```

### Key insight: recurrence
T(n) = 2T(n/2) + O(n) → **O(n log n)** by the Master Theorem.
""",
            "estimated_minutes": 25,
            "display_order": 1,
            "princeton_section": "2.2 Mergesort",
            "materials": [
                {
                    "title": "Princeton Slides — Mergesort",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/22mergesort/22Mergesort.pdf",
                    "description": "Official lecture slides on mergesort",
                },
                {
                    "title": "Mergesort Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/22mergesort/",
                    "description": "Step-by-step mergesort visualization",
                },
            ],
        }
    ],
    "quicksort": [
        {
            "title": "Quicksort & Partitioning",
            "summary": "The most widely used sorting algorithm in practice. Randomization eliminates worst-case inputs.",
            "content_markdown": """## Quicksort

### Algorithm
1. Pick a **pivot**
2. **Partition**: rearrange so elements < pivot come before, elements > pivot come after
3. Recursively sort each partition

### Complexity
| Case | Time | Notes |
|---|---|---|
| Best | O(n log n) | Pivot always splits evenly |
| Average | O(n log n) | With random shuffle |
| Worst | O(n²) | All elements equal or sorted input |

**Stable? No. In-place? Yes** (O(log n) stack space).

### Lomuto Partition
```python
def partition(arr, lo, hi):
    pivot = arr[hi]
    i = lo
    for j in range(lo, hi):
        if arr[j] <= pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[hi] = arr[hi], arr[i]
    return i
```

### Key insight: randomization
Shuffling the input before sorting guarantees O(n log n) expected time regardless of input.

### 3-Way Quicksort
When many duplicate keys exist, standard quicksort degrades. 3-way partition handles equal elements in O(n) for arrays with a constant number of distinct keys.
""",
            "estimated_minutes": 30,
            "display_order": 1,
            "princeton_section": "2.3 Quicksort",
            "materials": [
                {
                    "title": "Princeton Slides — Quicksort",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/23quicksort/23Quicksort.pdf",
                    "description": "Official lecture slides on Quicksort",
                },
                {
                    "title": "Quicksort Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/23quicksort/",
                    "description": "Interactive Quicksort visualization with partition steps",
                },
            ],
        }
    ],
    "bst": [
        {
            "title": "Binary Search Trees",
            "summary": "Symbol-table implementation using a tree structure. Supports ordered operations: floor, ceiling, rank, select.",
            "content_markdown": """## Binary Search Trees (BST)

A **BST** is a binary tree where:
- Every node's key > all keys in its left subtree
- Every node's key < all keys in its right subtree

### Core Operations
| Operation | Average | Worst |
|---|---|---|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| Min/Max | O(log n) | O(n) |

### Node structure
```python
class Node:
    def __init__(self, key, val):
        self.key, self.val = key, val
        self.left = self.right = None
        self.size = 1   # subtree count
```

### Search
```python
def get(root, key):
    if root is None: return None
    if key < root.key: return get(root.left, key)
    if key > root.key: return get(root.right, key)
    return root.val
```

### Hibbard Deletion
The standard deletion — replace with in-order successor (min of right subtree). In practice, this can cause tree asymmetry over many operations.

### Weakness
A BST built from sorted input degenerates to a linked list → O(n) operations. **Fix:** Balanced BSTs (Red-Black, AVL).
""",
            "estimated_minutes": 30,
            "display_order": 1,
            "princeton_section": "3.2 Binary Search Trees",
            "materials": [
                {
                    "title": "Princeton Slides — BST",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/32bst/32BST.pdf",
                    "description": "Official lecture slides on BST",
                },
                {
                    "title": "BST Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/32bst/",
                    "description": "Interactive BST with insert, delete, search",
                },
            ],
        }
    ],
    "undirected-graphs": [
        {
            "title": "Graph Traversal: DFS & BFS",
            "summary": "Depth-first and breadth-first search are the foundation of nearly every graph algorithm.",
            "content_markdown": """## Undirected Graphs

### Representations
- **Adjacency matrix:** O(V²) space. O(1) edge query. For dense graphs.
- **Adjacency list:** O(V+E) space. For sparse graphs (most real-world).

### Depth-First Search (DFS)
Explores as deep as possible before backtracking.
```python
def dfs(graph, v, visited):
    visited.add(v)
    for w in graph[v]:
        if w not in visited:
            dfs(graph, w, visited)
```
- **Connected components, cycle detection, bipartite check**
- Time: O(V+E)

### Breadth-First Search (BFS)
Explores all neighbors at distance k before distance k+1.
```python
from collections import deque
def bfs(graph, s):
    dist = {s: 0}
    queue = deque([s])
    while queue:
        v = queue.popleft()
        for w in graph[v]:
            if w not in dist:
                dist[w] = dist[v] + 1
                queue.append(w)
    return dist
```
- **Shortest path (unweighted), level-order traversal**
- Time: O(V+E)
""",
            "estimated_minutes": 35,
            "display_order": 1,
            "princeton_section": "4.1 Undirected Graphs",
            "materials": [
                {
                    "title": "Princeton Slides — Undirected Graphs",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/41graph/41UndirectedGraphs.pdf",
                    "description": "Official lecture slides",
                },
                {
                    "title": "Graph DFS/BFS Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/41graph/",
                    "description": "Interactive graph traversal visualization",
                },
            ],
        }
    ],
    "shortest-paths": [
        {
            "title": "Dijkstra's Algorithm & Bellman-Ford",
            "summary": "Single-source shortest paths in weighted graphs. Dijkstra for non-negative weights, Bellman-Ford for negative weights.",
            "content_markdown": """## Shortest Paths

### Dijkstra's Algorithm
Greedy approach using a **priority queue** (min-heap).

**Requirement:** No negative edge weights.

```python
import heapq
def dijkstra(graph, src):
    dist = {v: float('inf') for v in graph}
    dist[src] = 0
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]: continue
        for v, w in graph[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))
    return dist
```
- **Time:** O((V+E) log V) with binary heap
- **Space:** O(V)

### Bellman-Ford
Handles **negative edge weights**. Detects negative cycles.

```python
def bellman_ford(edges, V, src):
    dist = [float('inf')] * V
    dist[src] = 0
    for _ in range(V - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    # Check for negative cycles
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None  # negative cycle exists
    return dist
```
- **Time:** O(V·E)
""",
            "estimated_minutes": 40,
            "display_order": 1,
            "princeton_section": "4.4 Shortest Paths",
            "materials": [
                {
                    "title": "Princeton Slides — Shortest Paths",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/44sp/44ShortestPaths.pdf",
                    "description": "Official lecture slides on shortest paths",
                },
                {
                    "title": "Dijkstra Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/44sp/",
                    "description": "Interactive Dijkstra's algorithm visualization",
                },
            ],
        }
    ],
    "hash-tables": [
        {
            "title": "Hash Tables: Chaining & Linear Probing",
            "summary": "O(1) average-case search, insert, delete. Two collision resolution strategies with different trade-offs.",
            "content_markdown": """## Hash Tables

### The Hash Function
A good hash function distributes keys **uniformly** across the table.

```python
# Simple string hash (polynomial rolling)
def hash_str(s, M):
    h = 0
    for c in s:
        h = (31 * h + ord(c)) % M
    return h
```

### Separate Chaining
Each bucket holds a linked list of key-value pairs.
- **Load factor α = N/M** (N keys, M buckets)
- Average O(1) when α ≤ some constant (typically 2–5)

### Linear Probing (Open Addressing)
Store keys directly in the table. On collision, probe next available slot.
```python
def probe(table, key, M):
    h = hash(key) % M
    while table[h] is not None and table[h][0] != key:
        h = (h + 1) % M
    return h
```
- Requires **α < 1** (must have empty slots)
- Performance degrades as α → 1 (clustering)

### Resizing
When α exceeds threshold, **double** the table and rehash all keys.
""",
            "estimated_minutes": 25,
            "display_order": 1,
            "princeton_section": "3.4 Hash Tables",
            "materials": [
                {
                    "title": "Princeton Slides — Hash Tables",
                    "type": "pdf",
                    "url": "https://algs4.cs.princeton.edu/34hash/34HashTables.pdf",
                    "description": "Official lecture slides on Hash Tables",
                },
                {
                    "title": "Hash Table Visualization",
                    "type": "visualization",
                    "url": "https://algs4.cs.princeton.edu/34hash/",
                    "description": "Interactive hash table with chaining and probing",
                },
            ],
        }
    ],
    "fundamentals": [
        {
            "title": "Introduction to Algorithms",
            "summary": "Core concepts and the scientific method of analyzing algorithms.",
            "content_markdown": "## Fundamentals\n\nAlgorithms are the heart of computer science... (Content goes here)",
            "estimated_minutes": 20,
            "display_order": 1,
            "princeton_section": "1.1",
            "materials": []
        }
    ],
    "sorting": [
        {
            "title": "Sorting Algorithms Overview",
            "summary": "An overview of comparison-based sorting.",
            "content_markdown": "## Sorting Overview\n\nSorting is fundamental to data processing...",
            "estimated_minutes": 15,
            "display_order": 1,
            "princeton_section": "Chapter 2",
            "materials": []
        }
    ],
    "priority-queues": [
        {
            "title": "Priority Queues",
            "summary": "Data structures that behave like queues but with ordering criteria.",
            "content_markdown": "## Priority Queues\n\nUseful for optimization and path finding.",
            "estimated_minutes": 25,
            "display_order": 1,
            "princeton_section": "2.4",
            "materials": []
        }
    ],
    "searching": [
        {
            "title": "Searching Essentials",
            "summary": "An introduction to search and symbol tables.",
            "content_markdown": "## Searching\n\nFinding elements in a collection efficiently.",
            "estimated_minutes": 15,
            "display_order": 1,
            "princeton_section": "Chapter 3",
            "materials": []
        }
    ],
    "balanced-bst": [
        {
            "title": "Balanced BSTs",
            "summary": "Red-Black Trees and guaranteed logarithmic performance.",
            "content_markdown": "## Balanced BSTs\n\nAvoids linear worst case time complexity.",
            "estimated_minutes": 35,
            "display_order": 1,
            "princeton_section": "3.3",
            "materials": []
        }
    ],
    "graphs": [
        {
            "title": "Graph Applications",
            "summary": "Introduction to wide array of graph applications.",
            "content_markdown": "## Graphs\n\nA mathematical structure to model pairwise relations between objects.",
            "estimated_minutes": 15,
            "display_order": 1,
            "princeton_section": "Chapter 4",
            "materials": []
        }
    ],
    "directed-graphs": [
        {
            "title": "Digraphs",
            "summary": "Graphs where edges have a direction associated with them.",
            "content_markdown": "## Digraphs\n\nDirected applications such as web linking and prerequisites.",
            "estimated_minutes": 25,
            "display_order": 1,
            "princeton_section": "4.2",
            "materials": []
        }
    ],
    "mst": [
        {
            "title": "Minimum Spanning Trees",
            "summary": "Finding the cheapest network to connect all nodes.",
            "content_markdown": "## Minimum Spanning Trees\n\nKruskal and Prim algorithms.",
            "estimated_minutes": 30,
            "display_order": 1,
            "princeton_section": "4.3",
            "materials": []
        }
    ],
    "strings": [
        {
            "title": "String Processing",
            "summary": "Advanced string processing and algorithms.",
            "content_markdown": "## String Processing\n\nText processing is ubiquitous in computer applications.",
            "estimated_minutes": 35,
            "display_order": 1,
            "princeton_section": "Chapter 5",
            "materials": []
        }
    ],
    "dynamic-programming": [
        {
            "title": "Dynamic Programming",
            "summary": "Breaking down problems into simpler sub-problems.",
            "content_markdown": "## Dynamic Programming\n\nMemoization and bottom-up solutions.",
            "estimated_minutes": 40,
            "display_order": 1,
            "princeton_section": "Extra",
            "materials": []
        }
    ]
}



def seed_lessons(db, topic_map: dict) -> dict:
    """Seed lessons and materials. Returns slug -> [Lesson] mapping."""
    lesson_map: dict[str, list] = {}

    for topic_slug, lessons_list in LESSONS_DATA.items():
        topic = topic_map.get(topic_slug)
        if not topic:
            print(f"  ⚠ Topic not found: {topic_slug}")
            continue

        for idx, l_data in enumerate(lessons_list):
            lesson = Lesson(
                topic_id=topic.id,
                title=l_data["title"],
                summary=l_data["summary"],
                content_markdown=l_data["content_markdown"],
                estimated_minutes=l_data["estimated_minutes"],
                display_order=l_data["display_order"],
                princeton_section=l_data["princeton_section"],
            )
            db.add(lesson)
            db.flush()

            for m_idx, m_data in enumerate(l_data.get("materials", [])):
                material = Material(
                    lesson_id=lesson.id,
                    title=m_data["title"],
                    type=m_data["type"],
                    url=m_data["url"],
                    description=m_data.get("description"),
                    display_order=m_idx,
                )
                db.add(material)

            lesson_map.setdefault(topic_slug, []).append(lesson)

    db.flush()
    total_lessons = sum(len(v) for v in lesson_map.values())
    print(f"  ✓ {total_lessons} lessons + materials seeded")
    return lesson_map
