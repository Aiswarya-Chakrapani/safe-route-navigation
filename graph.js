// graph.js - Graph implementation for path finding
class Graph {
    constructor() {
      this.nodes = new Map();
      this.edges = new Map();
    }
    
    /**
     * Add a node to the graph
     * @param {number|string} id - Node identifier
     * @param {Object} attrs - Node attributes
     */
    addNode(id, attrs = {}) {
      this.nodes.set(id, attrs);
      this.edges.set(id, new Map());
    }
    
    /**
     * Add an edge between two nodes
     * @param {number|string} u - First node
     * @param {number|string} v - Second node
     * @param {Object} attrs - Edge attributes
     */
    addEdge(u, v, attrs = {}) {
      if (!this.nodes.has(u)) this.addNode(u);
      if (!this.nodes.has(v)) this.addNode(v);
      
      this.edges.get(u).set(v, attrs);
    }
    
    /**
     * Update edge attributes
     * @param {number|string} u - First node
     * @param {number|string} v - Second node
     * @param {Object} attrs - New attributes
     */
    updateEdge(u, v, attrs) {
      if (!this.hasEdge(u, v)) {
        throw new Error(`Edge ${u}-${v} does not exist`);
      }
      
      const currentAttrs = this.edges.get(u).get(v);
      this.edges.get(u).set(v, { ...currentAttrs, ...attrs });
    }
    
    /**
     * Check if an edge exists
     * @param {number|string} u - First node
     * @param {number|string} v - Second node
     * @returns {boolean} True if edge exists
     */
    hasEdge(u, v) {
      return this.nodes.has(u) && this.edges.get(u).has(v);
    }
    
    /**
     * Get node attributes
     * @param {number|string} id - Node identifier
     * @returns {Object} Node attributes
     */
    getNode(id) {
      if (!this.nodes.has(id)) {
        throw new Error(`Node ${id} does not exist`);
      }
      return this.nodes.get(id);
    }
    
    /**
     * Get edge attributes
     * @param {number|string} u - First node
     * @param {number|string} v - Second node
     * @returns {Object} Edge attributes
     */
    getEdge(u, v) {
      if (!this.hasEdge(u, v)) {
        throw new Error(`Edge ${u}-${v} does not exist`);
      }
      return this.edges.get(u).get(v);
    }
    
    /**
     * Get all nodes
     * @returns {Array} Array of [id, attributes] pairs
     */
    getNodes() {
      return Array.from(this.nodes.entries());
    }
    
    /**
     * Get all edges
     * @returns {Array} Array of [u, v, attributes] tuples
     */
    edges() {
      const result = [];
      for (const [u, neighbors] of this.edges.entries()) {
        for (const [v, attrs] of neighbors.entries()) {
          result.push([u, v, attrs]);
        }
      }
      return result;
    }
    
    /**
     * Get the number of nodes
     * @returns {number} Node count
     */
    nodeCount() {
      return this.nodes.size;
    }
    
    /**
     * Find shortest path using Dijkstra's algorithm
     * @param {number|string} start - Start node
     * @param {number|string} end - End node
     * @param {string} weightAttr - Edge attribute to use as weight
     * @returns {Array} Array of node IDs representing the path
     */
    shortestPath(start, end, weightAttr = 'length') {
      // Check if nodes exist
      if (!this.nodes.has(start)) {
        throw new Error(`Start node ${start} does not exist`);
      }
      if (!this.nodes.has(end)) {
        throw new Error(`End node ${end} does not exist`);
      }
      
      // Handle special case
      if (start === end) {
        return [start];
      }
      
      // Initialize
      const dist = new Map();
      const prev = new Map();
      const queue = new PriorityQueue();
      
      // Set initial distances
      for (const node of this.nodes.keys()) {
        dist.set(node, Infinity);
        prev.set(node, null);
      }
      
      // Distance to start is 0
      dist.set(start, 0);
      queue.enqueue(start, 0);
      
      while (!queue.isEmpty()) {
        // Get node with smallest distance
        const u = queue.dequeue().element;
        
        // If we've reached the end node, we're done
        if (u === end) break;
        
        // Check all neighbors
        const neighbors = this.edges.get(u);
        if (!neighbors) continue;
        
        for (const [v, attrs] of neighbors.entries()) {
          // Calculate new distance
          const weight = attrs[weightAttr] || 1;
          const alt = dist.get(u) + weight;
          
          // If we found a shorter path, update
          if (alt < dist.get(v)) {
            dist.set(v, alt);
            prev.set(v, u);
            
            // Add to queue or update priority
            if (queue.hasElement(v)) {
              queue.changePriority(v, alt);
            } else {
              queue.enqueue(v, alt);
            }
          }
        }
      }
      
      // Reconstruct path
      const path = [];
      let current = end;
      
      // If there is no path to the end node
      if (prev.get(end) === null && start !== end) {
        throw new Error(`No path exists from ${start} to ${end}`);
      }
      
      while (current !== null) {
        path.unshift(current);
        current = prev.get(current);
      }
      
      return path;
    }
  }
  
  /**
   * Simple Priority Queue implementation
   */
  class PriorityQueue {
    constructor() {
      this.elements = [];
      this.elementMap = new Map();
    }
    
    /**
     * Add element to queue
     * @param {*} element - Element to add
     * @param {number} priority - Priority value (lower is higher priority)
     */
    enqueue(element, priority) {
      if (this.hasElement(element)) {
        this.changePriority(element, priority);
        return;
      }
      
      this.elements.push({ element, priority });
      this.elementMap.set(element, this.elements.length - 1);
      this._bubbleUp(this.elements.length - 1);
    }
    
    /**
     * Remove element with highest priority
     * @returns {Object} Element and its priority
     */
    dequeue() {
      if (this.isEmpty()) {
        throw new Error('Queue is empty');
      }
      
      const min = this.elements[0];
      const end = this.elements.pop();
      this.elementMap.delete(min.element);
      
      if (this.elements.length > 0) {
        this.elements[0] = end;
        this.elementMap.set(end.element, 0);
        this._sinkDown(0);
      }
      
      return min;
    }
    
    /**
     * Change element's priority
     * @param {*} element - Element to update
     * @param {number} priority - New priority
     */
    changePriority(element, priority) {
      if (!this.hasElement(element)) {
        throw new Error('Element not found');
      }
      
      const index = this.elementMap.get(element);
      const oldPriority = this.elements[index].priority;
      
      this.elements[index].priority = priority;
      
      if (priority < oldPriority) {
        this._bubbleUp(index);
      } else {
        this._sinkDown(index);
      }
    }
    
    /**
     * Check if element exists in queue
     * @param {*} element - Element to check
     * @returns {boolean} True if element exists
     */
    hasElement(element) {
      return this.elementMap.has(element);
    }
    
    /**
     * Check if queue is empty
     * @returns {boolean} True if empty
     */
    isEmpty() {
      return this.elements.length === 0;
    }
    
    /**
     * Move element up the heap
     * @param {number} index - Element index
     * @private
     */
    _bubbleUp(index) {
      const element = this.elements[index];
      
      while (index > 0) {
        const parentIndex = Math.floor((index - 1) / 2);
        const parent = this.elements[parentIndex];
        
        if (element.priority >= parent.priority) break;
        
        // Swap with parent
        this.elements[parentIndex] = element;
        this.elements[index] = parent;
        
        // Update map
        this.elementMap.set(element.element, parentIndex);
        this.elementMap.set(parent.element, index);
        
        index = parentIndex;
      }
    }
    
    /**
     * Move element down the heap
     * @param {number} index - Element index
     * @private
     */
    _sinkDown(index) {
      const length = this.elements.length;
      const element = this.elements[index];
      
      while (true) {
        const leftChildIndex = 2 * index + 1;
        const rightChildIndex = 2 * index + 2;
        let swapIndex = null;
        
        // Check left child
        if (leftChildIndex < length) {
          const leftChild = this.elements[leftChildIndex];
          if (leftChild.priority < element.priority) {
            swapIndex = leftChildIndex;
          }
        }
        
        // Check right child
        if (rightChildIndex < length) {
          const rightChild = this.elements[rightChildIndex];
          if (
            (swapIndex === null && rightChild.priority < element.priority) ||
            (swapIndex !== null && rightChild.priority < this.elements[swapIndex].priority)
          ) {
            swapIndex = rightChildIndex;
          }
        }
        
        if (swapIndex === null) break;
        
        // Swap with child
        this.elements[index] = this.elements[swapIndex];
        this.elements[swapIndex] = element;
        
        // Update map
        this.elementMap.set(this.elements[index].element, index);
        this.elementMap.set(element.element, swapIndex);
        
        index = swapIndex;
      }
    }
  }
  
  module.exports = { Graph, PriorityQueue };