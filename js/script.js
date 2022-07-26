'use strict';

// Play space

const playSpace = document.querySelector('.play-space');
const mainArea = document.querySelector('.main-area');

let maxPlaySpaceWidth = 0.9 * mainArea.clientWidth;
let maxPlaySpaceHeight = 0.6 * mainArea.clientHeight;

let maxPlaySpaceSide = Math.min(maxPlaySpaceWidth, maxPlaySpaceHeight);
let blockSide = Math.floor(maxPlaySpaceSide / 10);
let horizontalBlockNumber = Math.floor(maxPlaySpaceWidth / blockSide);
let verticalBlockNumber = Math.floor(maxPlaySpaceHeight / blockSide);

playSpace.style.width = `${horizontalBlockNumber * blockSide}px`;
playSpace.style.height = `${verticalBlockNumber * blockSide}px`;

// Screen places

const scoreSlot = document.getElementById('score');
const highScoreSlot = document.getElementById('high-score');
const livesSlot = document.getElementById('lives');
const levelSlot = document.getElementById('level');
const infoSlot = document.querySelector('.info');
const newButton = document.querySelector('.btn--new');

newButton.addEventListener('click', abortGame);

// Gameplay constants and variables

let stepTime;
const SNAKELENGTH = 7;
let maxSnakes;
let speedupTimer;
let t = 0;
let snakes = [];
let level;
let clickOnTail;
let holyTail;
let holyTailExists;
let gameRunning;
let currentZIndex;

// Game tallies

let scoreValue;
let highScoreValue = 0;
let livesValue;
let levelValue;
let abort;

// Classes

class Snake {
  constructor(
    initialPositionX,
    initialPositionY,
    spiritType,
    direction,
    zIndex
  ) {
    this.initialPositionX = initialPositionX;
    this.initialPositionY = initialPositionY;
    this.spiritType = spiritType;
    this.direction = direction;
    this.zIndex = zIndex;
    const headBlock = new Block(
      initialPositionX,
      initialPositionY,
      spiritType,
      'head',
      zIndex
    );
    this.blocks = [headBlock];
  }
}

class Block {
  constructor(gridX, gridY, spiritType, blockType, zIndex) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.spiritType = spiritType;
    this.blockType = blockType;
    let image = new Image(blockSide, blockSide);
    this.image = image;
    this.image.context = this;
    this.image.src = `images/${spiritType}${blockType}.jpg`;
    this.image.style.zIndex = zIndex;
    playSpace.appendChild(image);
    this.image.style.position = 'absolute';
    this.image.style.left = `${gridX * blockSide}px`;
    this.image.style.top = `${gridY * blockSide}px`;
  }
}

// Game start

newGame();

// Main time step loop

function timeStep() {
  if (abort === true) {
    newGame();
    return;
  }

  if (holyTailExists) {
    if (clickOnTail != 'clicked') {
      missedClick();
      postMessage('MISSED CLICK!', '#b20f1b', 'lime', 1);
    } else {
      postMessage('Good Click', '#35347a');
    }
  }

  if (livesValue == 0) {
    playerDead();
    return;
  }

  scoreValue++;
  scoreSlot.innerText = `${scoreValue * 10}`;

  if (speedupTimer === 0) {
    stepTime = stepTime * 0.75;
  }

  currentZIndex = levelValue * 3 + Math.floor(t / 2);

  moveSnakes();
  createSnakes(t);

  t++;
  if (!(speedupTimer === undefined)) speedupTimer--;
  clickOnTail = 'notYet';

  setTimeout(timeStep, stepTime);
}

// Snake creation

function createSnakes(t) {
  if (t == 0) {
    createHolySnake(t);
  } else if (t > 5 && Math.random() < 0.6 && snakes.length < maxSnakes) {
    createUnholySnake(t);
  }
}

function createHolySnake(t) {
  const x = randomInt(0, horizontalBlockNumber - 1);
  const y = randomInt(0, verticalBlockNumber - 1);
  const direction = randomDirection(x, y);
  const holySnake = new Snake(x, y, 'holy', direction, 20);
  snakes.push(holySnake);
}

function createUnholySnake(t) {
  const x = randomInt(0, horizontalBlockNumber - 1);
  const y = randomInt(0, verticalBlockNumber - 1);
  const direction = randomDirection(x, y);
  let brightness;
  if (Math.random() > 0.5) {
    brightness = 'light';
  } else {
    brightness = 'dark';
  }
  const unholySnake = new Snake(
    x,
    y,
    `unholy${brightness}`,
    direction,
    currentZIndex
  );
  snakes.push(unholySnake);
}

// Snake movement

function moveSnakes() {
  snakes.forEach(moveSnake);
}

function moveSnake(snake) {
  //start at tail (remember snake blocks are numbered from zero)
  if (
    snake.blocks.length == SNAKELENGTH - 1 ||
    snake.blocks.length == SNAKELENGTH
  ) {
    //determine new direction of tail
    let tailDirection;
    let penultimateBlock = snake.blocks[SNAKELENGTH - 3];
    let ultimateBlock = snake.blocks[SNAKELENGTH - 2];
    if (ultimateBlock.gridX - penultimateBlock.gridX == 1) {
      tailDirection = 'left';
    } else if (ultimateBlock.gridX - penultimateBlock.gridX == -1) {
      tailDirection = 'right';
    } else if (ultimateBlock.gridY - penultimateBlock.gridY == 1) {
      tailDirection = 'up';
    } else if (ultimateBlock.gridY - penultimateBlock.gridY == -1) {
      tailDirection = 'down';
    }

    if (snake.blocks.length == SNAKELENGTH - 1) {
      //add tail if necessary
      const tailBlock = new Block(
        snake.blocks[SNAKELENGTH - 2].gridX,
        snake.blocks[SNAKELENGTH - 2].gridY,
        snake.spiritType,
        `tail${tailDirection}`,
        snake.blocks[SNAKELENGTH - 2].image.style.zIndex
      );
      tailBlock.image.addEventListener('click', clickProcessor);

      //record holy tail block in global variable and initiate 'holy tail exists' behaviour
      if (snake.spiritType == 'holy') {
        holyTail = tailBlock;
        holyTailExists = true;
        speedupTimer = 20;
        clearMessage();
      }
      snake.blocks.push(tailBlock);
    } else if (snake.blocks.length == SNAKELENGTH) {
      //rotate tail if already there
      snake.blocks[
        SNAKELENGTH - 1
      ].image.src = `images/${snake.spiritType}tail${tailDirection}.jpg`;
    }
  } else if (snake.blocks.length < SNAKELENGTH - 1) {
    //add body block if not at tail of (incomplete) snake
    const bodyBlock = new Block(
      snake.blocks[snake.blocks.length - 1].gridX,
      snake.blocks[snake.blocks.length - 1].gridY,
      snake.spiritType,
      `body`,
      snake.blocks[snake.blocks.length - 1].image.style.zIndex
    );
    bodyBlock.image.addEventListener('click', clickProcessor);
    snake.blocks.push(bodyBlock);
  }

  //move all blocks (except head), starting from tail end
  for (let i = snake.blocks.length - 1; i > 0; i--) {
    if (snake.spiritType === 'holy' && i === 1) {
      snake.blocks[i].image.style.zIndex = Number(snake.zIndex) - 1;
    } else {
      snake.blocks[i].image.style.zIndex =
        Number(snake.blocks[i - 1].image.style.zIndex) - 1;
    }
    snake.blocks[i].gridX = snake.blocks[i - 1].gridX;
    snake.blocks[i].gridY = snake.blocks[i - 1].gridY;
    snake.blocks[i].image.style.left = `${snake.blocks[i].gridX * blockSide}px`;
    snake.blocks[i].image.style.top = `${snake.blocks[i].gridY * blockSide}px`;
  }

  //move snake head according to previously determined direction
  switch (snake.direction) {
    case 'left':
      snake.blocks[0].gridX = snake.blocks[0].gridX - 1;
      break;
    case 'down':
      snake.blocks[0].gridY = snake.blocks[0].gridY + 1;
      break;
    case 'right':
      snake.blocks[0].gridX = snake.blocks[0].gridX + 1;
      break;
    case 'up':
      snake.blocks[0].gridY = snake.blocks[0].gridY - 1;
      break;
  }
  snake.blocks[0].image.style.left = `${snake.blocks[0].gridX * blockSide}px`;
  snake.blocks[0].image.style.top = `${snake.blocks[0].gridY * blockSide}px`;

  //holy head must always be visible so raise zIndex as necessary
  if (snake.spiritType === 'holy') {
    snake.blocks[0].image.style.zIndex = Math.max(20, currentZIndex + 5);
  }

  //select new direction for snake head
  let forbiddenDirection;
  let headBlock = snake.blocks[0];
  let neckBlock = snake.blocks[1];

  if (headBlock.gridX - neckBlock.gridX == 1) {
    forbiddenDirection = 'left';
  } else if (headBlock.gridX - neckBlock.gridX == -1) {
    forbiddenDirection = 'right';
  } else if (headBlock.gridY - neckBlock.gridY == 1) {
    forbiddenDirection = 'up';
  } else if (headBlock.gridY - neckBlock.gridY == -1) {
    forbiddenDirection = 'down';
  }

  snake.direction = randomDirection(
    snake.blocks[0].gridX,
    snake.blocks[0].gridY,
    forbiddenDirection
  );
}

// Initialise and reset functions

function abortGame() {
  if (gameRunning) abort = true;
  else newGame();
}

function newGame() {
  gameRunning = true;
  resetAbort();
  resetLives();
  resetLevel();
  resetScore();
  postMessage(
    'Click holy snake tail dart whenever it moves (even if hidden).',
    '#35347a',
    'lime'
  );
  newLevel();
}

function resetAbort() {
  abort = false;
}

function newLevel() {
  removeSnakes();
  resetLives();
  t = 0;
  stepTime = 1500 * Math.pow(0.9, levelValue);
  speedupTimer = undefined;
  snakes = [];
  clickOnTail = 'notYet';
  holyTail = undefined;
  holyTailExists = false;
  maxSnakes = levelValue * 8 - 7;
  timeStep();
}

function removeSnakes() {
  snakes.forEach(removeSnake);
}

function removeSnake(snake) {
  snake.blocks.forEach(removeBlock);
}

function removeBlock(block) {
  block.image.style.display = 'none';
}

function resetLives() {
  livesValue = 10;
  livesSlot.innerText = `${livesValue}`;
}

function resetScore() {
  scoreValue = 0;
  scoreSlot.innerText = `$${scoreValue}`;
}

function resetLevel() {
  levelValue = 1;
  levelSlot.innerText = `${levelValue}`;
}

function gameOver() {
  removeSnakes();
  postMessage('GAME OVER', 'gold', '#3b3992', '1');
  gameRunning = false;
  highScoreValue = Math.max(scoreValue, highScoreValue);
  highScoreSlot.innerText = `${highScoreValue * 10}`;
}

function playerDead() {
  if (levelValue === 5) gameOver();
  else {
    levelValue++;
    levelSlot.innerText = levelValue;
    postMessage('NEXT LEVEL', '#35347A', 'lime');
    newLevel();
  }
}

// Click processing

function missedClick() {
  livesValue = livesValue - 1;
  livesSlot.innerText = livesValue;
}

function clickProcessor(event) {
  const block = event.target;
  let correctHit;
  if (!holyTailExists) return;
  if (
    event.target.context.gridX == holyTail.gridX &&
    event.target.context.gridY == holyTail.gridY
  ) {
    correctHit = true;
  } else correctHit = false;
  switch (clickOnTail) {
    case 'alreadyMissed':
      return;
    case 'clicked':
      if (correctHit == true) {
        return;
      } else {
        clickOnTail = 'alreadyMissed';
        return;
      }
    case 'notYet':
      if (correctHit == true) {
        clickOnTail = 'clicked';
      } else {
        clickOnTail == 'alreadyMissed';
        return;
      }
  }
}

// Helper functions

function clearMessage() {
  infoSlot.style.opacity = 0;
}

function postMessage(message, color, backgroundColor, opacity) {
  if (opacity === undefined) {
    infoSlot.style.opacity = 0.65;
  } else {
    infoSlot.style.opacity = opacity;
  }
  infoSlot.style.color = color;
  infoSlot.style.backgroundColor = backgroundColor;
  infoSlot.innerHTML = message;
}

function randomDirection(x, y, extraDirection) {
  let directions = new Set(['left', 'right', 'up', 'down']);
  switch (x) {
    case 0:
      directions.delete('left');
      break;
    case horizontalBlockNumber - 1:
      directions.delete('right');
      break;
  }
  switch (y) {
    case 0:
      directions.delete('up');
      break;
    case verticalBlockNumber - 1:
      directions.delete('down');
      break;
  }
  if (extraDirection != 'undefined') {
    directions.delete(extraDirection);
  }
  const directionArray = Array.from(directions);
  const directionNumber = randomInt(0, directionArray.length - 1);
  return directionArray[directionNumber];
}

function randomInt(a, b) {
  return a + Math.floor(Math.random() * (b + 1 - a));
}
