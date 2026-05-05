"""
seed_extra_problems.py
======================
  - 1 coding problem (Java pseudocode stil)
  - 1 open_response problem
  - Her topic'in dersine 2 material (Princeton link + algs4.cs.princeton.edu)
  - Her coding problem'a 3 test_case

Mevcut MCQ problemlere dokunmaz — sadece yeni tip ekler.
Komut: docker exec thinkcode-backend python /app/scripts/seed/seed_extra_problems.py
"""

import sys
import os
sys.path.insert(0, '/app')

import uuid
from datetime import datetime, timezone
from app.db.session import SessionLocal
from app.db.models import Problem, ProblemHint, ProblemTestCase, Topic, Lesson, Material

db = SessionLocal()

TOPIC_PROBLEMS = {
    "Fundamentals": {
        "coding": {
            "title": "Binary Search Implementation",
            "description": (
                "Implement the binary search algorithm. Given a sorted array `a[]` and a key, "
                "return the index of the key in the array, or -1 if not present.\n\n"
                "**Example:**\n```\nInput:  a = [1, 3, 5, 7, 9, 11], key = 7\nOutput: 3\n```"
            ),
            "starter_code": (
                "public static int binarySearch(int[] a, int key) {\n"
                "    int lo = 0, hi = a.length - 1;\n"
                "    while (lo <= hi) {\n"
                "        int mid = lo + (hi - lo) / 2;\n"
                "        // TODO: compare a[mid] with key\n"
                "    }\n"
                "    return -1;\n"
                "}"
            ),
            "solution_code": (
                "public static int binarySearch(int[] a, int key) {\n"
                "    int lo = 0, hi = a.length - 1;\n"
                "    while (lo <= hi) {\n"
                "        int mid = lo + (hi - lo) / 2;\n"
                "        if      (key < a[mid]) hi = mid - 1;\n"
                "        else if (key > a[mid]) lo = mid + 1;\n"
                "        else return mid;\n"
                "    }\n"
                "    return -1;\n"
                "}"
            ),
            "rubric": "Correct loop bounds (lo <= hi), mid calculation avoids overflow, returns correct index or -1",
            "hints": ["Think about what 'lo' and 'hi' represent as invariants.",
                      "At each step, which half can you eliminate?",
                      "What happens when lo > hi?"],
            "tests": [
                {"input": "[1,3,5,7,9,11] key=7", "expected": "3"},
                {"input": "[2,4,6,8,10] key=1", "expected": "-1"},
                {"input": "[5] key=5", "expected": "0"},
            ],
        },
        "open_response": {
            "title": "Explain Big-O Notation",
            "description": (
                "In your own words, explain what Big-O notation means and why it is useful "
                "when analyzing algorithms. Give one real-world example comparing two algorithms "
                "with different growth rates (e.g., linear vs. logarithmic)."
            ),
            "rubric": "Mentions worst-case growth, uses correct examples, distinguishes O(n) from O(log n)",
        },
    },
    "Union-Find": {
        "coding": {
            "title": "Weighted Quick-Union with Path Compression",
            "description": (
                "Implement the `union` and `find` operations for a Weighted Quick-Union data structure "
                "with path compression.\n\n"
                "```\nInput: N=5, unions: (0,1),(2,3),(0,2)\nOutput: find(0)==find(3) → true\n```"
            ),
            "starter_code": (
                "public class WeightedQuickUnion {\n"
                "    private int[] id, sz;\n"
                "    public WeightedQuickUnion(int N) {\n"
                "        id = new int[N]; sz = new int[N];\n"
                "        for (int i=0; i<N; i++) { id[i]=i; sz[i]=1; }\n"
                "    }\n"
                "    public int find(int p) {\n"
                "        // TODO: implement with path compression\n"
                "        return p;\n"
                "    }\n"
                "    public void union(int p, int q) {\n"
                "        // TODO: link smaller tree under larger\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "public int find(int p) {\n"
                "    while (p != id[p]) { id[p] = id[id[p]]; p = id[p]; } return p;\n"
                "}\n"
                "public void union(int p, int q) {\n"
                "    int rp = find(p), rq = find(q);\n"
                "    if (rp == rq) return;\n"
                "    if (sz[rp] < sz[rq]) { id[rp]=rq; sz[rq]+=sz[rp]; }\n"
                "    else { id[rq]=rp; sz[rp]+=sz[rq]; }\n"
                "}"
            ),
            "rubric": "Path compression halves tree height, smaller tree linked under larger, find traces to root",
            "hints": ["What does id[i] == i mean?",
                      "Path compression: update id[p] to its grandparent.",
                      "In weighted union, always attach the smaller tree to the larger."],
            "tests": [
                {"input": "N=5 unions=(0,1),(2,3),(0,2) find(0)==find(3)", "expected": "true"},
                {"input": "N=3 no unions find(0)==find(1)", "expected": "false"},
                {"input": "N=4 unions=(0,1),(1,2),(2,3) find(0)==find(3)", "expected": "true"},
            ],
        },
        "open_response": {
            "title": "Why Does Path Compression Work?",
            "description": (
                "Explain why path compression in Union-Find leads to near-constant time operations. "
                "What is the amortized cost with both weighting and path compression? "
                "Reference the inverse Ackermann function in your answer."
            ),
            "rubric": "Discusses amortized cost, mentions O(α(n)) ≈ O(1) practical cost, explains flattening effect",
        },
    },
    "Elementary Sorts": {
        "coding": {
            "title": "Insertion Sort Implementation",
            "description": (
                "Implement insertion sort for an array of integers.\n\n"
                "```\nInput:  [5, 2, 8, 1, 9, 3]\nOutput: [1, 2, 3, 5, 8, 9]\n```"
            ),
            "starter_code": (
                "public static void insertionSort(int[] a) {\n"
                "    int n = a.length;\n"
                "    for (int i = 1; i < n; i++) {\n"
                "        // TODO: move a[i] to its correct position\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "public static void insertionSort(int[] a) {\n"
                "    int n = a.length;\n"
                "    for (int i = 1; i < n; i++)\n"
                "        for (int j = i; j > 0 && a[j] < a[j-1]; j--)\n"
                "            exch(a, j, j-1);\n"
                "}"
            ),
            "rubric": "Inner loop moves element left while out of order, outer loop covers all elements",
            "hints": ["Think of sorting playing cards: slide each card left until it fits.",
                      "The inner loop should stop when a[j] >= a[j-1].",
                      "Swap adjacent elements to move the current element left."],
            "tests": [
                {"input": "[5,2,8,1,9,3]", "expected": "[1,2,3,5,8,9]"},
                {"input": "[1]", "expected": "[1]"},
                {"input": "[3,2,1]", "expected": "[1,2,3]"},
            ],
        },
        "open_response": {
            "title": "Insertion Sort vs Selection Sort",
            "description": (
                "Compare insertion sort and selection sort in terms of: number of comparisons, "
                "number of exchanges, performance on nearly-sorted arrays, and stability. "
                "Which is preferred for nearly-sorted data and why?"
            ),
            "rubric": "Correctly states insertion sort is adaptive (faster on nearly sorted), selection sort has fixed n² comparisons, insertion sort is stable",
        },
    },
    "Mergesort": {
        "coding": {
            "title": "Top-Down Mergesort",
            "description": (
                "Implement top-down (recursive) mergesort. The `merge` helper merges two sorted halves.\n\n"
                "```\nInput:  [5, 2, 8, 1, 9, 3]\nOutput: [1, 2, 3, 5, 8, 9]\n```"
            ),
            "starter_code": (
                "public static void sort(int[] a, int[] aux, int lo, int hi) {\n"
                "    if (hi <= lo) return;\n"
                "    int mid = lo + (hi - lo) / 2;\n"
                "    // TODO: sort left half, sort right half, then merge\n"
                "}\n"
                "private static void merge(int[] a, int[] aux, int lo, int mid, int hi) {\n"
                "    // copy to aux, then merge back\n"
                "}"
            ),
            "solution_code": (
                "public static void sort(int[] a, int[] aux, int lo, int hi) {\n"
                "    if (hi <= lo) return;\n"
                "    int mid = lo + (hi - lo) / 2;\n"
                "    sort(a, aux, lo, mid);\n"
                "    sort(a, aux, mid+1, hi);\n"
                "    merge(a, aux, lo, mid, hi);\n"
                "}"
            ),
            "rubric": "Recursive calls on left/right halves, merge called after both halves sorted, base case hi<=lo",
            "hints": ["Divide the array at the midpoint.",
                      "Sort each half recursively before merging.",
                      "The merge helper needs to copy to auxiliary array first."],
            "tests": [
                {"input": "[5,2,8,1,9,3]", "expected": "[1,2,3,5,8,9]"},
                {"input": "[1,2]", "expected": "[1,2]"},
                {"input": "[9,8,7,6,5]", "expected": "[5,6,7,8,9]"},
            ],
        },
        "open_response": {
            "title": "Mergesort Space Complexity Analysis",
            "description": (
                "Mergesort requires O(n) extra space for the auxiliary array. "
                "Explain why this is unavoidable in a standard top-down mergesort. "
                "Describe one optimization (such as switching to insertion sort for small subarrays) "
                "and how it improves practical performance."
            ),
            "rubric": "Explains auxiliary array necessity, mentions cutoff to insertion sort for small n, discusses constant-factor improvement",
        },
    },
    "Quicksort": {
        "coding": {
            "title": "Quicksort Partition",
            "description": (
                "Implement the Lomuto (or Hoare) partition scheme used in Quicksort. "
                "Given array `a[]`, partition around pivot `a[lo]` so all smaller elements "
                "are left of pivot and all larger elements are right.\n\n"
                "```\nInput:  a=[3,1,4,1,5,9,2,6], lo=0, hi=7\nPartition returns the final pivot index.\n```"
            ),
            "starter_code": (
                "private static int partition(int[] a, int lo, int hi) {\n"
                "    int pivot = a[lo];\n"
                "    int i = lo, j = hi + 1;\n"
                "    while (true) {\n"
                "        // TODO: scan from left for element > pivot\n"
                "        // TODO: scan from right for element < pivot\n"
                "        // TODO: if pointers cross, break\n"
                "        // TODO: exchange a[i] and a[j]\n"
                "    }\n"
                "    exch(a, lo, j); // place pivot\n"
                "    return j;\n"
                "}"
            ),
            "solution_code": (
                "private static int partition(int[] a, int lo, int hi) {\n"
                "    int pivot = a[lo]; int i = lo, j = hi + 1;\n"
                "    while (true) {\n"
                "        while (a[++i] < pivot) if (i == hi) break;\n"
                "        while (a[--j] > pivot) if (j == lo) break;\n"
                "        if (i >= j) break;\n"
                "        exch(a, i, j);\n"
                "    }\n"
                "    exch(a, lo, j); return j;\n"
                "}"
            ),
            "rubric": "Scans from both sides, exchanges correctly, places pivot at final position, returns correct index",
            "hints": ["Scan i from left for an element greater than pivot.",
                      "Scan j from right for an element less than pivot.",
                      "Stop and exchange when both pointers find out-of-place elements."],
            "tests": [
                {"input": "a=[3,1,4,1,5] partition around 3", "expected": "pivot in correct final position"},
                {"input": "a=[5,4,3,2,1] lo=0 hi=4", "expected": "pivot 5 goes to index 4"},
                {"input": "a=[1] lo=0 hi=0", "expected": "returns 0"},
            ],
        },
        "open_response": {
            "title": "Quicksort Worst Case & Prevention",
            "description": (
                "Describe the worst-case scenario for Quicksort and explain what input causes it. "
                "How does random shuffling before partitioning prevent this? "
                "What is the expected number of comparisons for Quicksort on N items?"
            ),
            "rubric": "Identifies sorted/reverse-sorted input as worst case, O(n²) time, random shuffle gives O(n log n) expected, ~1.39 n ln n comparisons",
        },
    },
    "Priority Queues & Heapsort": {
        "coding": {
            "title": "Max Binary Heap: Insert and DelMax",
            "description": (
                "Implement `insert` and `delMax` for a max binary heap stored in an array (1-indexed).\n\n"
                "After `insert(5), insert(3), insert(8)`, `delMax()` should return 8."
            ),
            "starter_code": (
                "public class MaxHeap {\n"
                "    private int[] heap;\n"
                "    private int n = 0;\n"
                "    public MaxHeap(int cap) { heap = new int[cap+1]; }\n"
                "    public void insert(int v) {\n"
                "        heap[++n] = v;\n"
                "        // TODO: swim up\n"
                "    }\n"
                "    public int delMax() {\n"
                "        int max = heap[1];\n"
                "        // TODO: swap root with last, decrement n, sink down\n"
                "        return max;\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "private void swim(int k) {\n"
                "    while (k>1 && heap[k/2]<heap[k]) { exch(k, k/2); k=k/2; }\n"
                "}\n"
                "private void sink(int k) {\n"
                "    while (2*k<=n) { int j=2*k; if (j<n && heap[j]<heap[j+1]) j++;\n"
                "    if (heap[k]>=heap[j]) break; exch(k,j); k=j; }\n"
                "}"
            ),
            "rubric": "swim moves new element up correctly, sink moves root down choosing larger child, heap property maintained",
            "hints": ["The parent of node k is at k/2.",
                      "The children of node k are at 2k and 2k+1.",
                      "Swim while parent < child; sink while child > current."],
            "tests": [
                {"input": "insert(5),insert(3),insert(8) → delMax()", "expected": "8"},
                {"input": "insert(1),insert(2),insert(3) → delMax()", "expected": "3"},
                {"input": "insert(10) → delMax()", "expected": "10"},
            ],
        },
        "open_response": {
            "title": "Heapsort vs Mergesort",
            "description": (
                "Compare Heapsort and Mergesort in terms of: time complexity (best/average/worst), "
                "space complexity, stability, and cache performance. "
                "Why is Mergesort generally preferred in practice despite Heapsort being in-place?"
            ),
            "rubric": "Both O(n log n), heapsort O(1) space, mergesort O(n), mergesort stable, mergesort better cache locality",
        },
    },
    "Binary Search Trees": {
        "coding": {
            "title": "BST: Get and Put",
            "description": (
                "Implement `get(key)` and `put(key, val)` for a Binary Search Tree.\n\n"
                "After `put(5,'e'), put(3,'c'), put(7,'g')`, `get(3)` should return 'c'."
            ),
            "starter_code": (
                "private Node get(Node x, int key) {\n"
                "    if (x == null) return null;\n"
                "    // TODO: compare key with x.key and recurse\n"
                "    return null;\n"
                "}\n"
                "private Node put(Node x, int key, String val) {\n"
                "    if (x == null) return new Node(key, val);\n"
                "    // TODO: recurse left or right, update count\n"
                "    return x;\n"
                "}"
            ),
            "solution_code": (
                "private Node get(Node x, int key) {\n"
                "    if (x==null) return null;\n"
                "    if (key < x.key) return get(x.left, key);\n"
                "    else if (key > x.key) return get(x.right, key);\n"
                "    else return x;\n"
                "}\n"
                "private Node put(Node x, int key, String val) {\n"
                "    if (x==null) return new Node(key, val);\n"
                "    if (key<x.key) x.left=put(x.left,key,val);\n"
                "    else if (key>x.key) x.right=put(x.right,key,val);\n"
                "    else x.val=val;\n"
                "    x.count=1+size(x.left)+size(x.right);\n"
                "    return x;\n"
                "}"
            ),
            "rubric": "Correct left/right recursion based on comparison, put creates new node when null, count updated",
            "hints": ["If key < x.key, go left; if key > x.key, go right.",
                      "Return null if x is null (key not found in get).",
                      "In put, create a new node when x is null (base case)."],
            "tests": [
                {"input": "put(5,'e'),put(3,'c'),put(7,'g') → get(3)", "expected": "'c'"},
                {"input": "put(1,'a') → get(99)", "expected": "null"},
                {"input": "put(5,'x'),put(5,'y') → get(5)", "expected": "'y'"},
            ],
        },
        "open_response": {
            "title": "BST Average vs Worst Case Height",
            "description": (
                "A BST built by inserting keys in random order has expected height O(log n). "
                "What input order produces a worst-case height of O(n)? "
                "How does a Red-Black BST guarantee O(log n) height regardless of insertion order?"
            ),
            "rubric": "Identifies sorted order as worst case, O(n) height, Red-Black BST rotations maintain balance, O(log n) guaranteed",
        },
    },
    "Balanced BSTs (Red-Black Trees)": {
        "coding": {
            "title": "Left Rotation in Red-Black BST",
            "description": (
                "Implement `rotateLeft(Node h)` for a Red-Black BST. "
                "This rotation is used when a right-leaning red link needs to be corrected.\n\n"
                "After rotation, the node's right child becomes the new root, "
                "and the original root becomes its left child."
            ),
            "starter_code": (
                "private Node rotateLeft(Node h) {\n"
                "    // x becomes new root\n"
                "    Node x = h.right;\n"
                "    // TODO: reassign links and colors\n"
                "    return x;\n"
                "}"
            ),
            "solution_code": (
                "private Node rotateLeft(Node h) {\n"
                "    Node x = h.right;\n"
                "    h.right = x.left;\n"
                "    x.left = h;\n"
                "    x.color = h.color;\n"
                "    h.color = RED;\n"
                "    x.size = h.size;\n"
                "    h.size = 1 + size(h.left) + size(h.right);\n"
                "    return x;\n"
                "}"
            ),
            "rubric": "x.left = h reassignment, colors swapped correctly (h becomes RED), sizes updated",
            "hints": ["x (h's right child) becomes the new root.",
                      "h.right should now point to x's old left child.",
                      "The color of x gets h's old color; h gets RED."],
            "tests": [
                {"input": "rotateLeft on node with right red child", "expected": "right child becomes root with correct colors"},
                {"input": "subtree sizes updated correctly", "expected": "sizes consistent"},
                {"input": "h.color = RED after rotation", "expected": "true"},
            ],
        },
        "open_response": {
            "title": "Red-Black BST Invariants",
            "description": (
                "List all invariants a Red-Black BST must maintain. "
                "For each invariant, explain what would break if it were violated. "
                "How do rotations and color flips together maintain balance?"
            ),
            "rubric": "Lists: no two consecutive reds, black-height same all paths, left-leaning reds; explains balance guarantee",
        },
    },
    "Hash Tables": {
        "coding": {
            "title": "Separate Chaining Hash Table",
            "description": (
                "Implement `get(key)` and `put(key, val)` for a hash table using separate chaining. "
                "Use M=97 buckets. Each bucket is a linked list.\n\n"
                "```\nput('apple', 1); put('banana', 2); get('apple') → 1\n```"
            ),
            "starter_code": (
                "public class SeparateChainingHashST {\n"
                "    private int M = 97;\n"
                "    private Node[] st = new Node[M];\n"
                "    private int hash(String key) { return (key.hashCode() & 0x7fffffff) % M; }\n"
                "    public String get(String key) {\n"
                "        int i = hash(key);\n"
                "        // TODO: traverse chain at st[i]\n"
                "        return null;\n"
                "    }\n"
                "    public void put(String key, String val) {\n"
                "        int i = hash(key);\n"
                "        // TODO: update val if found, else prepend new node\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "public String get(String key) {\n"
                "    for (Node x=st[hash(key)]; x!=null; x=x.next)\n"
                "        if (key.equals(x.key)) return x.val;\n"
                "    return null;\n"
                "}\n"
                "public void put(String key, String val) {\n"
                "    int i = hash(key);\n"
                "    for (Node x=st[i]; x!=null; x=x.next)\n"
                "        if (key.equals(x.key)) { x.val=val; return; }\n"
                "    st[i] = new Node(key, val, st[i]);\n"
                "}"
            ),
            "rubric": "hash function uses hashCode() & 0x7fffffff, chain traversal for get, prepend new node in put",
            "hints": ["Hash the key to get the bucket index.",
                      "Traverse the linked list at that index to find the key.",
                      "If not found in put, prepend a new node to the chain."],
            "tests": [
                {"input": "put('apple',1),put('banana',2) → get('apple')", "expected": "1"},
                {"input": "get('nonexistent')", "expected": "null"},
                {"input": "put('a',1),put('a',2) → get('a')", "expected": "2"},
            ],
        },
        "open_response": {
            "title": "Load Factor and Resizing in Hash Tables",
            "description": (
                "Explain what load factor (α) is in the context of hash tables. "
                "What is the optimal load factor for separate chaining vs linear probing? "
                "Describe how dynamic resizing (doubling) maintains constant amortized time."
            ),
            "rubric": "α = n/m, separate chaining optimal ≈ 1-10, linear probing < 0.5, doubling amortizes O(1) per operation",
        },
    },
    "Undirected Graphs": {
        "coding": {
            "title": "Graph BFS: Shortest Path",
            "description": (
                "Implement BFS to find the shortest path (in number of edges) "
                "from a source vertex `s` to all other vertices.\n\n"
                "```\nGraph: 0-1, 0-2, 1-3, 2-3\nbfs(0) → distTo[3] = 2 (path: 0→1→3 or 0→2→3)\n```"
            ),
            "starter_code": (
                "private int[] distTo;\n"
                "private int[] edgeTo;\n"
                "public void bfs(Graph G, int s) {\n"
                "    distTo = new int[G.V()];\n"
                "    edgeTo = new int[G.V()];\n"
                "    Arrays.fill(distTo, -1);\n"
                "    Queue<Integer> queue = new LinkedList<>();\n"
                "    distTo[s] = 0;\n"
                "    queue.add(s);\n"
                "    while (!queue.isEmpty()) {\n"
                "        int v = queue.poll();\n"
                "        // TODO: for each neighbor w of v, if not visited: enqueue w\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "public void bfs(Graph G, int s) {\n"
                "    distTo = new int[G.V()]; edgeTo = new int[G.V()];\n"
                "    Arrays.fill(distTo, -1);\n"
                "    Queue<Integer> q = new LinkedList<>();\n"
                "    distTo[s]=0; q.add(s);\n"
                "    while (!q.isEmpty()) {\n"
                "        int v = q.poll();\n"
                "        for (int w : G.adj(v))\n"
                "            if (distTo[w]==-1) { distTo[w]=distTo[v]+1; edgeTo[w]=v; q.add(w); }\n"
                "    }\n"
                "}"
            ),
            "rubric": "Uses queue, marks visited (distTo != -1), increments distTo correctly, records edgeTo",
            "hints": ["BFS uses a FIFO queue (not a stack like DFS).",
                      "Mark a vertex as visited when you enqueue it, not when you dequeue it.",
                      "distTo[w] = distTo[v] + 1 for each unvisited neighbor w."],
            "tests": [
                {"input": "Graph 0-1,0-2,1-3,2-3 bfs(0) distTo[3]", "expected": "2"},
                {"input": "Single vertex bfs(0) distTo[0]", "expected": "0"},
                {"input": "Disconnected: bfs(0) distTo[isolated_vertex]", "expected": "-1"},
            ],
        },
        "open_response": {
            "title": "DFS vs BFS for Graph Problems",
            "description": (
                "Compare Depth-First Search (DFS) and Breadth-First Search (BFS) for undirected graphs. "
                "For which problems does BFS give the optimal solution that DFS cannot? "
                "Describe the data structure each uses and the resulting traversal order."
            ),
            "rubric": "BFS gives shortest paths (edge count), DFS does not; BFS uses queue, DFS uses stack/recursion; correct traversal order descriptions",
        },
    },
    "Directed Graphs (Digraphs)": {
        "coding": {
            "title": "Topological Sort via DFS",
            "description": (
                "Implement topological sort using iterative DFS with a reverse post-order stack.\n\n"
                "```\nDAG: 0→1, 0→2, 1→3, 2→3\nTopological order: 0 2 1 3 (or 0 1 2 3)\n```"
            ),
            "starter_code": (
                "public Iterable<Integer> topologicalSort(Digraph G) {\n"
                "    boolean[] visited = new boolean[G.V()];\n"
                "    Stack<Integer> reversePost = new Stack<>();\n"
                "    for (int v = 0; v < G.V(); v++)\n"
                "        if (!visited[v]) dfs(G, v, visited, reversePost);\n"
                "    return reversePost; // iterate from top to get topo order\n"
                "}\n"
                "private void dfs(Digraph G, int v, boolean[] visited, Stack<Integer> post) {\n"
                "    visited[v] = true;\n"
                "    // TODO: recurse on neighbors, then push v onto post\n"
                "}"
            ),
            "solution_code": (
                "private void dfs(Digraph G, int v, boolean[] visited, Stack<Integer> post) {\n"
                "    visited[v] = true;\n"
                "    for (int w : G.adj(v))\n"
                "        if (!visited[w]) dfs(G, w, visited, post);\n"
                "    post.push(v);\n"
                "}"
            ),
            "rubric": "Push v after all successors visited (post-order), reverse post-order gives topological sort",
            "hints": ["Push a vertex onto the stack after visiting ALL its successors.",
                      "The reverse of this order is the topological sort.",
                      "Only works if the graph has no cycles (is a DAG)."],
            "tests": [
                {"input": "DAG 0→1,0→2,1→3,2→3 topological order", "expected": "0 appears before 1,2; 1,2 before 3"},
                {"input": "Linear DAG 0→1→2→3", "expected": "0 1 2 3"},
                {"input": "Single node", "expected": "[0]"},
            ],
        },
        "open_response": {
            "title": "Kosaraju-Sharir Algorithm",
            "description": (
                "Describe the Kosaraju-Sharir algorithm for finding Strongly Connected Components (SCCs). "
                "Explain both phases: what each does and why the combination finds SCCs. "
                "What is the time complexity?"
            ),
            "rubric": "Phase 1: reverse postorder DFS on G^R; Phase 2: DFS on G in that order; each DFS tree = SCC; O(E+V)",
        },
    },
    "Minimum Spanning Trees": {
        "coding": {
            "title": "Kruskal's MST Algorithm",
            "description": (
                "Implement Kruskal's algorithm using a priority queue of edges and Union-Find.\n\n"
                "```\nEdges (sorted): (0-1,1),(1-2,2),(0-2,3)\nMST: (0-1,1),(1-2,2), weight=3\n```"
            ),
            "starter_code": (
                "public Iterable<Edge> kruskalMST(EdgeWeightedGraph G) {\n"
                "    MinPQ<Edge> pq = new MinPQ<>();\n"
                "    for (Edge e : G.edges()) pq.insert(e);\n"
                "    UF uf = new UF(G.V());\n"
                "    List<Edge> mst = new ArrayList<>();\n"
                "    while (!pq.isEmpty() && mst.size() < G.V()-1) {\n"
                "        Edge e = pq.delMin();\n"
                "        int v=e.either(), w=e.other(v);\n"
                "        // TODO: if v and w not already connected, add edge to MST\n"
                "    }\n"
                "    return mst;\n"
                "}"
            ),
            "solution_code": (
                "while (!pq.isEmpty() && mst.size() < G.V()-1) {\n"
                "    Edge e = pq.delMin();\n"
                "    int v=e.either(), w=e.other(v);\n"
                "    if (!uf.connected(v,w)) { uf.union(v,w); mst.add(e); }\n"
                "}"
            ),
            "rubric": "Uses Union-Find to detect cycles, adds minimum weight edge if endpoints in different components, stops at V-1 edges",
            "hints": ["Sort edges by weight — use a min priority queue.",
                      "Use Union-Find: if both endpoints have the same root, adding the edge creates a cycle.",
                      "Stop when MST has V-1 edges."],
            "tests": [
                {"input": "Triangle graph edges (0-1,1),(1-2,2),(0-2,3)", "expected": "MST weight=3"},
                {"input": "Single edge graph", "expected": "MST = that edge"},
                {"input": "4 nodes, 4 edges", "expected": "MST has 3 edges"},
            ],
        },
        "open_response": {
            "title": "Prim's vs Kruskal's Algorithm",
            "description": (
                "Compare Prim's and Kruskal's algorithms for finding the Minimum Spanning Tree. "
                "For which graph densities is each preferred? "
                "What data structures does each use, and what is the time complexity of each?"
            ),
            "rubric": "Prim's O(E log V) with binary heap, Kruskal's O(E log E), Prim's better for dense graphs, Kruskal's for sparse",
        },
    },
    "Shortest Paths": {
        "coding": {
            "title": "Dijkstra's Shortest Path",
            "description": (
                "Implement Dijkstra's algorithm using a priority queue to find shortest paths "
                "from source vertex `s` in an edge-weighted digraph with non-negative weights.\n\n"
                "```\nGraph: 0→1(1), 0→2(4), 1→2(2)\ndijkstra(0) → distTo[2] = 3\n```"
            ),
            "starter_code": (
                "private double[] distTo;\n"
                "private int[] edgeTo;\n"
                "public void dijkstra(EdgeWeightedDigraph G, int s) {\n"
                "    distTo = new double[G.V()];\n"
                "    edgeTo = new int[G.V()];\n"
                "    Arrays.fill(distTo, Double.POSITIVE_INFINITY);\n"
                "    distTo[s] = 0.0;\n"
                "    MinPQ<int[]> pq = new MinPQ<>(Comparator.comparingDouble(a -> a[1]));\n"
                "    pq.insert(new int[]{s, 0});\n"
                "    while (!pq.isEmpty()) {\n"
                "        int v = pq.delMin()[0];\n"
                "        // TODO: relax all edges from v\n"
                "    }\n"
                "}"
            ),
            "solution_code": (
                "for (DirectedEdge e : G.adj(v)) {\n"
                "    int w = e.to();\n"
                "    if (distTo[w] > distTo[v] + e.weight()) {\n"
                "        distTo[w] = distTo[v] + e.weight();\n"
                "        edgeTo[w] = v;\n"
                "        pq.insert(new int[]{w, (int)distTo[w]});\n"
                "    }\n"
                "}"
            ),
            "rubric": "Priority queue extracts minimum distance vertex, relax updates distTo[w] when shorter path found, only non-negative weights",
            "hints": ["Extract the vertex with minimum distTo from the priority queue.",
                      "For each edge v→w, check if distTo[v] + weight < distTo[w].",
                      "Dijkstra only works with non-negative weights."],
            "tests": [
                {"input": "0→1(1),0→2(4),1→2(2) dijkstra(0) distTo[2]", "expected": "3.0"},
                {"input": "Single node dijkstra(0) distTo[0]", "expected": "0.0"},
                {"input": "No path: isolated vertex distTo[isolated]", "expected": "Infinity"},
            ],
        },
        "open_response": {
            "title": "Dijkstra vs Bellman-Ford",
            "description": (
                "Explain why Dijkstra's algorithm fails with negative edge weights. "
                "How does Bellman-Ford handle negative weights? "
                "What is the time complexity of each, and when would you choose Bellman-Ford over Dijkstra?"
            ),
            "rubric": "Dijkstra greedy assumption fails with negatives, Bellman-Ford relaxes all edges V-1 times O(VE), detects negative cycles",
        },
    },
    "Dynamic Programming": {
        "coding": {
            "title": "Longest Common Subsequence (LCS)",
            "description": (
                "Implement the LCS algorithm using dynamic programming.\n\n"
                "```\nInput:  s='ABCBDAB', t='BDCABA'\nOutput: 4 (LCS = 'BCBA' or 'BDAB')\n```"
            ),
            "starter_code": (
                "public static int lcs(String s, String t) {\n"
                "    int m = s.length(), n = t.length();\n"
                "    int[][] dp = new int[m+1][n+1];\n"
                "    for (int i = 1; i <= m; i++) {\n"
                "        for (int j = 1; j <= n; j++) {\n"
                "            // TODO: fill dp[i][j]\n"
                "        }\n"
                "    }\n"
                "    return dp[m][n];\n"
                "}"
            ),
            "solution_code": (
                "if (s.charAt(i-1) == t.charAt(j-1))\n"
                "    dp[i][j] = dp[i-1][j-1] + 1;\n"
                "else\n"
                "    dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);"
            ),
            "rubric": "dp[i][j] = dp[i-1][j-1]+1 on match, max of dp[i-1][j] and dp[i][j-1] otherwise, correct base case",
            "hints": ["If s[i-1] == t[j-1], then dp[i][j] = dp[i-1][j-1] + 1.",
                      "Otherwise, dp[i][j] = max(dp[i-1][j], dp[i][j-1]).",
                      "The base case is dp[0][j] = dp[i][0] = 0."],
            "tests": [
                {"input": "s='ABCBDAB', t='BDCABA'", "expected": "4"},
                {"input": "s='ABC', t='ABC'", "expected": "3"},
                {"input": "s='A', t='B'", "expected": "0"},
            ],
        },
        "open_response": {
            "title": "Memoization vs Tabulation",
            "description": (
                "Explain the difference between memoization (top-down DP) and tabulation (bottom-up DP). "
                "For the Fibonacci sequence, show the recursive structure and how memoization avoids "
                "redundant computation. Which approach is generally more space-efficient?"
            ),
            "rubric": "Memoization = recursive + cache, tabulation = iterative table; both O(n) time; tabulation usually better space (O(1) for Fibonacci)",
        },
    },
}

# Materials: add Princeton reference links to each topic's lesson
TOPIC_MATERIALS = {
    "Fundamentals":               ("Sedgewick §1.1-1.4", "https://algs4.cs.princeton.edu/10fundamentals/"),
    "Union-Find":                 ("Sedgewick §1.5", "https://algs4.cs.princeton.edu/15uf/"),
    "Elementary Sorts":           ("Sedgewick §2.1", "https://algs4.cs.princeton.edu/21elementary/"),
    "Mergesort":                  ("Sedgewick §2.2", "https://algs4.cs.princeton.edu/22mergesort/"),
    "Quicksort":                  ("Sedgewick §2.3", "https://algs4.cs.princeton.edu/23quicksort/"),
    "Priority Queues & Heapsort": ("Sedgewick §2.4", "https://algs4.cs.princeton.edu/24pq/"),
    "Binary Search Trees":        ("Sedgewick §3.2", "https://algs4.cs.princeton.edu/32bst/"),
    "Balanced BSTs (Red-Black Trees)": ("Sedgewick §3.3", "https://algs4.cs.princeton.edu/33balanced/"),
    "Hash Tables":                ("Sedgewick §3.4", "https://algs4.cs.princeton.edu/34hash/"),
    "Undirected Graphs":          ("Sedgewick §4.1", "https://algs4.cs.princeton.edu/41graph/"),
    "Directed Graphs (Digraphs)": ("Sedgewick §4.2", "https://algs4.cs.princeton.edu/42digraph/"),
    "Minimum Spanning Trees":     ("Sedgewick §4.3", "https://algs4.cs.princeton.edu/43mst/"),
    "Shortest Paths":             ("Sedgewick §4.4", "https://algs4.cs.princeton.edu/44sp/"),
    "Dynamic Programming":        ("Sedgewick §6", "https://algs4.cs.princeton.edu/60context/"),
}

def run_seed():
    print("\n🌱 Extra Problems Seed — Coding + Open Response + Materials")
    print("=" * 60)

    # Remove old coding/open_response problems (leave MCQs untouched)
    deleted = db.query(Problem).filter(
        Problem.type.in_(["coding", "open_response"])
    ).delete(synchronize_session=False)
    print(f"  → {deleted} old coding/open_response problems removed")
    db.commit()

    # Clear existing materials and re-seed
    db.query(Material).delete(synchronize_session=False)
    db.commit()

    topics = db.query(Topic).all()
    topic_map = {t.name: t for t in topics}

    total_problems = 0
    total_materials = 0

    for topic_name, prob_data in TOPIC_PROBLEMS.items():
        topic = topic_map.get(topic_name)
        if not topic:
            print(f"  ⚠ Topic not found: {topic_name}")
            continue

        lesson = db.query(Lesson).filter_by(topic_id=topic.id).order_by(
            Lesson.display_order
        ).first()

        # ── CODING PROBLEM ───────────────────────────────────────────────────
        cd = prob_data["coding"]
        coding_id = str(uuid.uuid4())
        coding_prob = Problem(
            id=coding_id,
            topic_id=str(topic.id),
            lesson_id=str(lesson.id) if lesson else None,
            title=cd["title"],
            description=cd["description"],
            type="coding",
            difficulty="medium",
            starter_code=cd["starter_code"],
            solution_code=cd["solution_code"],
            grading_rubric=cd["rubric"],
            points=20,
            is_published=True,
        )
        db.add(coding_prob)

        for level, hint_text in enumerate(cd["hints"], start=1):
            db.add(ProblemHint(
                id=str(uuid.uuid4()),
                problem_id=coding_id,
                level=level,
                content=hint_text,
                socratic_question=f"Think: {hint_text[:60]}...",
            ))

        # Test cases
        for order, tc in enumerate(cd["tests"], start=1):
            db.add(ProblemTestCase(
                id=str(uuid.uuid4()),
                problem_id=coding_id,
                input=tc["input"],
                expected_output=tc["expected"],
                is_hidden=(order == 3),  # Son test gizli
                display_order=order,
            ))

        # ── OPEN RESPONSE PROBLEM ────────────────────────────────────────────
        od = prob_data["open_response"]
        open_id = str(uuid.uuid4())
        open_prob = Problem(
            id=open_id,
            topic_id=str(topic.id),
            lesson_id=str(lesson.id) if lesson else None,
            title=od["title"],
            description=od["description"],
            type="open_response",
            difficulty="medium",
            grading_rubric=od["rubric"],
            points=15,
            is_published=True,
        )
        db.add(open_prob)

        total_problems += 2

        # ── MATERIALS ────────────────────────────────────────────────────────
        if topic_name in TOPIC_MATERIALS and lesson:
            mat_title, mat_url = TOPIC_MATERIALS[topic_name]
            db.add(Material(
                id=str(uuid.uuid4()),
                lesson_id=str(lesson.id),
                title=mat_title,
                type="link",
                url=mat_url,
                description=f"Official Princeton Algorithms textbook section for {topic_name}",
                display_order=1,
            ))
            db.add(Material(
                id=str(uuid.uuid4()),
                lesson_id=str(lesson.id),
                title="algs4 Java Library Reference",
                type="link",
                url="https://algs4.cs.princeton.edu/code/",
                description="Java implementations of all algorithms from the textbook",
                display_order=2,
            ))
            total_materials += 2

    db.commit()

    from sqlalchemy import text as sq_text
    p_count = db.execute(sq_text("SELECT COUNT(*) FROM problems")).scalar()
    m_count = db.execute(sq_text("SELECT COUNT(*) FROM materials")).scalar()
    tc_count = db.execute(sq_text("SELECT COUNT(*) FROM problem_test_cases")).scalar()

    print(f"\n  ✅ {total_problems} yeni problem eklendi")
    print(f"  ✅ {total_materials} material eklendi")
    print(f"\n  📊 Toplam problems tablosu: {p_count}")
    print(f"  📊 Toplam materials tablosu: {m_count}")
    print(f"  📊 Toplam test_cases tablosu: {tc_count}")
    print("=" * 60)
    print("✅ Seed complete!")
    db.close()

if __name__ == "__main__":
    run_seed()
