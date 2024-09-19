document.addEventListener('DOMContentLoaded', () => {
    const mazeContainer = document.getElementById('maze-container');
    const algorithmSelector = document.getElementById('search-algorithm');
    const startButton = document.getElementById('start-button');
    const generateMazeButton = document.getElementById('generate-maze');

    let maze;
    let generatedMaze;

    // Generate random maze with start and end nodes
    async function generateRandomMaze(rows, cols, obstaclePercentage) {
        // Initialize with paths
        const newMaze = Array.from({ length: rows }, () => Array(cols).fill(3));

        // Generate obstacles
        for (let i = 0; i < rows * cols * obstaclePercentage; i++) {
            let randomRow, randomCol;
            do {
                randomRow = Math.floor(Math.random() * rows);
                randomCol = Math.floor(Math.random() * cols);
            } while (newMaze[randomRow][randomCol] !== 3);
            // Use 0 for obstacles
            newMaze[randomRow][randomCol] = 0;
        }

        // Initialize start and end nodes randomly
        const startNode = getRandomPosition(rows, cols);
        const endNode = getRandomPosition(rows, cols, [startNode]);

        // Use value 1 for start and 2 for end
        newMaze[startNode.row][startNode.col] = 1;
        newMaze[endNode.row][endNode.col] = 2;

        // Introduce paths with costs from 3 to 5 and set colors
        for (let i = 0; i < rows * cols * 0.6; i++) {
            let randomRow, randomCol;
            do {
                randomRow = Math.floor(Math.random() * rows);
                randomCol = Math.floor(Math.random() * cols);
            } while (newMaze[randomRow][randomCol] !== 3);

            // Assign a cost to the cell (3, 4, or 5)
            const cost = Math.floor(Math.random() * 3) + 3;
            newMaze[randomRow][randomCol] = cost;
        }

        // Ensure there's only one path with cost 1
        if (newMaze.flat().filter(cell => cell === 1).length > 1) {
            const startNodePosition = getRandomPosition(rows, cols);
            newMaze[startNodePosition.row][startNodePosition.col] = 1;
        }

        // Ensure there's only one path with cost 2
        if (newMaze.flat().filter(cell => cell === 2).length > 1) {
            const endNodePosition = getRandomPosition(rows, cols, [startNode]);
            newMaze[endNodePosition.row][endNodePosition.col] = 2;
        }

        return { maze: newMaze, startNode, endNode };
    };

    // Function for generate random position
    function getRandomPosition(rows, cols, excludePositions = []) {
        let randomPosition;
        do {
            randomPosition = {
                row: Math.floor(Math.random() * rows),
                col: Math.floor(Math.random() * cols)
            };
        } while (excludePositions.some(pos => pos.row === randomPosition.row && pos.col === randomPosition.col));

        return randomPosition;
    };

    // Update the renderMaze function
    function renderMaze(maze, container) {
        // Clear the container
        container.innerHTML = '';

        maze.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('maze-row');

            row.forEach((cell, colIndex) => {
                const cellDiv = document.createElement('div');
                cellDiv.classList.add('maze-cell');

                if (cell === 0) {
                    cellDiv.classList.add('wall');
                } else if (cell === 1) {
                    cellDiv.classList.add('start');
                } else if (cell === 2) {
                    cellDiv.classList.add('end');
                } else if (cell >= 3 && cell <= 5) {
                    // Handle different path costs here (3, 4, or 5)
                    if (cell === 3) {
                        cellDiv.classList.add('path-cost-3');
                    } else if (cell === 4) {
                        cellDiv.classList.add('path-cost-4');
                    } else if (cell === 5) {
                        cellDiv.classList.add('path-cost-5');
                    }
                }

                cellDiv.textContent = cell;
                rowDiv.appendChild(cellDiv);
            });

            container.appendChild(rowDiv);
        });

        // Add the appropriate class to the start and end cells in the current container
        const startCell = container.querySelector('.maze-cell.start');
        const endCell = container.querySelector('.maze-cell.end');

        if (startCell) {
            startCell.classList.add('start');
        }

        if (endCell) {
            endCell.classList.add('end');
        }
    }

    // Function that finds neighbors nodes
    function getNeighbors(node, maze) {
        const neighbors = [];
        const directions = [
            { row: -1, col: 0 },
            { row: 1, col: 0 },
            { row: 0, col: -1 },
            { row: 0, col: 1 },
        ];

        for (const direction of directions) {
            const newRow = node.row + direction.row;
            const newCol = node.col + direction.col;

            if (
                newRow >= 0 &&
                newRow < maze.length &&
                newCol >= 0 &&
                newCol < maze[0].length &&
                maze[newRow][newCol] !== 0
            ) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }

        return neighbors;
    }

    // Function that reconstructs path for bidirectioanl search algorithm
    async function reconstructBidirectionalPath(intersectionPoint, forwardPrevious, backwardPrevious) {
        const reconstructPathFromIntersection = async (current, previous, isBestPath) => {
            const path = [];
            while (previous && current) {
                path.unshift(current);
                const key = `${current.row},${current.col}`;
                current = previous.get(key);
            }
            await drawPath(path, isBestPath);
        };

        const hasBestPath = forwardPrevious instanceof Map;
        const forwardPathPromise = reconstructPathFromIntersection(intersectionPoint, forwardPrevious, hasBestPath);

        if (backwardPrevious instanceof Map) {
            const backwardPathPromise = reconstructPathFromIntersection(intersectionPoint, backwardPrevious, hasBestPath);
            await Promise.all([forwardPathPromise, backwardPathPromise]);
        } else if (hasBestPath) {
            await markPath(intersectionPoint, true);
        }
    }

    // Function to recconstructs path
    async function reconstructPath(node, previous, isBestPath = false) {
        const path = [];
        let current = node;

        while (current) {
            path.unshift(current);
            current = previous.get(`${current.row},${current.col}`);
        }

        for (const node of path) {
            await markPath(node, isBestPath);
        }
    }

    // Mark a visited cell
    function markVisited(node) {
        const cell = document.querySelector(`.maze-row:nth-child(${node.row + 1}) .maze-cell:nth-child(${node.col + 1})`);
        cell.classList.add('visited');
    }

    // Mark a path with the specified color
    async function drawPath(path, isBestPath, isReverse = false) {
        for (const node of path) {
            await markPath(node, isBestPath, isReverse);
            await sleep(50); // Add a sleep between marking each cell
        }
    }

    async function markPath(node, isBestPath, isReverse) {
        const row = node.row + 1;
        const col = node.col + 1;

        if (!isNaN(row) && !isNaN(col)) {
            const cell = document.querySelector(`.maze-row:nth-child(${row}) .maze-cell:nth-child(${col})`);

            if (cell) {
                // Remove all existing classes
                cell.classList.remove('path', 'best-path', 'general-path', 'green-path', 'yellow-path');

                // Add the appropriate class based on conditions
                if (isBestPath) {
                    cell.classList.add(isReverse ? 'yellow-path' : 'best-path');
                } else {
                    // Use the 'general-path' class for the regular path
                    cell.classList.add('general-path');
                }

                await sleep(50); // Add a sleep after updating the cell class
            }
        }
    }

    function markEnqueued(node) {
        const cell = document.querySelector(`.maze-row:nth-child(${node.row + 1}) .maze-cell:nth-child(${node.col + 1})`);
        cell.classList.add('enqueued');
    }

    // Function to sleep for a specified duration
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Your existing algorithm functions...
    function bfsAlgorithm() {
        if (!startNode || !maze) {
            console.error('startNode or maze is undefined.');
            return;
        }

        const queue = [];
        const visited = new Set();

        queue.push(startNode);
        visited.add(`${startNode.row},${startNode.col}`);

        function processQueue() {

            if (queue.length === 0) {
                alert('Put nije pronađen.');
                return;
            }

            const current = queue.shift();

            if (!current) {
                console.error('Current node is undefined.');
                return;
            }


            const neighbors = getNeighbors(current, maze);

            if (!neighbors) {
                console.error('Neighbors are undefined for the current node.');
                return;
            }

            for (const neighbor of neighbors) {
                const key = `${neighbor.row},${neighbor.col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(neighbor);
                    markVisited(neighbor);

                    if (neighbor.row === endNode.row && neighbor.col === endNode.col) {
                        const previous = new Map();
                        reconstructPath(neighbor, previous, true);
                        return;
                    }
                }
            }

            setTimeout(processQueue, 50);
        }

        processQueue();
    }



    async function dfsAlgorithm() {
        const stack = [];
        const visited = new Set();

        stack.push(startNode);

        async function processStack() {
            if (stack.length === 0) {
                alert('Path not found.');
                return;
            }

            const current = stack.pop();

            if (!current) {
                console.error('Current node is undefined.');
                return;
            }

            markVisited(current);

            const neighbors = getNeighbors(current, maze);

            if (!neighbors) {
                console.error('Neighbors are undefined for the current node.');
                return;
            }

            for (const neighbor of neighbors) {
                const key = `${neighbor.row},${neighbor.col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    stack.push(neighbor);

                    if (neighbor.row === endNode.row && neighbor.col === endNode.col) {
                        const previous = new Map();
                        await reconstructPath(neighbor, previous, true);
                        return;
                    }
                }
            }

            setTimeout(processStack, 50);
        }

        processStack();
    }

    function getLowestFScoreNode(openSet, fScore) {
        let lowestNode = null;
        let lowestFScore = Number.MAX_SAFE_INTEGER;

        for (const node of openSet) {
            const score = fScore.get(`${node.row},${node.col}`);
            if (score < lowestFScore) {
                lowestFScore = score;
                lowestNode = node;
            }
        }

        return lowestNode;
    }

    // Heuristic function using Manhattan distance
    function heuristic(node, target) {
        return Math.abs(node.row - target.row) + Math.abs(node.col - target.col);
    }

    async function aStarAlgorithm() {
        const openSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        openSet.add(startNode);
        gScore.set(`${startNode.row},${startNode.col}`, 0);
        fScore.set(`${startNode.row},${startNode.col}`, heuristic(startNode, endNode));

        async function processAStar() {
            while (openSet.size > 0) {
                const current = getLowestFScoreNode(openSet, fScore);

                if (!current) {
                    console.error('Current node is undefined.');
                    break;
                }

                if (current.row === endNode.row && current.col === endNode.col) {
                    await reconstructPath(current, cameFrom, true); // Pass true for isBestPath
                    return;
                }

                openSet.delete(current);
                markVisited(current);

                const neighbors = getNeighbors(current, maze);
                if (!neighbors) {
                    console.error('Neighbors are undefined for the current node.');
                    break;
                }

                for (const neighbor of neighbors) {
                    await processAStarNeighbor(neighbor, current);
                }

                // Wait for a delay before the next iteration
                await sleep(50);
            }

            console.error('Path not found.');
        }

        async function processAStarNeighbor(neighbor, current) {
            const tentativeGScore = gScore.get(`${current.row},${current.col}`) + 1;

            // Initialize G score for the neighbor if not already set
            if (!gScore.has(`${neighbor.row},${neighbor.col}`)) {
                gScore.set(`${neighbor.row},${neighbor.col}`, Infinity);
            }

            if (tentativeGScore < gScore.get(`${neighbor.row},${neighbor.col}`)) {
                cameFrom.set(`${neighbor.row},${neighbor.col}`, current);
                gScore.set(`${neighbor.row},${neighbor.col}`, tentativeGScore);
                fScore.set(
                    `${neighbor.row},${neighbor.col}`,
                    tentativeGScore + heuristic(neighbor, endNode)
                );

                if (!openSet.has(neighbor)) {
                    openSet.add(neighbor);
                    markVisited(neighbor);
                }
            }
        }

        // Start the A* algorithm
        await processAStar();
    }

    async function dijkstraAlgorithm() {

        if (!startNode || !maze) {
            console.error('startNode or maze is undefined.');
            return;
        }

        const queue = new Queue();
        const distance = new Map();
        const previous = new Map();

        queue.enqueue(startNode);
        distance.set(`${startNode.row},${startNode.col}`, 0);

        while (!queue.isEmpty()) {
            const current = queue.dequeue();

            if (!current) {
                console.error('Current node is undefined.');
                return;
            }

            if (current.row === endNode.row && current.col === endNode.col) {
                await reconstructPath(current, previous, true);
                return;
            }

            markEnqueued(current);

            const neighbors = getNeighbors(current, maze);
            if (!neighbors) {
                console.error('Neighbors are undefined for the current node.');
                return;
            }

            for (const neighbor of neighbors) {
                const newDistance = distance.get(`${current.row},${current.col}`) + maze[neighbor.row][neighbor.col];

                if (!distance.has(`${neighbor.row},${neighbor.col}`) || newDistance < distance.get(`${neighbor.row},${neighbor.col}`)) {
                    distance.set(`${neighbor.row},${neighbor.col}`, newDistance);
                    previous.set(`${neighbor.row},${neighbor.col}`, current);
                    queue.enqueue(neighbor);
                    await sleep(50);
                    markVisited(neighbor);
                }
            }
        }

        alert('Put nije pronađen.');

        if (distance.has(`${endNode.row},${endNode.col}`)) {
            await reconstructPath(endNode, previous, true);
        }
    }

    async function ucsAlgorithm() {

        if (!startNode || !maze) {
            console.error('startNode or maze is undefined.');
            return;
        }

        const priorityQueue = new PriorityQueue(); // Koristimo prioritetni red umesto običnog reda
        const costSoFar = new Map();
        const previous = new Map();

        priorityQueue.enqueue(startNode, 0);
        costSoFar.set(`${startNode.row},${startNode.col}`, 0);

        while (!priorityQueue.isEmpty()) {
            const current = priorityQueue.dequeue();

            if (!current) {
                console.error('Current node is undefined.');
                return;
            }

            if (current.row === endNode.row && current.col === endNode.col) {
                await reconstructBidirectionalPath(current, previous, true, false, false);
                return;
            }

            markEnqueued(current);

            const neighbors = getNeighbors(current, maze);
            if (!neighbors) {
                console.error('Neighbors are undefined for the current node.');
                return;
            }

            for (const neighbor of neighbors) {
                const newCost = costSoFar.get(`${current.row},${current.col}`) + maze[neighbor.row][neighbor.col];

                if (!costSoFar.has(`${neighbor.row},${neighbor.col}`) || newCost < costSoFar.get(`${neighbor.row},${neighbor.col}`)) {
                    costSoFar.set(`${neighbor.row},${neighbor.col}`, newCost);
                    previous.set(`${neighbor.row},${neighbor.col}`, current);
                    priorityQueue.enqueue(neighbor, newCost);
                    await sleep(50);
                    markVisited(neighbor);
                }
            }
        }

        console.log('Path not found.');
        alert('Put nije pronađen.');

        if (costSoFar.has(`${endNode.row},${endNode.col}`)) {
            await reconstructBidirectionalPath(endNode, previous, true, false, false);
        }
    }

    async function bidirectionalAlgorithm() {
        const forwardQueue = new Queue();
        const backwardQueue = new Queue();
        const forwardVisited = new Set();
        const backwardVisited = new Set();
        const forwardPrevious = new Map();
        const backwardPrevious = new Map();
        const intersectionPoint = { row: -1, col: -1 };

        async function exploreNeighbors(queue, visited, previous, current, isForward) {
            const neighbors = getNeighbors(current, maze);

            for (const neighbor of neighbors) {
                const key = `${neighbor.row},${neighbor.col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.enqueue(neighbor);
                    previous.set(key, current);
                    markVisited(neighbor);
                    await sleep(50);
                }

                if (isForward && backwardVisited.has(key)) {
                    intersectionPoint.row = neighbor.row;
                    intersectionPoint.col = neighbor.col;
                    return true;
                }
            }

            return false;
        }

        forwardQueue.enqueue(startNode);
        backwardQueue.enqueue(endNode);
        forwardVisited.add(`${startNode.row},${startNode.col}`);
        backwardVisited.add(`${endNode.row},${endNode.col}`);

        while (!forwardQueue.isEmpty() && !backwardQueue.isEmpty()) {
            const forwardCurrent = forwardQueue.isEmpty() ? null : forwardQueue.dequeue();
            const backwardCurrent = backwardQueue.isEmpty() ? null : backwardQueue.dequeue();

            if (forwardCurrent) markVisited(forwardCurrent);
            if (backwardCurrent) markVisited(backwardCurrent);

            const forwardIntersection = await exploreNeighbors(forwardQueue, forwardVisited, forwardPrevious, forwardCurrent, true);
            if (forwardIntersection) {
                await reconstructBidirectionalPath(intersectionPoint, forwardPrevious, backwardPrevious);
                return;
            }

            const backwardIntersection = await exploreNeighbors(backwardQueue, backwardVisited, backwardPrevious, backwardCurrent, false);
            if (backwardIntersection) {
                await reconstructBidirectionalPath(intersectionPoint, forwardPrevious, backwardPrevious);
                return;
            }
        }

        alert('Put nije pronađen.');
    }

    // Add this function definition in your script

    class Queue {
        constructor() {
            this.items = [];
        }

        enqueue(element) {
            this.items.push(element);
        }

        dequeue() {
            if (this.isEmpty()) {
                return null;
            }
            return this.items.shift();
        }

        isEmpty() {
            return this.items.length === 0;
        }
    }

    class PriorityQueue {
        constructor() {
            this.elements = [];
        }

        enqueue(element, priority) {
            this.elements.push({ element, priority });
            this.elements.sort((a, b) => a.priority - b.priority);
        }

        dequeue() {
            return this.elements.shift()?.element;
        }

        isEmpty() {
            return this.elements.length === 0;
        }
    }

    async function generateMaze() {
        const input_x = parseInt(document.getElementById('x-input').value);
        const input_y = parseInt(document.getElementById('y-input').value);
        const input_w = parseFloat(document.getElementById('w-input').value);

        if (input_x && input_y && input_w) {
            generatedMaze = await generateRandomMaze(input_y, input_x, input_w);
            startNode = generatedMaze.startNode;
            endNode = generatedMaze.endNode;
            maze = generatedMaze.maze;
            renderMaze(maze, mazeContainer);

        } else {
            generatedMaze = await generateRandomMaze(15, 25, 0.25);
            startNode = generatedMaze.startNode;
            endNode = generatedMaze.endNode;
            maze = generatedMaze.maze;
            renderMaze(maze, mazeContainer);
        }
    }

    // Function to start the game
    async function startGame() {
        const selectedAlgorithm = algorithmSelector.value;
        
        if (generatedMaze != undefined) {
            renderMaze(maze, mazeContainer);
        } else {
            // Generate and render the maze first
            generateMaze();
        }

        // Allow some time for the maze to be displayed before starting the algorithm
        await sleep(1000);

        switch (selectedAlgorithm) {
            case 'dfs':
                dfsAlgorithm();
                break;
            case 'bfs':
                bfsAlgorithm();
                break;
            case 'a-star':
                aStarAlgorithm();
                break;
            case 'dijkstra':
                dijkstraAlgorithm();
                break;
            case 'ucs':
                ucsAlgorithm();
                break;
            case 'bidirectional':
                bidirectionalAlgorithm();
                break;
            default:
                alert('Invalid algorithm selected.');
                break;
        }
    }
    generateMazeButton.addEventListener('click', generateMaze);
    startButton.addEventListener('click', startGame);
});