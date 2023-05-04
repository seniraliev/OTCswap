# OTC Swap test project

## Requirement
```
Write a smart contract for conducting atomic over-the-counter (OTC) swaps of ERC20 tokens.
Specifically, the contract you write should support the use case where Alice and Bob agree to an
exchange – Alice will trade her M of tokenX for Bob’s N of tokenY, to be completed in a single
“atomic” transaction.
Additionally:
● Swaps should be able to specify a counterparty – if Alice and Bob agree to a swap, Eve
(a third party) should not be able to replace either Alice or Bob in the swap, unless they
have explicitly agreed to make the same swap with Eve
● Swaps should expire, i.e. they should only be executable within a specified timeframe
Provide a brief explanation of some of the decisions you made in the process.
```

## Decision

 * Creates swap between Alice and Bob with token addresses and token amounts.
 * If Alice approves swap, deposit token to swap contract.
 * If Bob approves swap, also deposit token to swap contract.
 * After Alice and Bob deposit token, then swap token with one transaction.
 * If either hasn’t deposited token within timeframe, then cancel swap and return tokens to operator.
## Functions

### **create**

Creates new swap
- input: swap params
```
const createParam = {
  operator1: alice.address,
  operator2: bob.address,
  token1: token1.address,
  token2: token2.address,
  amount1: parseEther("1"),
  amount2: parseEther("2"),
  expireTime: expireTime,
};

const tx = await swapContract.create(createParam);
await tx.wait();
``` 

### **deposit**

Deposits token to swap(int this case operator approves swap)
- input: id of swap
```
// approve token before deposit
let tx = await token.approve(swapContract.address, parseEther("1"));
await tx.wait();

// call deposit function with swap id
tx = await swapContract.deposit(0);
await tx.wait()
```

### **finish**

Finishes swap after two operator deposited
- input: id of swap
```
// call finish function with swap id
tx = await swapContract.finish(0);
await tx.wait()
```

### **cancel**

Cancels swap after time expired
- input: id of swap
```
// call cancel function with swap id
tx = await swapContract.cancel(0);
await tx.wait()
```


## Test Script
**Used hardhat test**
```
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockERC20, OTCSwap, OTCSwap__factory } from "../types";
import { deployments } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import { parseEther } from "ethers/lib/utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let swap: OTCSwap;

let token1: MockERC20;
let token2: MockERC20;

let alice: SignerWithAddress;
let bob: SignerWithAddress;
let vault: SignerWithAddress;

const setup = deployments.createFixture(async (hre) => {
  ship = await Ship.init(hre);
  const { accounts, users } = ship;
  await deployments.fixture(["otc-swap"]);

  return {
    ship,
    accounts,
    users,
  };
});

enum State {
  Pending,
  Finished,
  Canceled,
}

describe("OTC Swap test", () => {
  before(async () => {
    const scaffold = await setup();

    alice = scaffold.accounts.alice;
    bob = scaffold.accounts.bob;
    vault = scaffold.accounts.vault;

    swap = await ship.connect(OTCSwap__factory);

    token1 = (await ship.connect("TestToken1")) as MockERC20;
    token2 = (await ship.connect("TestToken2")) as MockERC20;

    await token1.connect(alice).mint(parseEther("10"));
    await token1.connect(alice).approve(swap.address, parseEther("10"));
    await token2.connect(bob).mint(parseEther("10"));
    await token2.connect(bob).approve(swap.address, parseEther("10"));
  });

  it("Create new swap between Alice and Bob", async () => {
    const currentTime = (await ship.provider.getBlock("latest")).timestamp;

    const createParam: OTCSwap.SwapStruct = {
      operator1: alice.address,
      operator2: bob.address,
      token1: token1.address,
      token2: token2.address,
      amount1: parseEther("1"),
      amount2: parseEther("2"),
      expireTime: currentTime,
    };

    // expire time should be valid
    await expect(swap.create(createParam)).to.revertedWith("OTCSwap: Invalid expire time");

    await expect(swap.create({ ...createParam, expireTime: currentTime + 3600 }))
      .to.emit(swap, "SwapCreated")
      .withArgs(
        0,
        alice.address,
        bob.address,
        token1.address,
        parseEther("1"),
        token2.address,
        parseEther("2"),
      )
      .emit(swap, "SwapStateChanged")
      .withArgs(0, false, false, State.Pending);

    const swapData = await swap.swaps(0);
    const swapState = await swap.swapStates(0);

    expect(swapData.operator1).to.eq(alice.address);
    expect(swapData.operator2).to.eq(bob.address);
    expect(swapData.token1).to.eq(token1.address);
    expect(swapData.token2).to.eq(token2.address);
    expect(swapData.amount1).to.eq(parseEther("1"));
    expect(swapData.amount2).to.eq(parseEther("2"));

    expect(swapState.operator1Deposited).to.eq(false);
    expect(swapState.operator2Deposited).to.eq(false);
    expect(swapState.state).to.eq(State.Pending);

    /// create new swap for cancel test
    await swap.create({ ...createParam, expireTime: currentTime + 3600 });
  });

  it("Alice and Bob can deposit token for swap", async () => {
    /// vault can't deposit token
    await expect(swap.connect(vault).deposit(0)).to.revertedWith(
      "OTCSwap: You are not operator of this swap",
    );

    await expect(swap.connect(alice).deposit(0))
      .emit(token1, "Transfer")
      .withArgs(alice.address, swap.address, parseEther("1"))
      .to.emit(swap, "SwapStateChanged")
      .withArgs(0, true, false, State.Pending);
    await expect(swap.connect(bob).deposit(0))
      .emit(token2, "Transfer")
      .withArgs(bob.address, swap.address, parseEther("2"))
      .to.emit(swap, "SwapStateChanged")
      .withArgs(0, true, true, State.Pending);

    // can't deposit again
    await expect(swap.connect(alice).deposit(0)).to.revertedWith("OTCSwap: You already deposited token");

    const swapState = await swap.swapStates(0);
    expect(swapState.operator1Deposited).to.eq(true);
    expect(swapState.operator2Deposited).to.eq(true);
    expect(swapState.state).to.eq(State.Pending);
  });

  it("Can't cancel swap after deposited", async () => {
    await expect(swap.cancel(0)).to.revertedWith("OTCSwap: Can't cancel this swap");
  });

  it("Finish swap", async () => {
    // anyone can call this function
    await expect(swap.finish(0))
      .emit(token1, "Transfer")
      .withArgs(swap.address, bob.address, parseEther("1"))
      .emit(token2, "Transfer")
      .withArgs(swap.address, alice.address, parseEther("2"))
      .to.emit(swap, "SwapStateChanged")
      .withArgs(0, true, true, State.Finished);

    const swapState = await swap.swapStates(0);
    expect(swapState.operator1Deposited).to.eq(true);
    expect(swapState.operator2Deposited).to.eq(true);
    expect(swapState.state).to.eq(State.Finished);
  });

  it("Can't cancel swap before expire time", async () => {
    await expect(swap.cancel(1)).to.revertedWith("OTCSwap: swap isn't expired yet");
  });

  it("Can't deposit token after expired", async () => {
    await expect(swap.connect(alice).deposit(1))
      .emit(token1, "Transfer")
      .withArgs(alice.address, swap.address, parseEther("1"))
      .to.emit(swap, "SwapStateChanged")
      .withArgs(1, true, false, State.Pending);

    // advance time after expired time
    await time.increase(3600);

    await expect(swap.connect(bob).deposit(1)).to.revertedWith("OTCSwap: This swap already expired");
  });

  it("Can't finish swap if someone didn't deposit in expire time", async () => {
    await expect(swap.finish(1)).to.revertedWith("OTCSwap: Operators didn't deposit token yet");
  });

  it("Everyone can cancel swap after expire time", async () => {
    await expect(swap.cancel(1))
      .emit(swap, "SwapStateChanged")
      .withArgs(1, true, false, State.Canceled)
      .to.emit(token1, "Transfer")
      .withArgs(swap.address, alice.address, parseEther("1"));

    const swapState = await swap.swapStates(1);
    expect(swapState.operator1Deposited).to.eq(true);
    expect(swapState.operator2Deposited).to.eq(false);
    expect(swapState.state).to.eq(State.Canceled);
  });
});

```

**How to run test**

***Install dependencies***

`yarn install`

***Run test script***

`yarn test`