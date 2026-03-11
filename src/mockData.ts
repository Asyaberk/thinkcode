import { Section, Lesson, Question, Problem, Resource } from './types';

export const sections: Section[] = [
  { id: 'cpp-basics', title: 'C++ Basics', isCompleted: true },
  { id: 'cpp-pointers', title: 'Pointers & Memory', isCompleted: false },
  { id: 'cpp-classes', title: 'Classes & OOP', isCompleted: false },
  { id: 'cpp-stl', title: 'STL Containers', isCompleted: false },
  { id: 'cpp-templates', title: 'Templates', isCompleted: false },
];

const commonResources: Resource[] = [
  { id: 'r1', title: 'Algorithms Book Chapter 1 (PDF)', type: 'PDF', url: '#', description: 'Comprehensive guide to C++ basics and algorithms.' },
  { id: 'r2', title: 'Lecture Recording', type: 'Video', url: '#', description: 'Full video lecture from the course instructor.' },
  { id: 'r3', title: 'Princeton Algorithms Website', type: 'Link', url: '#', description: 'External resource for advanced algorithm visualization.' },
];

export const lessons: Record<string, Lesson> = {
  'cpp-basics': {
    id: 'l1',
    sectionId: 'cpp-basics',
    title: 'Introduction to C++',
    content: `
# Welcome to C++

C++ is a powerful general-purpose programming language. It can be used to develop operating systems, browsers, games, and so on.

## Hello World
A simple C++ program looks like this:

\`\`\`cpp
#include <iostream>

int main() {
    std::cout << "Hello World!" << std::endl;
    return 0;
}
\`\`\`

## Variables
C++ is a strongly typed language.

\`\`\`cpp
int myNum = 5;               // Integer
double myFloatNum = 5.99;    // Floating point number
char myLetter = 'D';         // Character
std::string myText = "Hello"; // String
bool myBoolean = true;       // Boolean
\`\`\`
    `,
    resources: commonResources,
  },
  'cpp-pointers': {
    id: 'l2',
    sectionId: 'cpp-pointers',
    title: 'Pointers & Memory',
    content: '# Pointers\n\nPointers are variables that store memory addresses.',
    resources: [commonResources[0]],
  }
};

export const questions: Record<string, Question> = {
  'cpp-basics': {
    id: 'q1',
    lessonId: 'l1',
    title: 'C++ Output Challenge',
    description: 'How do you print "Hello World" in C++ using the standard library?',
    type: 'Coding',
    options: [
      { id: 'a', text: 'print("Hello World");' },
      { id: 'b', text: 'std::cout << "Hello World" << std::endl;' },
      { id: 'c', text: 'Console.WriteLine("Hello World");' },
      { id: 'd', text: 'echo "Hello World";' },
    ],
    correctOptionId: 'b',
    starterCode: `#include <iostream>\n\nint main() {\n    _____\n    return 0;\n}`,
    solutionTemplate: `#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`,
    explanation: "In C++, `std::cout` is the standard output stream object defined in the `<iostream>` header.",
    relatedResources: [commonResources[0], commonResources[2]],
  },
  'two-sum': {
    id: 'q2',
    lessonId: 'l1',
    title: 'Two Sum',
    description: 'Given an array of integers, return indices of the two numbers such that they add up to a specific target.',
    type: 'Coding',
    options: [
      { id: 'a', text: 'for(int i=0; i<n; i++)' },
      { id: 'b', text: 'std::unordered_map<int, int> map;' },
      { id: 'c', text: 'std::sort(nums.begin(), nums.end());' },
      { id: 'd', text: 'return {i, j};' },
    ],
    correctOptionId: 'b',
    starterCode: `#include <iostream>\n#include <vector>\n#include <unordered_map>\n\nstd::vector<int> twoSum(std::vector<int>& nums, int target) {\n    _____\n    // Implementation here\n    return {};\n}`,
    solutionTemplate: `#include <iostream>\n#include <vector>\n#include <unordered_map>\n\nstd::vector<int> twoSum(std::vector<int>& nums, int target) {\n    std::unordered_map<int, int> map;\n    return {};\n}`,
    explanation: "Using a hash map (std::unordered_map) allows us to find the complement of each number in O(1) time.",
  },
  'quicksort-complexity': {
    id: 'q4',
    lessonId: 'l1',
    title: 'Explain QuickSort Complexity',
    description: 'Explain the average and worst-case time complexity of QuickSort and what causes the worst-case scenario.',
    type: 'Open Response',
    explanation: 'QuickSort has an average time complexity of O(n log n) and a worst-case of O(n^2). The worst case occurs when the pivot selection consistently results in highly unbalanced partitions.',
    relatedResources: [commonResources[1]],
  },
  'binary-search-concept': {
    id: 'q5',
    lessonId: 'l1',
    title: 'Binary Search Concept',
    description: 'Which of the following is a prerequisite for Binary Search?',
    type: 'Multiple Choice',
    options: [
      { id: 'a', text: 'The array must be sorted' },
      { id: 'b', text: 'The array must contain only positive integers' },
      { id: 'c', text: 'The array must be smaller than 100 elements' },
      { id: 'd', text: 'The array must be unsorted' },
    ],
    correctOptionId: 'a',
    explanation: 'Binary search works by repeatedly dividing the search interval in half. This is only possible if the data is sorted.',
  }
};

export const instructorData = {
  classOverview: {
    totalStudents: 156,
    averageScore: 72.4,
    medianScore: 75,
    distribution: [
      { range: '0-50', count: 12 },
      { range: '50-70', count: 34 },
      { range: '70-85', count: 82 },
      { range: '85-100', count: 28 },
    ],
  },
  knowledgeGaps: [
    { topic: 'Pointers', incorrectRate: 62 },
    { topic: 'Graphs', incorrectRate: 55 },
    { topic: 'Sorting', incorrectRate: 32 },
    { topic: 'Recursion', incorrectRate: 28 },
    { topic: 'Dynamic Programming', incorrectRate: 45 },
  ],
  difficultQuestions: [
    { title: 'Pointer Arithmetic', failRate: 65 },
    { title: 'Memory Leaks', failRate: 38 },
    { title: 'STL Map Iterators', failRate: 42 },
    { title: 'Red-Black Tree Rotations', failRate: 58 },
  ],
  openResponseStats: {
    averageScore: 68.5,
    aiFeedbackSummary: "Most students understand the conceptual complexity of QuickSort but struggle to explain the specific pivot selection impact on worst-case scenarios. Common missing points include the 'already sorted' array case.",
  },
  students: [
    { name: 'Alice Johnson', averageScore: 92, percentile: 98, questionsAttempted: 45, weakTopic: 'Dynamic Programming' },
    { name: 'Bob Smith', averageScore: 64, percentile: 32, questionsAttempted: 38, weakTopic: 'Pointers' },
    { name: 'Charlie Brown', averageScore: 78, percentile: 65, questionsAttempted: 42, weakTopic: 'Graphs' },
    { name: 'Diana Prince', averageScore: 88, percentile: 89, questionsAttempted: 44, weakTopic: 'Sorting' },
    { name: 'Ethan Hunt', averageScore: 52, percentile: 15, questionsAttempted: 30, weakTopic: 'Recursion' },
  ],
};

export const problems: Problem[] = [
  { id: 'p1', title: 'Two Sum', difficulty: 'Easy', type: 'Coding', topic: 'Arrays', status: 'Unsolved', attempts: 0, questionId: 'two-sum' },
  { id: 'p2', title: 'Reverse Linked List', difficulty: 'Easy', type: 'Coding', topic: 'Pointers', status: 'Solved', attempts: 1, questionId: 'cpp-pointers' },
  { id: 'p3', title: 'Binary Search Concept', difficulty: 'Easy', type: 'Multiple Choice', topic: 'Algorithms', status: 'Unsolved', attempts: 2, questionId: 'binary-search-concept' },
  { id: 'p4', title: 'Explain QuickSort Complexity', difficulty: 'Medium', type: 'Open Response', topic: 'Sorting', status: 'Unsolved', attempts: 0, questionId: 'quicksort-complexity' },
  { id: 'p5', title: 'LRU Cache', difficulty: 'Hard', type: 'Coding', topic: 'STL', status: 'Unsolved', attempts: 5, questionId: 'cpp-stl' },
];
