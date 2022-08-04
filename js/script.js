'use strict';

// Play space

const playSpace = document.querySelector('.play-space');
const mainArea = document.querySelector('.main-area');

let maxPlaySpaceWidth = 0.9 * mainArea.clientWidth;
let maxPlaySpaceHeight = 0.6 * mainArea.clientHeight;

let maxPlaySpaceSide = Math.min(maxPlaySpaceWidth, maxPlaySpaceHeight);
let blockSide = Math.floor(maxPlaySpaceSide / 8);
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

// Image assets

let explosion = [];
explosion[0] = new Image(blockSide * 2, blockSide * 2);
explosion[1] = new Image(blockSide * 2, blockSide * 2);
explosion[2] = new Image(blockSide * 2, blockSide * 2);
explosion[0].src = `images/explosion0.png`;
explosion[1].src = `images/explosion1.png`;
explosion[2].src = `images/explosion2.png`;
for (let i = 0; i < 3; i++) {
  explosion[i].style.visibility = 'hidden';
  explosion[i].style.position = 'absolute';
}

newButton.addEventListener('mousedown', newGame);

// Audio assets

const angelKilled = new Audio('sound/angelkilled.wav');
const demonKilled = new Audio('sound/demonkilled.wav');
const angelSacrifice = new Audio('sound/angelsacrifice.wav');
const demonSacrifice = new Audio('sound/demonsacrifice.wav');
const moveClick = new Audio('sound/moveclick.wav');
const shortExplosion = new Audio('sound/shortexplosion.wav');
const tailClicked = new Audio('sound/tailclicked.wav');
const tailMissed = new Audio('sound/tailmissed.wav');

// Gameplay constants and variables

let stepTime;
const SNAKELENGTH = 7;
const MINDISTTOKAMI = 200;
let maxSnakes;
let speedupTimer;
let t = 0;
let snakes = [];
let kamikazes = [];
let level;
let clickOnTail;
let holyTail;
let holyTailExists;
let checkClick;
let gameRunning = false;
let currentZIndex;
let playerAvatar;

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

class Avatar {
  constructor(gridX, gridY) {
    this.gridX = gridX;
    this.gridY = gridY;
    let image = new Image(blockSide / 2, blockSide / 2);
    this.image = image;
    this.image.context = this;
    this.image.src = `images/holyhead.jpg`;
    this.image.style.zIndex = Math.max(40, currentZIndex + 15);
    playSpace.appendChild(image);
    this.image.style.position = 'absolute';
    this.image.style.left = `${gridX * blockSide + blockSide / 4}px`;
    this.image.style.top = `${gridY * blockSide + blockSide / 4}px`;
  }
}

class Kamikaze {
  constructor(gridX, gridY, type) {
    this.gridX = gridX;
    this.gridY = gridY;
    let image = new Image(blockSide * 2, blockSide * 2);
    this.image = image;
    this.image.context = this;
    this.image.src = `images/kamikaze${type}.png`;
    this.image.style.zIndex = Math.max(30, currentZIndex + 10);
    playSpace.appendChild(image);
    this.image.style.position = 'absolute';
    this.image.style.left = `${gridX * blockSide}px`;
    this.image.style.top = `${gridY * blockSide}px`;
    this.type = type;
    this.exploding = false;
    this.explosion = undefined;
    this.clicked = false;
    this.distanceToTail = undefined;
    this.state = 'alive';
    this.image.style.opacity = 1;
  }
}

// Game start

//newGame();

//Kamikaze loop

function kamikazeLoop() {
  if (abort === true) {
    return;
  }
  checkKamikazes();
  moveKamikazes();
  setTimeout(kamikazeLoop, 50);
}

// Main time step loop

function timeStep() {
  if (abort === true) {
    resetAbort();
    endLevel();
    startGame();
    return;
  }

  if (t > 1) {
    if (clickOnTail != 'clicked') {
      missedClick();
      postMessage('MISSED CLICK!', '#b20f1b', 'lime', 1);
    } else {
      postMessage('Good click', '#35347a');
      scoreValue++;
      scoreSlot.innerText = `${scoreValue * 10}`;
    }
  }

  if (livesValue == 0) {
    playerDead();
    return;
  }

  if (speedupTimer === 0) {
    stepTime = stepTime * 0.75;
    speedupTimer = 15;
  }

  currentZIndex = levelValue * 3 + Math.floor(t / 2);

  moveSnakes();
  createSnakes(t);
  createKamikazes(t);
  moveClick.play();
  t++;
  if (!(speedupTimer === undefined)) speedupTimer--;
  clickOnTail = 'notYet';

  if (holyTailExists === false) {
    setTimeout(timeStep, 0);
  } else {
    setTimeout(timeStep, stepTime);
  }
}

// Object creation

function createKamikazes(t) {
  if (t > 4 && levelValue > 2) {
    let rNum = Math.random();
    if (rNum < 0.2) {
      createKamikazeDevil();
    } else if (rNum > 0.8 && levelValue > 3) {
      createKamikazeAngel();
    }
  }
}

function createKamikazeDevil() {
  const x = randomInt(0, horizontalBlockNumber - 2);
  const y = randomInt(0, verticalBlockNumber - 2);
  const kamikazeDevil = new Kamikaze(x, y, 'devil');
  kamikazeDevil.image.addEventListener('mousedown', killKamikaze);
  kamikazes.push(kamikazeDevil);
}

function createKamikazeAngel() {
  const x = randomInt(0, horizontalBlockNumber - 1);
  const y = randomInt(0, verticalBlockNumber - 1);
  const kamikazeAngel = new Kamikaze(x, y, 'angel');
  kamikazeAngel.image.addEventListener('mousedown', killKamikaze);
  kamikazes.push(kamikazeAngel);
}

function createAvatar(gridX, gridY) {
  playerAvatar = new Avatar(gridX, gridY);
}

function createSnakes(t) {
  if (t == 0) {
    createHolySnake();
  } else if (t > 2 && Math.random() < 0.6 && snakes.length < maxSnakes) {
    createUnholySnake(t);
  }
}

/*
function createHolySnake(t) {
  const x = randomInt(0, horizontalBlockNumber - 1);
  const y = randomInt(0, verticalBlockNumber - 1);
  const direction = randomDirection(x, y);
  const holySnake = new Snake(x, y, 'holy', direction, 20);
  snakes.push(holySnake);
}
*/

function createHolySnake() {
  let holySnake = new Snake(1, 3, 'holy', 'left', 20);
  for (let i = 1; i < SNAKELENGTH - 1; i++) {
    const newBodyBlock = new Block(i + 1, 3, 'holy', 'body', 20 - i);
    newBodyBlock.image.addEventListener('mousedown', clickTailProcessor);
    holySnake.blocks.push(newBodyBlock);
  }
  const tailBlock = new Block(
    1 + SNAKELENGTH - 1,
    3,
    'holy',
    'tailleft',
    21 - SNAKELENGTH
  );
  tailBlock.image.addEventListener('mousedown', clickTailProcessor);
  holyTail = tailBlock;
  holyTailExists = true;
  speedupTimer = 15;
  holySnake.blocks.push(tailBlock);
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
      tailBlock.image.addEventListener('mousedown', clickTailProcessor);

      //record holy tail block in global variable and initiate 'holy tail exists' behaviour
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
    bodyBlock.image.addEventListener('mousedown', clickTailProcessor);
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

//kamikaze action

function checkKamikazes() {
  kamikazes.forEach(checkKamikaze);
}

function checkKamikaze(kamikaze) {
  if (kamikaze.distanceToTail < blockSide && kamikaze.state === 'alive') {
    kamikaze.state = 'dead';
    sacrificeKamikaze(kamikaze);
  }
}

function sacrificeKamikaze(kamikaze) {
  //const delay = Math.random() * 1000;
  if (kamikaze.type === 'angel') {
    scoreValue = scoreValue + 5;
    scoreSlot.innerText = `${scoreValue * 10}`;
    const currentAngelSacrifice = angelSacrifice.cloneNode();
    currentAngelSacrifice.play();
    fadeRecursive(kamikaze);
    const removeAndSpliceOutKamikazeBound = removeAndSpliceOutKamikaze.bind(
      null,
      kamikaze
    );
    setTimeout(removeAndSpliceOutKamikazeBound, 3000);
  } else {
    scoreValue = scoreValue - 5;
    scoreSlot.innerText = `${scoreValue * 10}`;
    const currentDemonSacrifice = demonSacrifice.cloneNode();
    currentDemonSacrifice.play();
    explodeKamikaze(kamikaze);
  }
}

function explodeKamikaze(kamikaze) {
  kamikaze.exploding = true;
  kamikaze.explosion = [];
  for (let i = 0; i < 3; i++) {
    kamikaze.explosion[i] = explosion[i].cloneNode();
    kamikaze.explosion[i].style.visibility = 'hidden';
    kamikaze.explosion[i].style.zIndex = kamikaze.image.style.zIndex + i + 1;
    playSpace.appendChild(kamikaze.explosion[i]);
  }

  const currentShortExplosion = shortExplosion.cloneNode();
  currentShortExplosion.play();

  function show0() {
    kamikaze.explosion[0].style.opacity = 0.7;
    kamikaze.explosion[0].style.visibility = 'visible';
    setTimeout(hide0, 1000);
  }

  function hide0() {
    kamikaze.explosion[0].style.visibility = 'hidden';
  }

  function show1() {
    kamikaze.explosion[1].style.opacity = 0.7;
    kamikaze.explosion[1].style.visibility = 'visible';
    setTimeout(hide1, 1000);
  }

  function hide1() {
    kamikaze.explosion[1].style.visibility = 'hidden';
  }

  function show2() {
    kamikaze.explosion[2].style.opacity = 0.7;
    kamikaze.explosion[2].style.visibility = 'visible';
    setTimeout(hide2, 1000);
  }

  function hide2() {
    kamikaze.explosion[2].style.visibility = 'hidden';
    removeAndSpliceOutKamikaze(kamikaze);
  }
  const fadeRecursiveBound = fadeRecursive.bind(null, kamikaze);
  setTimeout(fadeRecursiveBound, 1000);
  setTimeout(show0, 500);
  setTimeout(show1, 1000);
  setTimeout(show2, 1500);
}

function fadeRecursive(kamikaze) {
  if (kamikaze.image.style.opacity <= 0) {
    kamikaze.image.style.visibility = 'hidden';
  } else {
    kamikaze.image.style.opacity = kamikaze.image.style.opacity - 0.01;
    const fadeRecursiveBound = fadeRecursive.bind(null, kamikaze);
    setTimeout(fadeRecursiveBound, 10);
  }
}

function moveKamikazes() {
  kamikazes.forEach(moveKamikaze);
}

function moveKamikaze(kamikaze) {
  const kkCentreX =
    Number(
      kamikaze.image.style.left.slice(0, kamikaze.image.style.left.length - 2)
    ) + blockSide;
  const kkCentreY =
    Number(
      kamikaze.image.style.top.slice(0, kamikaze.image.style.top.length - 2)
    ) + blockSide;
  const holyTailCentreX =
    Number(
      holyTail.image.style.left.slice(0, holyTail.image.style.left.length - 2)
    ) +
    blockSide / 2;
  const holyTailCentreY =
    Number(
      holyTail.image.style.top.slice(0, holyTail.image.style.top.length - 2)
    ) +
    blockSide / 2;
  let xDiff = holyTailCentreX - kkCentreX;
  let yDiff = holyTailCentreY - kkCentreY;
  let xMovement;
  let yMovement;
  if (Math.abs(xDiff) < 1) {
    xMovement = 0;
  } else {
    xMovement =
      Math.sign(xDiff) * Math.max(1, Math.floor(Math.abs(xDiff) * 0.001));
  }
  kamikaze.image.style.left = `${xMovement + kkCentreX - blockSide}px`;
  if (Math.abs(yDiff) < 1) {
    yMovement = 0;
  } else {
    yMovement =
      Math.sign(yDiff) * Math.max(1, Math.floor(Math.abs(yDiff) * 0.001));
  }

  xDiff = holyTailCentreX - kkCentreX;
  yDiff = holyTailCentreY - kkCentreY;
  kamikaze.image.style.top = `${yMovement + kkCentreY - blockSide}px`;
  kamikaze.distanceToTail = Math.sqrt(xDiff ** 2 + yDiff ** 2);

  if (kamikaze.exploding) {
    for (let i = 0; i < 3; i++) {
      kamikaze.explosion[i].style.left = kamikaze.image.style.left;
      kamikaze.explosion[i].style.top = kamikaze.image.style.top;
    }
  }
}

// Click processing

function killKamikaze(event) {
  event.stopPropagation();
  const kamikaze = event.target.context;
  const gridX = Math.floor(event.offsetX / blockSide);
  const gridY = Math.floor(event.offsetY / blockSide);
  createMoveAvatar(gridX, gridY);
  if (kamikaze.state === 'alive') {
    kamikaze.state = 'dead';
    if (kamikaze.type === 'angel') {
      scoreValue = scoreValue - 5;
      scoreSlot.innerText = `${scoreValue * 10}`;
      const currentAngelKilled = angelKilled.cloneNode();
      currentAngelKilled.play();
    } else {
      scoreValue = scoreValue + 5;
      scoreSlot.innerText = `${scoreValue * 10}`;
      const currentDemonKilled = demonKilled.cloneNode();
      currentDemonKilled.play();
    }
    explodeKamikaze(kamikaze);
  }
}

function missedClick() {
  livesValue = livesValue - 1;
  livesSlot.innerText = livesValue;
}

function createMoveAvatar(gridX, gridY) {
  if (playerAvatar === undefined) {
    createAvatar(gridX, gridY);
  } else {
    playerAvatar.gridX = gridX;
    playerAvatar.gridY = gridY;
    playerAvatar.image.style.left = `${gridX * blockSide + blockSide / 4}px`;
    playerAvatar.image.style.top = `${gridY * blockSide + blockSide / 4}px`;
  }
}

function clickTailProcessor(event) {
  event.stopPropagation();
  let gridX;
  let gridY;

  if (event.target === playSpace) {
    gridX = Math.floor(event.offsetX / blockSide);
    gridY = Math.floor(event.offsetY / blockSide);
  } else {
    gridX = event.target.context.gridX;
    gridY = event.target.context.gridY;
  }

  createMoveAvatar(gridX, gridY);

  let correctHit;
  if (!holyTailExists) return;
  if (gridX == holyTail.gridX && gridY == holyTail.gridY) {
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
        const currentTailClicked = tailClicked.cloneNode();
        currentTailClicked.play();
        clickOnTail = 'clicked';
      } else {
        const currentTailMissed = tailMissed.cloneNode();
        currentTailMissed.play();
        clickOnTail = 'alreadyMissed';
        return;
      }
  }
}

// Initialise and reset functions

function newGame() {
  console.log('New game');
  if (gameRunning) abort = true;
  else startGame();
}

function startGame() {
  console.log('Game starting');
  gameRunning = true;
  resetScore();
  resetLevel();
  startLevel();
}

function resetAbort() {
  abort = false;
}

function startLevel() {
  playSpace.addEventListener('mousedown', clickTailProcessor);
  levelSlot.innerText = levelValue;
  resetLives();
  clearMessage();
  t = 0;
  stepTime = 2500 * Math.pow(0.9, levelValue);
  clickOnTail = 'notYet';
  holyTail = undefined;
  playerAvatar = undefined;
  holyTailExists = false;
  checkClick = false;
  maxSnakes = levelValue * 6 - 5;
  switch (levelValue) {
    case 1: {
      postMessage('Click tail dart whenever it moves', '#35347a', 'lime');
      setTimeout(timeStep, 2000);
      setTimeout(kamikazeLoop, 5000);
      break;
    }
    case 3: {
      postMessage(
        `Click Hell's angels early to protect dart...`,
        '#35347a',
        'lime'
      );
      setTimeout(timeStep, 2000);
      setTimeout(kamikazeLoop, 5000);
      break;
    }
    case 4: {
      postMessage(`...but don't kill the good angels!`, '#35347a', 'lime');
      setTimeout(timeStep, 2000);
      setTimeout(kamikazeLoop, 5000);
      break;
    }
    default: {
      timeStep();
      kamikazeLoop();
    }
  }
}

function removeSnakes() {
  snakes.forEach(removeSnake);
  snakes = [];
}

function removeSnake(snake) {
  snake.blocks.forEach(removeBlock);
}

function removeKamikazes() {
  kamikazes.forEach(removeKamikaze);
  kamikazes = [];
}

function removeKamikaze(kamikaze) {
  kamikaze.image.style.display = 'none';
}

function removeAndSpliceOutKamikaze(kamikaze) {
  removeKamikaze(kamikaze);
  spliceOutDeadKamikaze();
}

function spliceOutDeadKamikaze() {
  let index = -1;
  for (let i = 0; i < kamikazes.length; i++) {
    if (kamikazes[i].state === 'dead') {
      index = i;
      break;
    }
  }
  if (index > -1) kamikazes.splice(index, 1);
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
  scoreSlot.innerText = `${scoreValue}`;
}

function resetLevel() {
  levelValue = 1;
  levelSlot.innerText = `${levelValue}`;
}

function gameOver() {
  postMessage('GAME OVER', 'gold', '#3b3992', '1');
  gameRunning = false;
  highScoreValue = Math.max(scoreValue, highScoreValue);
  highScoreSlot.innerText = `${highScoreValue * 10}`;
}

function removeAvatar() {
  if (!(playerAvatar === undefined)) {
    playerAvatar.image.style.display = 'none';
  }
}

function endLevel() {
  clearMessage();
  removeAvatar();
  removeSnakes();
  removeKamikazes();
  playSpace.removeEventListener('mousedown', clickTailProcessor);
}

function newLevel() {
  levelValue++;
  postMessage('NEXT LEVEL', '#35347A', 'lime');
  setTimeout(startLevel, 1000);
}

function playerDead() {
  endLevel();
  if (levelValue === 5) gameOver();
  else {
    setTimeout(newLevel, 2000);
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
