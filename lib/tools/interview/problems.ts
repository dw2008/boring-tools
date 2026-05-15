import type { Problem } from "./types";

export const PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description:
      "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",
    difficulty: "easy",
    topics: ["arrays", "hash-map"],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
      },
    ],
    hints: [
      "A brute force approach would check every pair — can you do better?",
      "Think about what value you need to find for each element.",
      "A hash map can look up values in O(1) time.",
    ],
    optimalComplexity: { time: "O(n)", space: "O(n)" },
    solutionApproach:
      "Use a hash map to store each number's index as you iterate. For each element, check if (target - current) exists in the map.",
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if: open brackets must be closed by the same type of brackets, and open brackets must be closed in the correct order. Every close bracket has a corresponding open bracket of the same type.",
    difficulty: "easy",
    topics: ["stacks", "strings"],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists of parentheses only: '(){}[]'",
    ],
    examples: [
      {
        input: 's = "()"',
        output: "true",
      },
      {
        input: 's = "()[]{}"',
        output: "true",
      },
      {
        input: 's = "(]"',
        output: "false",
      },
    ],
    hints: [
      "What data structure follows a last-in, first-out pattern?",
      "When you see an opening bracket, what should you do? When you see a closing bracket?",
      "A stack lets you match the most recent unmatched opening bracket.",
    ],
    optimalComplexity: { time: "O(n)", space: "O(n)" },
    solutionApproach:
      "Push opening brackets onto a stack. When you encounter a closing bracket, check if the top of the stack is the matching opener. If the stack is empty at the end, the string is valid.",
  },
  {
    id: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    description:
      "You are given an array `prices` where `prices[i]` is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.",
    difficulty: "easy",
    topics: ["arrays", "sliding-window"],
    constraints: [
      "1 <= prices.length <= 10^5",
      "0 <= prices[i] <= 10^4",
    ],
    examples: [
      {
        input: "prices = [7,1,5,3,6,4]",
        output: "5",
        explanation:
          "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.",
      },
      {
        input: "prices = [7,6,4,3,1]",
        output: "0",
        explanation:
          "No profitable transaction is possible, so the max profit is 0.",
      },
    ],
    hints: [
      "You need to buy before you sell. Think about scanning left to right.",
      "Track the minimum price seen so far.",
      "At each step, the best profit is the current price minus the minimum price so far.",
    ],
    optimalComplexity: { time: "O(n)", space: "O(1)" },
    solutionApproach:
      "Keep track of the minimum price seen so far and the maximum profit. For each price, update the minimum and calculate potential profit.",
  },
  {
    id: "binary-tree-inorder-traversal",
    title: "Binary Tree Inorder Traversal",
    description:
      "Given the `root` of a binary tree, return the inorder traversal of its nodes' values. In an inorder traversal, you visit the left subtree first, then the current node, then the right subtree.",
    difficulty: "medium",
    topics: ["trees", "recursion"],
    constraints: [
      "The number of nodes in the tree is in the range [0, 100].",
      "-100 <= Node.val <= 100",
    ],
    examples: [
      {
        input: "root = [1,null,2,3]",
        output: "[1,3,2]",
      },
      {
        input: "root = []",
        output: "[]",
      },
      {
        input: "root = [1]",
        output: "[1]",
      },
    ],
    hints: [
      "What is the order of visiting nodes in an inorder traversal?",
      "Think about how recursion naturally handles tree structures.",
      "Can you also solve it iteratively using a stack?",
    ],
    optimalComplexity: { time: "O(n)", space: "O(n)" },
    solutionApproach:
      "Recursively traverse: visit left subtree, add current node's value, visit right subtree. Iteratively, use a stack to simulate the call stack.",
  },
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    description:
      "You are climbing a staircase. It takes `n` steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    difficulty: "medium",
    topics: ["dynamic-programming"],
    constraints: ["1 <= n <= 45"],
    examples: [
      {
        input: "n = 2",
        output: "2",
        explanation: "There are two ways: (1+1) and (2).",
      },
      {
        input: "n = 3",
        output: "3",
        explanation: "There are three ways: (1+1+1), (1+2), and (2+1).",
      },
    ],
    hints: [
      "How many ways can you reach step n if you know the answer for steps n-1 and n-2?",
      "This is related to a well-known mathematical sequence.",
      "Think about the base cases: how many ways to reach step 1? Step 2?",
    ],
    optimalComplexity: { time: "O(n)", space: "O(1)" },
    solutionApproach:
      "This is the Fibonacci sequence. ways(n) = ways(n-1) + ways(n-2). Use two variables to track the previous two values.",
  },
];
