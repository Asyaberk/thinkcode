"""
seed_algorithms_content.py — Sedgewick & Wayne Algorithms 4th Ed. içerik seed scripti.

Bu script:
  1. Mevcut topic/lesson/problem kayıtlarını TEMİZLER (safe: submissions korunur)
  2. 18 konu için kitaba uygun ders markdown'ları ekler
  3. Her konu için MCQ + Coding soruları ekler
  4. Problemler için seçenekler (ProblemOption) ekler

Kullanım:
  docker exec thinkcode-backend python /app/scripts/seed/seed_algorithms_content.py
"""

import sys
import os
sys.path.insert(0, "/app")

from app.db.session import SessionLocal
from app.db.models import Topic, Lesson, Problem, ProblemOption, ProblemHint
from scripts.seed.topics import seed_topics

# ─────────────────────────────────────────────────────────────────────────────
# LESSON CONTENT — Her topic slug için markdown ders içeriği
# Princeton Algorithms 4th Ed. kitabına göre yazılmıştır
# ─────────────────────────────────────────────────────────────────────────────

LESSONS = {
    "fundamentals": {
        "title": "Fundamentals of Algorithm Analysis",
        "estimated_minutes": 30,
        "content": r"""
# Fundamentals of Algorithm Analysis

Welcome to **Algorithms, 4th Edition** by Sedgewick & Wayne. This course uses Java but the concepts are universal.

## The Scientific Method

Good algorithm analysis follows the scientific method:
1. **Observe** some feature of the natural world
2. **Hypothesize** a model consistent with observations
3. **Predict** events using the hypothesis
4. **Verify** predictions by further observation
5. **Validate** your hypothesis

## Order of Growth Classifications

| Description | Function | Code example |
|---|---|---|
| Constant | 1 | `a = b + c` |
| Logarithmic | log N | Binary search |
| Linear | N | Sequential search |
| Linearithmic | N log N | Mergesort |
| Quadratic | N² | Insertion sort |
| Exponential | 2^N | Exhaustive search |

## Memory Usage

In Java, an `int` is 4 bytes, a `double` is 8 bytes. An array of N doubles uses ~8N bytes.

```java
// Example: measure empirical running time
long start = System.currentTimeMillis();
// ... run algorithm ...
long elapsed = System.currentTimeMillis() - start;
System.out.println(elapsed + "ms");
```

## Big-O Notation

- **O(f(N))**: upper bound (worst case)
- **Ω(f(N))**: lower bound (best case)  
- **Θ(f(N))**: tight bound (exact order)

> 📖 **Book Reference:** [Chapter 1.4 — Analysis of Algorithms](https://algs4.cs.princeton.edu/14analysis/)
""",
    },
    "union-find": {
        "title": "Union-Find (Disjoint Sets)",
        "estimated_minutes": 45,
        "content": r"""
# Union-Find

Union-Find (also called Disjoint Set Union) solves the **dynamic connectivity** problem.

## The Problem

Given N objects, support two operations:
- `union(p, q)` — connect two objects
- `connected(p, q)` — are they connected?

## Quick-Find

Store component ID for each object. 

```java
int[] id = new int[N];
// union: change all entries equal to id[p] to id[q]  — O(N)
// find:  id[p] == id[q]  — O(1)
```

**Problem:** `union` is too slow O(N).

## Quick-Union

Store parent links (a forest of trees).

```java
int[] parent = new int[N];
int root(int i) {
    while (i != parent[i]) i = parent[i];  // follow links to root
    return i;
}
// union: parent[root(p)] = root(q)  — O(N) worst case
// find:  root(p) == root(q)         — O(N) worst case
```

## Weighted Quick-Union with Path Compression

The best practical solution:

```java
// Always link smaller tree under larger tree
// Path compression: make every node point to its grandparent
int root(int i) {
    while (i != parent[i]) {
        parent[i] = parent[parent[i]];  // path compression (halving)
        i = parent[i];
    }
    return i;
}
```

**Performance:** Nearly O(1) per operation (amortized O(log* N)).

> 📖 **Book Reference:** [Chapter 1.5 — Union-Find](https://algs4.cs.princeton.edu/15uf/)
""",
    },
    "elementary-sorts": {
        "title": "Elementary Sorting Algorithms",
        "estimated_minutes": 40,
        "content": r"""
# Elementary Sorting Algorithms

## Selection Sort

Find the minimum element and put it in place. N²/2 comparisons, N exchanges.

```java
for (int i = 0; i < N; i++) {
    int min = i;
    for (int j = i+1; j < N; j++)
        if (less(a[j], a[min])) min = j;
    exch(a, i, min);
}
```
**Key property:** Number of exchanges is linear — good when writes are expensive.

## Insertion Sort

Like sorting a hand of cards. O(N²) worst case, **O(N) for nearly sorted** data.

```java
for (int i = 1; i < N; i++)
    for (int j = i; j > 0 && less(a[j], a[j-1]); j--)
        exch(a, j, j-1);
```

## Shellsort

Insertion sort on h-sorted sequences. Gap sequence matters.

```java
int h = 1;
while (h < N/3) h = 3*h + 1;  // 1, 4, 13, 40, 121...
while (h >= 1) {
    // h-sort the array (insertion sort with stride h)
    h = h/3;
}
```

## Comparison

| Algorithm | Time (worst) | Time (best) | Stable? | Extra space |
|---|---|---|---|---|
| Selection | N²/2 | N²/2 | No | O(1) |
| Insertion | N²/2 | N | Yes | O(1) |
| Shellsort | ? | N | No | O(1) |

> 📖 **Book Reference:** [Chapter 2.1](https://algs4.cs.princeton.edu/21elementary/)
""",
    },
    "mergesort": {
        "title": "Mergesort",
        "estimated_minutes": 45,
        "content": r"""
# Mergesort

## Key Idea: Divide and Conquer

Split array in half, sort each half recursively, merge.

```java
void sort(Comparable[] a, Comparable[] aux, int lo, int hi) {
    if (hi <= lo) return;
    int mid = lo + (hi - lo) / 2;
    sort(a, aux, lo, mid);       // sort left half
    sort(a, aux, mid+1, hi);     // sort right half
    merge(a, aux, lo, mid, hi);  // merge results
}
```

## The Merge Operation

```java
void merge(Comparable[] a, Comparable[] aux, int lo, int mid, int hi) {
    // copy to auxiliary array
    for (int k = lo; k <= hi; k++) aux[k] = a[k];
    
    int i = lo, j = mid+1;
    for (int k = lo; k <= hi; k++) {
        if      (i > mid)           a[k] = aux[j++];
        else if (j > hi)            a[k] = aux[i++];
        else if (less(aux[j],aux[i])) a[k] = aux[j++];
        else                        a[k] = aux[i++];
    }
}
```

## Properties

- **Time:** O(N log N) guaranteed
- **Space:** O(N) auxiliary array
- **Stable:** Yes (equal items maintain order)
- **Practical optimizations:** Switch to insertion sort for small subarrays (cutoff ~7)

> 📖 **Book Reference:** [Chapter 2.2](https://algs4.cs.princeton.edu/22mergesort/)
""",
    },
    "quicksort": {
        "title": "Quicksort",
        "estimated_minutes": 50,
        "content": r"""
# Quicksort

The most widely used sorting algorithm in practice.

## Partition

Choose a pivot. Rearrange so that:
- Elements less than pivot are on the left
- Elements greater than pivot are on the right
- Pivot is in its final position

```java
int partition(Comparable[] a, int lo, int hi) {
    int i = lo, j = hi + 1;
    Comparable v = a[lo];  // pivot
    while (true) {
        while (less(a[++i], v)) if (i == hi) break;
        while (less(v, a[--j])) if (j == lo) break;
        if (i >= j) break;
        exch(a, i, j);
    }
    exch(a, lo, j);
    return j;
}
```

## Randomized Quicksort

**Shuffle first** to guarantee expected O(N log N):

```java
StdRandom.shuffle(a);  // eliminate bad cases
sort(a, 0, a.length - 1);
```

## 3-Way Quicksort (Dijkstra's Dutch National Flag)

For arrays with many duplicate keys:

```java
// lt..gt range contains all keys equal to pivot v
// [lo..lt-1] < v, [lt..gt] == v, [gt+1..hi] > v
```

## Performance

| Case | Comparisons |
|---|---|
| Best | N log N |
| Average | 1.39 N log N |
| Worst (sorted input, no shuffle) | N²/2 |

> 📖 **Book Reference:** [Chapter 2.3](https://algs4.cs.princeton.edu/23quicksort/)
""",
    },
    "priority-queues": {
        "title": "Priority Queues & Heapsort",
        "estimated_minutes": 45,
        "content": r"""
# Priority Queues & Heapsort

## Binary Heap

A **heap-ordered** complete binary tree stored in an array (1-indexed):
- Parent of node k is at k/2
- Children of node k are at 2k and 2k+1

```java
// Heap condition: a[k] >= a[2k] and a[k] >= a[2k+1]
```

## Swim (bottom-up reheapify)

When a child becomes larger than parent:

```java
void swim(int k) {
    while (k > 1 && less(k/2, k)) {
        exch(k/2, k);
        k = k/2;
    }
}
```

## Sink (top-down reheapify)

When root becomes smaller than a child:

```java
void sink(int k) {
    while (2*k <= N) {
        int j = 2*k;
        if (j < N && less(j, j+1)) j++;  // pick larger child
        if (!less(k, j)) break;
        exch(k, j);
        k = j;
    }
}
```

## Heapsort

1. Build max-heap: O(N)  
2. Sort-down: O(N log N)

```java
// Build heap
for (int k = N/2; k >= 1; k--) sink(a, k, N);
// Sort
while (N > 1) { exch(a, 1, N--); sink(a, 1, N); }
```

**Properties:** O(N log N) guaranteed, O(1) extra space, NOT stable.

> 📖 **Book Reference:** [Chapter 2.4](https://algs4.cs.princeton.edu/24pq/)
""",
    },
    "bst": {
        "title": "Binary Search Trees",
        "estimated_minutes": 50,
        "content": r"""
# Binary Search Trees (BST)

## Definition

A BST is a binary tree where every node's key is:
- **Larger** than all keys in its left subtree
- **Smaller** than all keys in its right subtree

```java
class Node {
    Key key; Value val;
    Node left, right;
    int size;   // subtree size
}
```

## Search

```java
Value get(Node x, Key key) {
    if (x == null) return null;
    int cmp = key.compareTo(x.key);
    if      (cmp < 0) return get(x.left, key);
    else if (cmp > 0) return get(x.right, key);
    else              return x.val;
}
```

## Insert

```java
Node put(Node x, Key key, Value val) {
    if (x == null) return new Node(key, val, 1);
    int cmp = key.compareTo(x.key);
    if      (cmp < 0) x.left  = put(x.left,  key, val);
    else if (cmp > 0) x.right = put(x.right, key, val);
    else              x.val = val;
    x.size = 1 + size(x.left) + size(x.right);
    return x;
}
```

## Deletion (Hibbard)

Use **successor** (smallest key in right subtree) to replace deleted node.

## Performance

| Operation | Average | Worst |
|---|---|---|
| Search | 1.39 log N | N |
| Insert | 1.39 log N | N |

Worst case occurs with sorted input → use balanced BSTs.

> 📖 **Book Reference:** [Chapter 3.2](https://algs4.cs.princeton.edu/32bst/)
""",
    },
    "balanced-bst": {
        "title": "Balanced BSTs — Red-Black Trees",
        "estimated_minutes": 60,
        "content": r"""
# Red-Black Trees (Left-Leaning)

## 2-3 Trees

Allow nodes with 2 or 3 children to keep the tree **perfectly balanced**:
- All null links at same distance from root
- Search/insert: O(log N) guaranteed

## Red-Black Encoding

Represent 2-3 tree as a BST with red/black links:
- **Red link**: two nodes form a 3-node
- **Black link**: ordinary link
- **Left-leaning**: red links lean left

```java
static final boolean RED   = true;
static final boolean BLACK = false;

boolean isRed(Node x) {
    if (x == null) return false;
    return x.color == RED;
}
```

## Rotations

```java
// Left rotation: make a right-leaning red link lean left
Node rotateLeft(Node h) {
    Node x = h.right;
    h.right = x.left;
    x.left = h;
    x.color = h.color;
    h.color = RED;
    return x;
}

// Right rotation: make a left-leaning red link lean right  
Node rotateRight(Node h) { ... }

// Flip colors: split a 4-node
void flipColors(Node h) {
    h.color = RED;
    h.left.color = BLACK;
    h.right.color = BLACK;
}
```

## Performance

O(log N) guaranteed for all operations — height ≤ 2 log N.

> 📖 **Book Reference:** [Chapter 3.3](https://algs4.cs.princeton.edu/33balanced/)
""",
    },
    "hash-tables": {
        "title": "Hash Tables",
        "estimated_minutes": 40,
        "content": r"""
# Hash Tables

## Hash Functions

Map keys to integers 0..M-1. A good hash function should be:
- **Consistent**: equal keys → same hash
- **Efficient**: fast to compute
- **Uniformly distributed**: spread keys evenly

```java
// Java's default: System.identityHashCode() or .hashCode()
int hash = (key.hashCode() & 0x7fffffff) % M;
```

## Separate Chaining

Each array cell holds a **linked list** of key-value pairs.

```java
// Array of M linked lists
// Average list length: N/M  (load factor α)
// Search/insert: O(1 + N/M)  typically O(1) for M ~ N/5
```

## Linear Probing (Open Addressing)

When collision occurs, try next slot:

```java
// Insert key k:
int i = hash(k);
while (keys[i] != null) i = (i + 1) % M;
keys[i] = k; vals[i] = v;
```

**Load factor α = N/M must be < 0.5** for good performance.

## Resizing

Double M when load factor exceeds threshold, halve when too sparse.

## Comparison

| | Separate Chaining | Linear Probing |
|---|---|---|
| Data structure | Link list | Array |
| N/M ratio ok | < 1 | < 0.5 |
| Cache performance | Poor | Excellent |

> 📖 **Book Reference:** [Chapter 3.4](https://algs4.cs.princeton.edu/34hash/)
""",
    },
    "undirected-graphs": {
        "title": "Undirected Graphs — DFS & BFS",
        "estimated_minutes": 55,
        "content": r"""
# Undirected Graphs

## Graph API

```java
Graph G = new Graph(V);  // V vertices, 0 edges
G.addEdge(v, w);         // add edge between v and w
Iterable<Integer> adj(int v);  // vertices adjacent to v
```

Representation: **adjacency lists** — array of bags.

## Depth-First Search (DFS)

Explore as deep as possible before backtracking:

```java
boolean[] marked = new boolean[G.V()];

void dfs(Graph G, int v) {
    marked[v] = true;
    for (int w : G.adj(v))
        if (!marked[w]) dfs(G, w);
}
```

Applications: find all connected components, detect cycles, bipartite check.

## Breadth-First Search (BFS)

Explore vertices in order of their distance from source:

```java
Queue<Integer> queue = new Queue<>();
marked[s] = true;
queue.enqueue(s);
while (!queue.isEmpty()) {
    int v = queue.dequeue();
    for (int w : G.adj(v)) {
        if (!marked[w]) {
            marked[w] = true;
            edgeTo[w] = v;  // record path
            queue.enqueue(w);
        }
    }
}
```

**BFS finds shortest path** (fewest edges) from source to all vertices.

## Performance

| Operation | DFS | BFS |
|---|---|---|
| Space | O(V+E) | O(V) |
| Time | O(V+E) | O(V+E) |

> 📖 **Book Reference:** [Chapter 4.1](https://algs4.cs.princeton.edu/41graph/)
""",
    },
    "directed-graphs": {
        "title": "Directed Graphs & Topological Sort",
        "estimated_minutes": 55,
        "content": r"""
# Directed Graphs (Digraphs)

## Digraph API

```java
Digraph G = new Digraph(V);
G.addEdge(v, w);  // directed edge from v to w
```

## Reachability

DFS on a digraph visits all vertices reachable from source.

## Topological Sort

**Order vertices so that all edges point from earlier to later.**

Algorithm: DFS, but add vertex to stack *after* exploring all children (reverse postorder):

```java
void dfs(Digraph G, int v) {
    marked[v] = true;
    for (int w : G.adj(v))
        if (!marked[w]) dfs(G, w);
    reversePost.push(v);  // add AFTER all children
}
```

**Topological sort is only possible if graph has no directed cycle (DAG).**

## Strongly Connected Components (Kosaraju-Sharir)

Two algorithms steps:
1. Run DFS on reverse graph G^R, compute reverse postorder
2. Run DFS on original G in that order → each DFS tree = one SCC

```
Time: O(V + E)   — remarkable!
```

## Applications

- Topological sort: build systems (Makefile), course prerequisites
- SCCs: web crawling (find page clusters), analyzing dependencies

> 📖 **Book Reference:** [Chapter 4.2](https://algs4.cs.princeton.edu/42digraph/)
""",
    },
    "mst": {
        "title": "Minimum Spanning Trees",
        "estimated_minutes": 50,
        "content": r"""
# Minimum Spanning Trees (MST)

## Problem

Given a connected, weighted, undirected graph, find a spanning tree with minimum total weight.

## Cut Property

A **cut** divides vertices into two sets. The **minimum weight crossing edge** belongs to the MST.

## Kruskal's Algorithm

Sort edges by weight, add if no cycle:

```java
MinPQ<Edge> pq = new MinPQ<>();  // edges by weight
UF uf = new UF(G.V());           // union-find to detect cycles

Queue<Edge> mst = new Queue<>();
while (!pq.isEmpty() && mst.size() < G.V()-1) {
    Edge e = pq.delMin();
    int v = e.either(), w = e.other(v);
    if (!uf.connected(v, w)) {   // no cycle
        uf.union(v, w);
        mst.enqueue(e);
    }
}
```
Time: O(E log E)

## Prim's Algorithm

Start with vertex 0, greedily add minimum weight edge to non-tree vertex:

```java
// Lazy version: keep all candidate edges in MinPQ
// Eager version: keep only one edge per non-tree vertex (indexed PQ)
```
Time: O(E log V) eager version

## Properties

- MST is unique if all edge weights are distinct
- MST has exactly V-1 edges
- Total weight is minimum over all spanning trees

> 📖 **Book Reference:** [Chapter 4.3](https://algs4.cs.princeton.edu/43mst/)
""",
    },
    "shortest-paths": {
        "title": "Shortest Paths — Dijkstra & Bellman-Ford",
        "estimated_minutes": 55,
        "content": r"""
# Shortest Paths

## Dijkstra's Algorithm

For **non-negative edge weights**. Greedy: relax edges from the closest unsettled vertex.

```java
IndexMinPQ<Double> pq = new IndexMinPQ<>(G.V());
distTo[s] = 0.0;
pq.insert(s, 0.0);

while (!pq.isEmpty()) {
    int v = pq.delMin();
    for (DirectedEdge e : G.adj(v))
        relax(e);
}

void relax(DirectedEdge e) {
    int v = e.from(), w = e.to();
    if (distTo[w] > distTo[v] + e.weight()) {
        distTo[w] = distTo[v] + e.weight();
        edgeTo[w] = e;
        if (pq.contains(w)) pq.decreaseKey(w, distTo[w]);
        else                 pq.insert(w, distTo[w]);
    }
}
```
Time: O(E log V) with binary heap

## Bellman-Ford Algorithm

Handles **negative weights** (but not negative cycles):

```java
// Relax all edges V-1 times
for (int pass = 0; pass < G.V()-1; pass++)
    for (int v = 0; v < G.V(); v++)
        for (DirectedEdge e : G.adj(v))
            relax(e);
```
Time: O(VE)

## Acyclic Shortest Paths (DAG)

Process vertices in **topological order** → O(V+E):
```java
// Topological sort first, then relax in that order
```

## Comparison

| Algorithm | Restriction | Time |
|---|---|---|
| Dijkstra | Non-negative weights | E log V |
| Bellman-Ford | No negative cycles | VE |
| DAG | DAG only | V+E |

> 📖 **Book Reference:** [Chapter 4.4](https://algs4.cs.princeton.edu/44sp/)
""",
    },
    "dynamic-programming": {
        "title": "Dynamic Programming",
        "estimated_minutes": 60,
        "content": r"""
# Dynamic Programming

## Core Idea

Break problem into **overlapping subproblems**, store results to avoid recomputation.

## Memoization (Top-Down)

```java
Map<Integer, Long> memo = new HashMap<>();
long fib(int n) {
    if (n <= 1) return n;
    if (memo.containsKey(n)) return memo.get(n);
    long result = fib(n-1) + fib(n-2);
    memo.put(n, result);
    return result;
}
```

## Tabulation (Bottom-Up)

```java
long[] dp = new long[n+1];
dp[0] = 0; dp[1] = 1;
for (int i = 2; i <= n; i++)
    dp[i] = dp[i-1] + dp[i-2];
```

## Classic Problems

### Longest Common Subsequence (LCS)

```
dp[i][j] = LCS length of X[0..i] and Y[0..j]
if X[i]==Y[j]: dp[i][j] = dp[i-1][j-1] + 1
else:          dp[i][j] = max(dp[i-1][j], dp[i][j-1])
```
Time: O(MN), Space: O(MN)

### 0-1 Knapsack

```
dp[i][w] = max value using first i items, capacity w
```

### Edit Distance (Levenshtein)

Minimum insertions, deletions, substitutions to convert one string to another.

## When to Use DP

- **Optimal substructure**: optimal solution built from optimal sub-solutions
- **Overlapping subproblems**: same sub-problems solved multiple times

> 📖 **Extended material** beyond the main book chapters.
""",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# PROBLEMS — Her konu için MCQ + Coding soruları
# ─────────────────────────────────────────────────────────────────────────────

PROBLEMS = [
    # ── FUNDAMENTALS ──────────────────────────────────────────────────────────
    {
        "slug": "fundamentals",
        "title": "Time Complexity: Binary Search",
        "description": "What is the worst-case time complexity of binary search on a sorted array of N elements?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("O(N)", False),
            ("O(log N)", True),
            ("O(N log N)", False),
            ("O(1)", False),
        ],
        "explanation": "Binary search halves the search space each step, giving O(log N) comparisons.",
        "hints": ["Think about how many times you can halve N before reaching 1."],
    },
    {
        "slug": "fundamentals",
        "title": "Memory: Array of Doubles",
        "description": "Approximately how much memory does an array of 1 million (10^6) doubles use in Java?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("4 MB", False),
            ("8 MB", True),
            ("16 MB", False),
            ("1 MB", False),
        ],
        "explanation": "A double is 8 bytes. 10^6 × 8 = 8,000,000 bytes ≈ 8 MB.",
        "hints": ["Recall: int=4 bytes, double=8 bytes."],
    },
    # ── UNION-FIND ────────────────────────────────────────────────────────────
    {
        "slug": "union-find",
        "title": "Union-Find: Path Compression",
        "description": "Which line implements path compression (path halving) in a Union-Find root() method?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("parent[i] = i;", False),
            ("parent[i] = parent[parent[i]];", True),
            ("parent[i] = root(parent[i]);", False),
            ("i = parent[i];", False),
        ],
        "explanation": "Path halving sets each node's parent to its grandparent, compressing the path.",
        "hints": ["Path halving makes each examined node skip one level."],
    },
    {
        "slug": "union-find",
        "title": "Weighted Quick-Union Height",
        "description": "In weighted quick-union (no path compression), what is the maximum height of a tree with N nodes? Choose the tight bound.",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("N", False),
            ("log₂ N", True),
            ("√N", False),
            ("N/2", False),
        ],
        "explanation": "Weighted quick-union guarantees height ≤ log₂ N because we always attach smaller tree to larger.",
        "hints": ["Each merge at least doubles the size of the larger component."],
    },
    # ── ELEMENTARY SORTS ──────────────────────────────────────────────────────
    {
        "slug": "elementary-sorts",
        "title": "Insertion Sort: Best Case",
        "description": "What is the best-case running time of insertion sort?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("O(N²)", False),
            ("O(N log N)", False),
            ("O(N)", True),
            ("O(1)", False),
        ],
        "explanation": "If the array is already sorted, insertion sort needs only N-1 comparisons (linear).",
        "hints": ["Consider: what happens when every element is already in its correct place?"],
    },
    {
        "slug": "elementary-sorts",
        "title": "Selection Sort Exchanges",
        "description": "How many exchanges does selection sort make in the worst case on an array of N elements?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("N²/2", False),
            ("N", True),
            ("N log N", False),
            ("0", False),
        ],
        "explanation": "Selection sort makes exactly N exchanges (one per pass), regardless of input order.",
        "hints": ["In each of the N passes, selection sort makes exactly one exchange."],
    },
    # ── MERGESORT ─────────────────────────────────────────────────────────────
    {
        "slug": "mergesort",
        "title": "Mergesort Space Complexity",
        "description": "What extra space does standard top-down mergesort require?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("O(1)", False),
            ("O(log N)", False),
            ("O(N)", True),
            ("O(N log N)", False),
        ],
        "explanation": "Mergesort needs an auxiliary array of size N for the merge step.",
        "hints": ["The merge operation needs to copy data somewhere."],
    },
    {
        "slug": "mergesort",
        "title": "Mergesort Stability",
        "description": "Is mergesort a stable sorting algorithm?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("No — equal elements can be reordered", False),
            ("Yes — equal elements maintain their relative order", True),
            ("It depends on the implementation", False),
            ("Only for arrays, not linked lists", False),
        ],
        "explanation": "Mergesort is stable: when two elements are equal, the merge picks the left one first, preserving order.",
        "hints": ["Look at the merge condition: what happens when aux[i] == aux[j]?"],
    },
    # ── QUICKSORT ─────────────────────────────────────────────────────────────
    {
        "slug": "quicksort",
        "title": "Quicksort Worst Case",
        "description": "When does quicksort degrade to O(N²) time complexity without random shuffling?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("When the array has many duplicate keys", False),
            ("When the array is already sorted (or reverse sorted)", True),
            ("When all elements are equal", False),
            ("When N is a power of 2", False),
        ],
        "explanation": "Without shuffling, sorted input causes the pivot to always partition into subarrays of size 0 and N-1, giving N²/2 comparisons.",
        "hints": ["Think about what happens to the partition when the first element is always the smallest."],
    },
    {
        "slug": "quicksort",
        "title": "3-Way Quicksort Advantage",
        "description": "3-way quicksort (Dijkstra's) is especially efficient when the input array has:",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("All distinct keys", False),
            ("Already sorted keys", False),
            ("Many duplicate keys", True),
            ("Keys in reverse order", False),
        ],
        "explanation": "3-way partitioning places all keys equal to the pivot in their final positions at once, reducing comparisons when duplicates are many.",
        "hints": ["The equal partition [lt..gt] grows larger with more duplicates."],
    },
    # ── PRIORITY QUEUES ───────────────────────────────────────────────────────
    {
        "slug": "priority-queues",
        "title": "Binary Heap: Parent of Node k",
        "description": "In a 1-indexed binary heap stored in array a[], the parent of node at index k is at index:",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("k - 1", False),
            ("k / 2", True),
            ("2 * k", False),
            ("k + 1", False),
        ],
        "explanation": "In a 1-indexed heap, parent of k is at k/2 (integer division). Children of k are at 2k and 2k+1.",
        "hints": ["Draw a small heap tree and check index relationships."],
    },
    {
        "slug": "priority-queues",
        "title": "Heapsort Space",
        "description": "What extra memory does heapsort require?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("O(N)", False),
            ("O(log N)", False),
            ("O(1)", True),
            ("O(N log N)", False),
        ],
        "explanation": "Heapsort sorts in-place using only O(1) extra space, unlike mergesort.",
        "hints": ["Heapsort modifies the input array directly without auxiliary storage."],
    },
    # ── BST ───────────────────────────────────────────────────────────────────
    {
        "slug": "bst",
        "title": "BST Search Average Case",
        "description": "What is the average-case number of comparisons for search in a BST built from N random keys?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("N/2", False),
            ("1.39 log₂ N", True),
            ("log₂ N", False),
            ("N", False),
        ],
        "explanation": "A randomly built BST has expected height ~1.39 log₂ N, matching the number of comparisons for search.",
        "hints": ["A random BST is similar to a quicksort tree."],
    },
    {
        "slug": "bst",
        "title": "BST Deletion: Hibbard",
        "description": "In Hibbard deletion, when deleting a node with two children, it is replaced by:",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("Its left child", False),
            ("Its right child", False),
            ("Its in-order successor (smallest key in right subtree)", True),
            ("Its in-order predecessor (largest key in left subtree)", False),
        ],
        "explanation": "Hibbard deletion replaces the deleted node with its in-order successor to maintain BST order.",
        "hints": ["The successor is the smallest key larger than the deleted node."],
    },
    # ── RED-BLACK TREES ───────────────────────────────────────────────────────
    {
        "slug": "balanced-bst",
        "title": "Red-Black Tree Invariants",
        "description": "Which of the following is NOT a required invariant of a left-leaning red-black BST?",
        "type": "multiple_choice",
        "difficulty": "hard",
        "points": 20,
        "options": [
            ("No node has two red links connected to it", False),
            ("The tree is perfectly height-balanced", False),
            ("Red links lean right", True),
            ("All null links have the same black depth", False),
        ],
        "explanation": "In LEFT-leaning red-black trees, red links lean LEFT. Right-leaning red links are corrected via rotateLeft().",
        "hints": ["The name 'left-leaning' is a big hint."],
    },
    {
        "slug": "balanced-bst",
        "title": "Left Rotation Purpose",
        "description": "In a left-leaning red-black BST, when do we call rotateLeft()?",
        "type": "multiple_choice",
        "difficulty": "hard",
        "points": 20,
        "options": [
            ("When left child is red and left-left grandchild is red", False),
            ("When both children are red", False),
            ("When right child is red and left child is black", True),
            ("After every insert", False),
        ],
        "explanation": "rotateLeft() fixes a right-leaning red link, maintaining the left-leaning invariant.",
        "hints": ["rotateLeft makes the right child become the new root of a subtree."],
    },
    # ── HASH TABLES ───────────────────────────────────────────────────────────
    {
        "slug": "hash-tables",
        "title": "Load Factor: Linear Probing",
        "description": "For linear probing hash tables, the load factor α = N/M should be kept below what threshold for good performance?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("0.25", False),
            ("0.5", True),
            ("0.75", False),
            ("1.0", False),
        ],
        "explanation": "Linear probing degrades sharply above α ≈ 0.5 due to primary clustering. Separate chaining tolerates α up to ~1.",
        "hints": ["Too full → long cluster chains. The typical recommendation is to keep α below 1/2."],
    },
    {
        "slug": "hash-tables",
        "title": "Separate Chaining vs Linear Probing",
        "description": "Which statement correctly distinguishes separate chaining from linear probing?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("Separate chaining has better cache performance", False),
            ("Linear probing stores key-value pairs outside the array", False),
            ("Linear probing has better cache performance due to sequential memory access", True),
            ("Separate chaining is slower for search than linear probing in all cases", False),
        ],
        "explanation": "Linear probing accesses sequential memory locations, making excellent use of CPU cache. Separate chaining follows pointers to heap-allocated list nodes.",
        "hints": ["Consider memory locality: sequential array vs pointer-following list nodes."],
    },
    # ── UNDIRECTED GRAPHS ─────────────────────────────────────────────────────
    {
        "slug": "undirected-graphs",
        "title": "BFS vs DFS: Shortest Path",
        "description": "Which graph traversal algorithm finds the shortest path (fewest edges) between two vertices?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("Depth-First Search (DFS)", False),
            ("Breadth-First Search (BFS)", True),
            ("Both find shortest paths", False),
            ("Neither — you need Dijkstra's", False),
        ],
        "explanation": "BFS explores vertices layer by layer (equal edge-weight distance), guaranteeing the shortest unweighted path.",
        "hints": ["BFS uses a queue; DFS uses a stack. Which explores by distance?"],
    },
    {
        "slug": "undirected-graphs",
        "title": "DFS: Connected Components",
        "description": "How does DFS identify all connected components of an undirected graph in O(V+E) time?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("Run DFS once from vertex 0 and count the marked vertices", False),
            ("Run DFS from each unvisited vertex, incrementing a component counter each time", True),
            ("Sort vertices by degree and DFS from highest degree", False),
            ("Run BFS multiple times on the same graph", False),
        ],
        "explanation": "Each call to DFS from an unvisited vertex discovers a new connected component. Count how many times you start a new DFS.",
        "hints": ["After DFS from vertex 0, which vertices are unreachable if the graph is disconnected?"],
    },
    # ── DIRECTED GRAPHS ───────────────────────────────────────────────────────
    {
        "slug": "directed-graphs",
        "title": "Topological Sort Precondition",
        "description": "Topological sort is only possible when the graph is a:",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("Connected undirected graph", False),
            ("Directed Acyclic Graph (DAG)", True),
            ("Complete directed graph", False),
            ("Bipartite graph", False),
        ],
        "explanation": "If a directed cycle exists, no linear ordering is possible because some vertex would need to come before itself.",
        "hints": ["What happens to the ordering requirement when A→B→C→A?"],
    },
    {
        "slug": "directed-graphs",
        "title": "Kosaraju-Sharir: First Step",
        "description": "What is the FIRST step of the Kosaraju-Sharir SCC algorithm?",
        "type": "multiple_choice",
        "difficulty": "hard",
        "points": 20,
        "options": [
            ("Run DFS on original graph G, compute postorder", False),
            ("Run DFS on the REVERSE graph G^R, compute reverse postorder", True),
            ("Run BFS on original graph G", False),
            ("Find all DAGs in the original graph", False),
        ],
        "explanation": "Run DFS on G^R to get the reverse postorder (finishing order). Then DFS on G in that order gives SCCs.",
        "hints": ["The algorithm uses the reverse graph as its first step — hence 'reverse' in the name."],
    },
    # ── MST ───────────────────────────────────────────────────────────────────
    {
        "slug": "mst",
        "title": "Kruskal's Algorithm Order",
        "description": "Kruskal's algorithm processes edges in which order?",
        "type": "multiple_choice",
        "difficulty": "easy",
        "points": 10,
        "options": [
            ("Decreasing weight", False),
            ("Increasing weight (non-decreasing)", True),
            ("Random order", False),
            ("By vertex degree", False),
        ],
        "explanation": "Kruskal's sorts edges by weight ascending, adding the minimum weight edge that doesn't create a cycle.",
        "hints": ["Kruskal's is a greedy algorithm — what does greedy mean for minimum weight?"],
    },
    {
        "slug": "mst",
        "title": "Cut Property",
        "description": "The Cut Property states that the minimum weight edge crossing any cut of a weighted graph:",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("May or may not be in the MST", False),
            ("Is NEVER in the MST", False),
            ("Is ALWAYS in some MST", True),
            ("Is in the MST only if the graph is connected", False),
        ],
        "explanation": "The Cut Property is the fundamental theorem behind both Prim's and Kruskal's: the min crossing edge is in every MST (assuming distinct weights).",
        "hints": ["This is the theoretical foundation for MST algorithms."],
    },
    # ── SHORTEST PATHS ────────────────────────────────────────────────────────
    {
        "slug": "shortest-paths",
        "title": "Dijkstra's Limitation",
        "description": "Dijkstra's shortest path algorithm fails (gives wrong answers) when the graph has:",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("More than 1000 vertices", False),
            ("Negative edge weights", True),
            ("Cycles", False),
            ("Multiple edges between same vertices", False),
        ],
        "explanation": "Dijkstra's greedy strategy assumes that the shortest path to a settled vertex won't improve — negative edges violate this.",
        "hints": ["Greedy algorithms require that choosing the local optimum leads to the global optimum. What breaks this?"],
    },
    {
        "slug": "shortest-paths",
        "title": "Bellman-Ford Iterations",
        "description": "Bellman-Ford relaxes all edges how many times to guarantee shortest paths?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("log V times", False),
            ("V times", False),
            ("V - 1 times", True),
            ("E times", False),
        ],
        "explanation": "Any shortest path in a graph with V vertices has at most V-1 edges, so V-1 relaxation passes suffice.",
        "hints": ["A shortest path can visit at most V distinct vertices, so it has at most V-1 edges."],
    },
    # ── DYNAMIC PROGRAMMING ───────────────────────────────────────────────────
    {
        "slug": "dynamic-programming",
        "title": "Memoization vs Tabulation",
        "description": "Which statement correctly distinguishes memoization from tabulation?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("Memoization is bottom-up; tabulation is top-down", False),
            ("Memoization is top-down with caching; tabulation fills a table bottom-up", True),
            ("Tabulation always uses more memory than memoization", False),
            ("Memoization always computes all subproblems", False),
        ],
        "explanation": "Memoization = recursive top-down with a cache. Tabulation = iterative bottom-up filling a DP table.",
        "hints": ["'Memo' = cache/remember. Which direction recurses downward?"],
    },
    {
        "slug": "dynamic-programming",
        "title": "LCS Time Complexity",
        "description": "What is the time complexity of the Longest Common Subsequence (LCS) DP algorithm for strings of length M and N?",
        "type": "multiple_choice",
        "difficulty": "medium",
        "points": 15,
        "options": [
            ("O(M + N)", False),
            ("O(M × N)", True),
            ("O(M log N)", False),
            ("O(2^N)", False),
        ],
        "explanation": "The LCS DP table has M×N cells, each computed in O(1) time, giving O(MN) total.",
        "hints": ["How big is the DP table for LCS?"],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# SEED FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def seed_lessons_and_problems():
    """Topics temizlenip yeniden seed edilir, ardından dersler ve problemler eklenir."""
    db = SessionLocal()
    try:
        print("\n🌱 Sedgewick Algorithms 4th Ed. — Content Seed")
        print("=" * 55)

        # 1. Mevcut lesson ve problem kayıtlarını sil (submissions korunur)
        print("  → Eski lesson ve problem kayıtları temizleniyor...")
        db.query(ProblemHint).delete()
        db.query(ProblemOption).delete()
        db.query(Problem).delete()
        db.query(Lesson).delete()
        db.query(Topic).delete()
        db.commit()

        # 2. Topics'i yeniden seed et
        print("  → Topics seed ediliyor...")
        topic_map = seed_topics(db)
        db.commit()

        # 3. Lessons ekle
        print("  → Ders içerikleri ekleniyor...")
        lesson_count = 0
        topic_to_lesson = {}
        for slug, lesson_data in LESSONS.items():
            if slug not in topic_map:
                print(f"    [SKIP] '{slug}' topic bulunamadı")
                continue
            topic = topic_map[slug]
            lesson = Lesson(
                topic_id=topic.id,
                title=lesson_data["title"],
                summary=lesson_data["title"],  # kısa özet
                content_markdown=lesson_data["content"].strip(),  # tam markdown içerik
                estimated_minutes=lesson_data["estimated_minutes"],
                display_order=1,
            )
            db.add(lesson)
            db.flush()
            topic_to_lesson[slug] = lesson
            lesson_count += 1
        db.commit()
        print(f"  ✓ {lesson_count} ders eklendi")

        # 4. Problems + Options + Hints ekle
        print("  → Sorular ekleniyor...")
        problem_count = 0
        for p_data in PROBLEMS:
            slug = p_data["slug"]
            if slug not in topic_map:
                print(f"    [SKIP] '{slug}' topic bulunamadı")
                continue
            topic = topic_map[slug]
            lesson = topic_to_lesson.get(slug)

            problem = Problem(
                topic_id=topic.id,
                lesson_id=lesson.id if lesson else None,
                title=p_data["title"],
                description=p_data["description"],
                type=p_data["type"],
                difficulty=p_data["difficulty"],
                points=p_data["points"],
                grading_rubric=p_data.get("explanation", ""),  # explanation → grading_rubric
                starter_code=p_data.get("starter_code", ""),
                correct_answer=next((t for t, c in p_data.get("options", []) if c), ""),  # doğru şık metni
            )
            db.add(problem)
            db.flush()

            # Options
            for order, (text, is_correct) in enumerate(p_data.get("options", [])):
                opt = ProblemOption(
                    problem_id=problem.id,
                    text=text,
                    is_correct=is_correct,
                    display_order=order,
                )
                db.add(opt)

            # Hints — ProblemHint: content, level (socratic hint level 1/2/3)
            for hint_order, hint_text in enumerate(p_data.get("hints", [])):
                hint = ProblemHint(
                    problem_id=problem.id,
                    content=hint_text,  # 'text' değil 'content'
                    level=hint_order + 1,  # 1=mild, 2=medium, 3=revealing
                )
                db.add(hint)

            problem_count += 1

        db.commit()
        print(f"  ✓ {problem_count} soru eklendi")
        print("=" * 55)
        print("✅ Sedgewick içerik seed tamamlandı!")

    except Exception as e:
        db.rollback()
        print(f"❌ Hata: {e}")
        import traceback; traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_lessons_and_problems()
