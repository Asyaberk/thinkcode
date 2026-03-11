"""
Seed: Problems, Options, Hints, Test Cases
~5 problems per topic (mix of coding, MCQ, open_response)
"""
from app.db.models import Problem, ProblemOption, ProblemHint, ProblemTestCase

PROBLEMS_DATA = {
    # ────────────────────────────────────────────────────────────
    "union-find": [
        {
            "title": "QuickFind vs WeightedQU Complexity",
            "type": "multiple_choice",
            "difficulty": "easy",
            "description": "In the **Weighted Quick-Union with Path Compression** data structure, what is the amortized time complexity per operation for N objects?",
            "correct_answer": "O(α(N)) — near constant (inverse Ackermann)",
            "points": 10,
            "book_reference": "Sedgewick & Wayne — 1.5 Union-Find",
            "options": [
                {"text": "O(N)", "is_correct": False},
                {"text": "O(log N)", "is_correct": False},
                {"text": "O(α(N)) — near constant (inverse Ackermann)", "is_correct": True},
                {"text": "O(N log N)", "is_correct": False},
            ],
            "hints": [
                {"level": 1, "content": "Think about what path compression does to the tree height over many operations.", "socratic_question": "If every find operation flattens the path it traverses, what happens to future operations on those nodes?"},
                {"level": 2, "content": "The amortized cost is better than O(log N). It's expressed using a very slowly-growing function.", "socratic_question": "You've heard of logarithm growing slowly. What function grows even more slowly?"},
                {"level": 3, "content": "The inverse Ackermann function α(N) grows so slowly it's effectively constant for any realistic N (≤ 5 for N up to 10^80).", "socratic_question": None},
            ],
        },
        {
            "title": "Implement Union-Find",
            "type": "coding",
            "difficulty": "medium",
            "description": """Implement a **Weighted Quick-Union** data structure.

Complete the class with:
- `__init__(self, n)` — initialize n sites
- `find(self, x)` — return root of x
- `union(self, x, y)` — connect x and y, return False if already connected
- `connected(self, x, y)` — return True if x and y are connected

Use **size-based weighting** to keep trees balanced.""",
            "starter_code": """class UnionFind:
    def __init__(self, n: int):
        # TODO: initialize parent and size arrays
        pass
    
    def find(self, x: int) -> int:
        # TODO: return root of x
        pass
    
    def union(self, x: int, y: int) -> bool:
        # TODO: connect x and y, return False if already connected
        pass
    
    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)
""",
            "solution_code": """class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.size = [1] * n
    
    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x
    
    def union(self, x: int, y: int) -> bool:
        px, py = self.find(x), self.find(y)
        if px == py:
            return False
        if self.size[px] < self.size[py]:
            px, py = py, px
        self.parent[py] = px
        self.size[px] += self.size[py]
        return True
    
    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)
""",
            "points": 20,
            "book_reference": "Sedgewick & Wayne — 1.5 Union-Find, Program 1.5.3",
            "options": [],
            "hints": [
                {"level": 1, "content": "Start with `parent[i] = i` (each node is its own root). What does it mean for a node to be a root?", "socratic_question": "If parent[x] == x, what does that tell us about x?"},
                {"level": 2, "content": "For `find`, follow parent pointers until you reach a root. For `union`, link the root of the smaller tree under the root of the larger tree.", "socratic_question": "Without weighting, what's the worst case tree height after N unions?"},
                {"level": 3, "content": "Path compression in `find`: `self.parent[x] = self.parent[self.parent[x]]` (two-pass halving) makes the tree nearly flat.", "socratic_question": None},
            ],
            "test_cases": [
                {"input": "uf = UnionFind(5)\nuf.union(0,1)\nuf.union(1,2)\nprint(uf.connected(0,2))\nprint(uf.connected(0,4))", "expected_output": "True\nFalse", "is_hidden": False},
                {"input": "uf = UnionFind(10)\nfor i in range(9): uf.union(i,i+1)\nprint(uf.connected(0,9))", "expected_output": "True", "is_hidden": True},
            ],
        },
        {
            "title": "Union-Find: Number of Components",
            "type": "open_response",
            "difficulty": "easy",
            "description": "Given N=5 sites and the following union operations: union(0,1), union(2,3), union(1,2) — how many connected components remain? Explain your reasoning step by step.",
            "correct_answer": "2 components: {0,1,2,3} and {4}. After union(0,1): 4 components. After union(2,3): 3 components. After union(1,2): merges {0,1} with {2,3} → 2 components.",
            "grading_rubric": """Score 1.0: Correctly states 2 components with step-by-step reasoning showing each union operation.
Score 0.7: Correct final answer (2) with partial reasoning.
Score 0.4: Shows some understanding of connectivity but wrong final count.
Score 0.0: Incorrect answer or no meaningful reasoning.""",
            "points": 10,
            "book_reference": "Sedgewick & Wayne — 1.5 Union-Find",
            "options": [],
            "hints": [
                {"level": 1, "content": "Start with 5 separate components: {0},{1},{2},{3},{4}. Apply each union one at a time.", "socratic_question": "How many components exist before any union operations?"},
                {"level": 2, "content": "After union(0,1): {0,1},{2},{3},{4} = 4 components. After union(2,3): {0,1},{2,3},{4} = 3 components.", "socratic_question": "After merging {0,1} with {2,3}, how many sets contain element 0? Element 2?"},
                {"level": 3, "content": "union(1,2) connects the set containing 1 (which is {0,1}) with the set containing 2 (which is {2,3}) → {0,1,2,3}. Site 4 remains alone. Final: 2 components.", "socratic_question": None},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "quicksort": [
        {
            "title": "Quicksort Worst Case",
            "type": "open_response",
            "difficulty": "medium",
            "description": "Explain the **worst-case time complexity** of standard Quicksort and describe the specific input pattern that triggers it. Why does randomization fix this?",
            "correct_answer": "O(n²) worst case occurs when the pivot is always the minimum or maximum element (e.g., sorted input with last-element pivot). This creates n levels of recursion each doing O(n) work. Randomization (shuffling before sorting) makes any fixed permutation equally likely, so O(n²) inputs cannot be constructed adversarially.",
            "grading_rubric": """Score 1.0: States O(n²), identifies the pivoting cause (already sorted input), and explains randomization.
Score 0.7: States O(n²) with partial explanation (missing randomization or trigger).
Score 0.4: Vague understanding of worst case without technical depth.
Score 0.0: Incorrect.""",
            "points": 15,
            "book_reference": "Sedgewick & Wayne — 2.3 Quicksort",
            "options": [],
            "hints": [
                {"level": 1, "content": "Think about what happens to the partition sizes if the pivot is always the smallest element in the subarray.", "socratic_question": "If partition always produces one subarray of size 0 and one of size n-1, how deep is the recursion?"},
                {"level": 2, "content": "With n levels of recursion each doing O(n) work, total work is n + (n-1) + ... + 1 = O(n²).", "socratic_question": "How does shuffling the input change the probability of this happening?"},
                {"level": 3, "content": "After a random shuffle, any permutation is equally likely. The expected recursion depth is O(log n), giving expected O(n log n). No adversary can construct a bad input for a random pivot strategy.", "socratic_question": None},
            ],
        },
        {
            "title": "Partition Algorithm",
            "type": "coding",
            "difficulty": "hard",
            "description": """Implement the **Lomuto partition scheme**.

Given an array `arr`, indices `lo` and `hi`:
- Choose `arr[hi]` as pivot
- Rearrange so elements ≤ pivot come first, then pivot, then elements > pivot
- Return the final index of the pivot

**In-place, O(n) time, O(1) space.**""",
            "starter_code": """def partition(arr: list, lo: int, hi: int) -> int:
    # pivot = arr[hi]
    # rearrange arr[lo..hi] and return pivot's final index
    pass

def quicksort(arr: list, lo: int, hi: int) -> None:
    if lo >= hi:
        return
    p = partition(arr, lo, hi)
    quicksort(arr, lo, p - 1)
    quicksort(arr, p + 1, hi)
""",
            "solution_code": """def partition(arr: list, lo: int, hi: int) -> int:
    pivot = arr[hi]
    i = lo
    for j in range(lo, hi):
        if arr[j] <= pivot:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
    arr[i], arr[hi] = arr[hi], arr[i]
    return i

def quicksort(arr: list, lo: int, hi: int) -> None:
    if lo >= hi:
        return
    p = partition(arr, lo, hi)
    quicksort(arr, lo, p - 1)
    quicksort(arr, p + 1, hi)
""",
            "points": 25,
            "book_reference": "Sedgewick & Wayne — 2.3 Quicksort, Program 2.3.1",
            "options": [],
            "hints": [
                {"level": 1, "content": "Use a pointer `i` starting at `lo`. Scan `j` from `lo` to `hi-1`. Whenever arr[j] ≤ pivot, swap arr[i] and arr[j] and increment i.", "socratic_question": "After scanning, where should the pivot end up relative to i?"},
                {"level": 2, "content": "After the scan loop, `i` points to the first element greater than the pivot. Swap arr[i] with arr[hi] (the pivot).", "socratic_question": "Why is it safe to place the pivot at index i?"},
                {"level": 3, "content": "Full solution: `i=lo`, loop j from lo to hi-1: if arr[j]<=pivot swap arr[i],arr[j] and i++. Then swap arr[i],arr[hi]. Return i.", "socratic_question": None},
            ],
            "test_cases": [
                {"input": "arr=[3,6,8,10,1,2,1]; quicksort(arr,0,len(arr)-1); print(arr)", "expected_output": "[1, 1, 2, 3, 6, 8, 10]", "is_hidden": False},
                {"input": "arr=[5,4,3,2,1]; quicksort(arr,0,4); print(arr)", "expected_output": "[1, 2, 3, 4, 5]", "is_hidden": True},
            ],
        },
        {
            "title": "Quicksort vs Mergesort Trade-offs",
            "type": "multiple_choice",
            "difficulty": "medium",
            "description": "Which statement **best** describes a practical advantage of Quicksort over Mergesort?",
            "correct_answer": "Quicksort is in-place (O(log n) stack) while Mergesort requires O(n) auxiliary space.",
            "points": 10,
            "book_reference": "Sedgewick & Wayne — 2.3 Quicksort",
            "options": [
                {"text": "Quicksort is always faster than Mergesort in the worst case.", "is_correct": False},
                {"text": "Quicksort is stable while Mergesort is not.", "is_correct": False},
                {"text": "Quicksort is in-place (O(log n) stack) while Mergesort requires O(n) auxiliary space.", "is_correct": True},
                {"text": "Quicksort has fewer comparisons in the average case than Mergesort.", "is_correct": False},
            ],
            "hints": [
                {"level": 1, "content": "Think about memory usage — what extra space does each algorithm allocate?", "socratic_question": "When mergesort merges two halves, where does it store the merged result?"},
                {"level": 2, "content": "Mergesort creates auxiliary arrays during merge — O(n) total. Quicksort only needs the call stack.", "socratic_question": "Is 'fewer comparisons in average case' actually true? Check the constants."},
                {"level": 3, "content": "Quicksort is preferred in practice for in-place sorting. Mergesort is preferred for stable sorting and sorting linked lists.", "socratic_question": None},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "bst": [
        {
            "title": "BST Search Complexity",
            "type": "multiple_choice",
            "difficulty": "easy",
            "description": "What is the **worst-case** time complexity for search in an unbalanced Binary Search Tree with N nodes?",
            "correct_answer": "O(N)",
            "points": 8,
            "book_reference": "Sedgewick & Wayne — 3.2 Binary Search Trees",
            "options": [
                {"text": "O(1)", "is_correct": False},
                {"text": "O(log N)", "is_correct": False},
                {"text": "O(N)", "is_correct": True},
                {"text": "O(N log N)", "is_correct": False},
            ],
            "hints": [
                {"level": 1, "content": "Consider inserting elements 1, 2, 3, 4, 5 in order into a BST. What shape does the tree take?", "socratic_question": "What does a BST look like when built from sorted input?"},
                {"level": 2, "content": "Sorted insertion creates a degenerate BST — essentially a linked list. Searching for the last element takes O(N).", "socratic_question": "What is the height of this degenerate tree?"},
                {"level": 3, "content": "In the worst case (degenerate tree), BST height = N-1, so search is O(N). This is why balanced BSTs (AVL, Red-Black) are necessary.", "socratic_question": None},
            ],
        },
        {
            "title": "Implement BST Insert",
            "type": "coding",
            "difficulty": "medium",
            "description": """Implement BST **insert** and **search** operations.

Complete the `BSTNode` class and `BST` class:
- `insert(key, val)` — insert or update key-value pair
- `get(key)` — return value for key, or None if not found
- `contains(key)` — return True if key exists

Implement recursively.""",
            "starter_code": """class BSTNode:
    def __init__(self, key, val):
        self.key = key
        self.val = val
        self.left = None
        self.right = None

class BST:
    def __init__(self):
        self.root = None
    
    def insert(self, key, val):
        # TODO
        pass
    
    def _insert(self, node, key, val):
        # TODO: recursive helper
        pass
    
    def get(self, key):
        # TODO
        pass
    
    def _get(self, node, key):
        # TODO: recursive helper
        pass
    
    def contains(self, key):
        return self.get(key) is not None
""",
            "solution_code": """class BSTNode:
    def __init__(self, key, val):
        self.key = key
        self.val = val
        self.left = None
        self.right = None

class BST:
    def __init__(self):
        self.root = None
    
    def insert(self, key, val):
        self.root = self._insert(self.root, key, val)
    
    def _insert(self, node, key, val):
        if node is None:
            return BSTNode(key, val)
        if key < node.key:
            node.left = self._insert(node.left, key, val)
        elif key > node.key:
            node.right = self._insert(node.right, key, val)
        else:
            node.val = val  # update
        return node
    
    def get(self, key):
        return self._get(self.root, key)
    
    def _get(self, node, key):
        if node is None:
            return None
        if key < node.key:
            return self._get(node.left, key)
        elif key > node.key:
            return self._get(node.right, key)
        return node.val
    
    def contains(self, key):
        return self.get(key) is not None
""",
            "points": 20,
            "book_reference": "Sedgewick & Wayne — 3.2 BST, Programs 3.2.1-3.2.2",
            "options": [],
            "hints": [
                {"level": 1, "content": "The BST property: for any node N, all keys in N's left subtree are smaller, all in N's right subtree are larger.", "socratic_question": "If key < node.key, which subtree do you recurse into?"},
                {"level": 2, "content": "If the node is None, create a new BSTNode. Otherwise compare key with node.key and recurse left or right.", "socratic_question": "What should _insert return in the base case? In the recursive case?"},
                {"level": 3, "content": "The recursive insert must return the node — it rebuilds the path from root to insertion point. `node.left = _insert(node.left, ...)` is the key pattern.", "socratic_question": None},
            ],
            "test_cases": [
                {"input": "bst = BST()\nfor k,v in [('b',2),('a',1),('c',3)]: bst.insert(k,v)\nprint(bst.get('a'), bst.get('c'), bst.contains('z'))", "expected_output": "1 3 False", "is_hidden": False},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "undirected-graphs": [
        {
            "title": "DFS vs BFS Use Cases",
            "type": "multiple_choice",
            "difficulty": "easy",
            "description": "You need to find the **shortest path** (fewest edges) between two nodes in an **unweighted** undirected graph. Which algorithm should you use?",
            "correct_answer": "BFS — it explores nodes layer by layer, guaranteeing the shortest path in unweighted graphs.",
            "points": 8,
            "book_reference": "Sedgewick & Wayne — 4.1 Undirected Graphs",
            "options": [
                {"text": "DFS — it runs faster since it doesn't use a queue.", "is_correct": False},
                {"text": "BFS — it explores nodes layer by layer, guaranteeing the shortest path in unweighted graphs.", "is_correct": True},
                {"text": "Either — both find shortest paths.", "is_correct": False},
                {"text": "Dijkstra's — it handles all graph types.", "is_correct": False},
            ],
            "hints": [
                {"level": 1, "content": "Think about what 'layer by layer' means: BFS visits all nodes at distance 1, then distance 2, etc.", "socratic_question": "When BFS first reaches the destination, what does that tell you about the path length?"},
                {"level": 2, "content": "DFS might find a path, but not necessarily the shortest one — it could go deep into the wrong branch first.", "socratic_question": "Can you construct a graph where DFS finds a longer path than BFS?"},
                {"level": 3, "content": "BFS guarantees shortest path in unweighted graphs. For weighted shortest paths, use Dijkstra's.", "socratic_question": None},
            ],
        },
        {
            "title": "Implement BFS Shortest Path",
            "type": "coding",
            "difficulty": "medium",
            "description": """Implement **Breadth-First Search** that returns the shortest path from `src` to `dst` in an unweighted graph.

The graph is given as an **adjacency list** (dict of lists).
Return a **list of nodes** in the path, or `[]` if no path exists.

```python
# Example:
graph = {0:[1,2], 1:[0,3], 2:[0,3], 3:[1,2,4], 4:[3]}
bfs_path(graph, 0, 4)  # → [0, 1, 3, 4] or [0, 2, 3, 4]
```""",
            "starter_code": """from collections import deque

def bfs_path(graph: dict, src: int, dst: int) -> list:
    # Return list of nodes forming shortest path from src to dst.
    # Return [] if no path exists.
    pass
""",
            "solution_code": """from collections import deque

def bfs_path(graph: dict, src: int, dst: int) -> list:
    if src == dst:
        return [src]
    visited = {src}
    parent = {src: None}
    queue = deque([src])
    
    while queue:
        node = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                parent[neighbor] = node
                if neighbor == dst:
                    # Reconstruct path
                    path = []
                    cur = dst
                    while cur is not None:
                        path.append(cur)
                        cur = parent[cur]
                    return path[::-1]
                queue.append(neighbor)
    return []
""",
            "points": 20,
            "book_reference": "Sedgewick & Wayne — 4.1 BFS, Program 4.1.3",
            "options": [],
            "hints": [
                {"level": 1, "content": "Use a queue (deque). Start with src in the queue. For each node, visit unvisited neighbors and track their parent.", "socratic_question": "How do you reconstruct the path once you've reached dst?"},
                {"level": 2, "content": "Keep a `parent` dict: parent[neighbor] = current node. When you reach dst, follow parent pointers back to src.", "socratic_question": "In what order should you reverse the path you've collected?"},
                {"level": 3, "content": "Collect path by following parent[] from dst back to src (None), then reverse the list.", "socratic_question": None},
            ],
            "test_cases": [
                {"input": "g={0:[1,2],1:[0,3],2:[0,3],3:[1,2,4],4:[3]}\np=bfs_path(g,0,4)\nprint(p[0]==0, p[-1]==4, len(p)==4)", "expected_output": "True True True", "is_hidden": False},
                {"input": "g={0:[1],1:[0],2:[3],3:[2]}\nprint(bfs_path(g,0,3))", "expected_output": "[]", "is_hidden": False},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "shortest-paths": [
        {
            "title": "Dijkstra Negative Weights",
            "type": "multiple_choice",
            "difficulty": "medium",
            "description": "Why does **Dijkstra's algorithm** fail with negative edge weights?",
            "correct_answer": "Once a node is marked visited (settled), Dijkstra assumes no shorter path exists — but a negative edge could later provide one.",
            "points": 10,
            "book_reference": "Sedgewick & Wayne — 4.4 Shortest Paths",
            "options": [
                {"text": "Dijkstra's uses a min-heap which cannot store negative values.", "is_correct": False},
                {"text": "Once a node is marked visited (settled), Dijkstra assumes no shorter path exists — but a negative edge could later provide one.", "is_correct": True},
                {"text": "Negative weights cause integer overflow in the priority queue.", "is_correct": False},
                {"text": "Dijkstra's only works on directed graphs.", "is_correct": False},
            ],
            "hints": [
                {"level": 1, "content": "Dijkstra's 'greedy' correctness relies on the assumption that shorter paths cannot be found by going through unvisited nodes.", "socratic_question": "What if there's a path A→B→C where the edge B→C has weight -100?"},
                {"level": 2, "content": "If B→C has weight -100, visiting A and then B might be 'cheaper' than what Dijkstra already settled for C.", "socratic_question": "What algorithm handles negative edge weights?"},
                {"level": 3, "content": "Use Bellman-Ford for negative weights. It re-relaxes edges V-1 times, allowing later edges to update earlier settled nodes.", "socratic_question": None},
            ],
        },
        {
            "title": "Implement Dijkstra's Algorithm",
            "type": "coding",
            "difficulty": "hard",
            "description": """Implement **Dijkstra's shortest path algorithm**.

Input: weighted directed graph as `{node: [(neighbor, weight), ...]}`, source node `src`.
Output: dict `{node: shortest_distance}` from `src` to all reachable nodes.

Use a **min-heap priority queue**. Assume non-negative weights.""",
            "starter_code": """import heapq

def dijkstra(graph: dict, src) -> dict:
    # graph: {node: [(neighbor, weight), ...]}
    # Return: {node: min_distance_from_src}
    pass
""",
            "solution_code": """import heapq

def dijkstra(graph: dict, src) -> dict:
    dist = {node: float('inf') for node in graph}
    dist[src] = 0
    pq = [(0, src)]  # (distance, node)
    
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue  # stale entry
        for v, w in graph.get(u, []):
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                heapq.heappush(pq, (dist[v], v))
    
    return dist
""",
            "points": 25,
            "book_reference": "Sedgewick & Wayne — 4.4 Dijkstra, Program 4.4.3",
            "options": [],
            "hints": [
                {"level": 1, "content": "Initialize dist[src]=0 and dist[v]=∞ for all others. Use a min-heap to always process the closest unvisited node.", "socratic_question": "Why do we process nodes in order of increasing distance?"},
                {"level": 2, "content": "When you pop (d, u) from the heap, if d > dist[u], skip — it's a stale entry from an earlier, longer path.", "socratic_question": "Why might the same node appear multiple times in the priority queue?"},
                {"level": 3, "content": "For each neighbor v of u: if dist[u]+weight < dist[v], update dist[v] and push (dist[v], v) to the heap.", "socratic_question": None},
            ],
            "test_cases": [
                {"input": "g={0:[(1,4),(2,1)],1:[(3,1)],2:[(1,2),(3,5)],3:[]}\nd=dijkstra(g,0)\nprint(d[0],d[1],d[3])", "expected_output": "0 3 4", "is_hidden": False},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "hash-tables": [
        {
            "title": "Load Factor and Resizing",
            "type": "open_response",
            "difficulty": "medium",
            "description": "Explain the concept of **load factor** in a hash table. Why must we resize when the load factor exceeds a threshold? What is the amortized cost of resizing?",
            "correct_answer": "Load factor α = N/M (N keys, M buckets). At high α, collision chains grow → O(α) per operation. Resizing doubles M when α > threshold (e.g., 0.75), rehashing all N keys in O(N). It happens rarely enough that amortized cost per insert is O(1) — similar to dynamic array doubling.",
            "grading_rubric": """Score 1.0: Defines α = N/M, explains collision chain growth, mentions doubling, and gives O(1) amortized argument.
Score 0.7: Correct definition and resize explanation but missing amortized analysis.
Score 0.4: Vague understanding of trade-offs without formal reasoning.
Score 0.0: Incorrect or missing.""",
            "points": 15,
            "book_reference": "Sedgewick & Wayne — 3.4 Hash Tables",
            "options": [],
            "hints": [
                {"level": 1, "content": "Load factor = (number of keys) / (table size). What happens to average chain length as this ratio grows?", "socratic_question": "If you have 100 keys in 10 buckets, how many keys per bucket on average?"},
                {"level": 2, "content": "When we double the table size, we rehash N keys — O(N) work. But this happens only every N insertions.", "socratic_question": "How do you spread O(N) cost over N insertions to get amortized O(1)?"},
                {"level": 3, "content": "Same argument as dynamic arrays: total cost of all resizes ≤ 2N (geometric series). So amortized cost per insert = O(2N/N) = O(1).", "socratic_question": None},
            ],
        },
    ],

    # ────────────────────────────────────────────────────────────
    "mergesort": [
        {
            "title": "Mergesort Recurrence",
            "type": "open_response",
            "difficulty": "medium",
            "description": "Write the recurrence relation for Mergesort and solve it to show the O(n log n) time complexity. Use the Master Theorem or recursion tree method.",
            "correct_answer": "T(n) = 2T(n/2) + O(n). By Master Theorem case 2 (a=2, b=2, f(n)=n, log_b(a)=1 = degree of f(n)): T(n) = O(n log n). Recursion tree: log n levels, each doing O(n) work total → O(n log n).",
            "grading_rubric": """Score 1.0: Correct recurrence T(n)=2T(n/2)+O(n), correct application of Master Theorem or recursion tree, O(n log n) result.
Score 0.7: Correct recurrence and answer but incomplete derivation.
Score 0.4: States O(n log n) without showing work.
Score 0.0: Incorrect.""",
            "points": 15,
            "book_reference": "Sedgewick & Wayne — 2.2 Mergesort",
            "options": [],
            "hints": [
                {"level": 1, "content": "Mergesort splits the array in half (2 subproblems of size n/2) and then merges in O(n). Write this as T(n) = ...", "socratic_question": "What is the cost of the merge step on n elements?"},
                {"level": 2, "content": "T(n) = 2T(n/2) + cn. Draw the recursion tree: how many levels are there? How much work at each level?", "socratic_question": "If there are log n levels and each does O(n) work, what is the total?"},
                {"level": 3, "content": "Master Theorem: a=2, b=2, f(n)=n. log_b(a) = log_2(2) = 1 = degree of f(n). Case 2: T(n) = Θ(n log n).", "socratic_question": None},
            ],
        },
    ],
}


def seed_problems(db, topic_map: dict, lesson_map: dict) -> None:
    count = 0
    for topic_slug, problems_list in PROBLEMS_DATA.items():
        topic = topic_map.get(topic_slug)
        if not topic:
            print(f"  ⚠ Topic not found: {topic_slug}")
            continue

        # Get first lesson for this topic (if any)
        lessons = lesson_map.get(topic_slug, [])
        lesson_id = lessons[0].id if lessons else None

        for p_data in problems_list:
            problem = Problem(
                topic_id=topic.id,
                lesson_id=lesson_id,
                title=p_data["title"],
                description=p_data["description"],
                type=p_data["type"],
                difficulty=p_data["difficulty"],
                starter_code=p_data.get("starter_code"),
                solution_code=p_data.get("solution_code"),
                grading_rubric=p_data.get("grading_rubric"),
                correct_answer=p_data.get("correct_answer"),
                points=p_data["points"],
                book_reference=p_data.get("book_reference"),
                is_published=True,
            )
            db.add(problem)
            db.flush()

            # Options
            for i, opt in enumerate(p_data.get("options", [])):
                db.add(ProblemOption(
                    problem_id=problem.id,
                    text=opt["text"],
                    is_correct=opt["is_correct"],
                    display_order=i,
                ))

            # Hints
            for h in p_data.get("hints", []):
                db.add(ProblemHint(
                    problem_id=problem.id,
                    level=h["level"],
                    content=h["content"],
                    socratic_question=h.get("socratic_question"),
                ))

            # Test cases
            for i, tc in enumerate(p_data.get("test_cases", [])):
                db.add(ProblemTestCase(
                    problem_id=problem.id,
                    input=tc["input"],
                    expected_output=tc["expected_output"],
                    is_hidden=tc.get("is_hidden", False),
                    display_order=i,
                ))

            count += 1

    db.flush()
    print(f"  ✓ {count} problems seeded (with options, hints, test cases)")
