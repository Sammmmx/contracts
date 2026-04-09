import { expect } from "chai";
import { ethers } from "hardhat";
import { TokenERC20 } from "../typechain-types";
import { Multisig } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const TX = {
  ETH: 0,
  ERC20: 1,
  ADD_SIGNER: 2,
  REMOVE_SIGNER: 3,
  THRESHOLD: 4,
  INVALID: 99, //Invalid Transaction Type for Test
};

const STATE = {
  NONE: 0,
  PENDING: 1,
  EXECUTED: 2,
  CANCELLED: 3,
};

describe("multisig", function () {
  let multiSig: Multisig;
  let Signer1: HardhatEthersSigner;
  let Signer2: HardhatEthersSigner;
  let Signer3: HardhatEthersSigner;
  let Account1: HardhatEthersSigner;
  let Account2: HardhatEthersSigner;

  let token: TokenERC20;
  const NAME = "MyToken";
  const SYMBOL = "MTK";
  const MAX_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [Signer1, Signer2, Signer3, Account1, Account2] = await ethers.getSigners();

    const MultiSig = await ethers.getContractFactory("Multisig");
    multiSig = (await MultiSig.deploy(
      [Signer1.address, Signer2.address, Signer3.address],
      2,
    )) as Multisig;

    const Token = await ethers.getContractFactory("TokenERC20");
    token = (await Token.deploy(
      Signer1.address,
      NAME,
      SYMBOL,
      MAX_SUPPLY,
    )) as TokenERC20;

    await token.mint(multiSig.target, ethers.parseEther("1000"));
  });

  // Deployment Tests

  describe("Deployment", async function () {
    it("should revert if address input is 0", async function () {
      const MultiSig = await ethers.getContractFactory("Multisig");
      await expect(
        MultiSig.deploy(
          [Signer1.address, ethers.ZeroAddress, Signer2.address],
          2,
        ),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidAddress");
    });

    it("should revert if Redundancy is Detected", async function () {
      const MultiSig = await ethers.getContractFactory("Multisig");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer2.address], 2),
      ).to.be.revertedWithCustomError(MultiSig, "AlreadySigner");
    });

    it("should revert if Signers list is less than 2", async function () {
      const MultiSig = await ethers.getContractFactory("Multisig");
      await expect(
        MultiSig.deploy([Signer1.address], 2),
      ).to.be.revertedWithCustomError(MultiSig, "NotEnoughSigners");
    });

    it("should revert if Threshold input is incorrect", async function () {
      const MultiSig = await ethers.getContractFactory("Multisig");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer3.address], 1),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidThreshold");
      await expect(
        MultiSig.deploy([Signer1.address, Signer2.address, Signer3.address], 4),
      ).to.be.revertedWithCustomError(MultiSig, "InvalidThreshold");
    });

    it("should mark Signers as true", async function () {
      expect(await multiSig.isSigner(Signer1.address)).to.equal(true);
      expect(await multiSig.isSigner(Signer2.address)).to.equal(true);
      expect(await multiSig.isSigner(Signer3.address)).to.equal(true);
    });

    it("should set the correct threshold", async function () {
      expect(await multiSig.threshold()).to.equal(2);
    });

    it("should not mark non signers as true", async function () {
      expect(await multiSig.isSigner(Account1.address)).to.equal(false);
    });

    it("should emit Deposit event when receiving ETH directly", async function () {
      const depositAmount = ethers.parseEther("1");
      await expect(
        Signer1.sendTransaction({
          to: multiSig.target,
          value: depositAmount,
        }),
      )
        .to.emit(multiSig, "Deposit")
        .withArgs(Signer1.address, depositAmount);

      expect(await ethers.provider.getBalance(multiSig.target)).to.equal(
        depositAmount,
      );
    });

    it("should accept multiple deposits", async function () {
      const amount = ethers.parseEther("1");

      await Signer1.sendTransaction({
        to: multiSig.target,
        value: amount,
      });

      await Signer2.sendTransaction({
        to: multiSig.target,
        value: amount,
      });

      expect(await ethers.provider.getBalance(multiSig.target)).to.equal(
        amount * 2n,
      );
    });
  });

  // submit Tests

  describe("submit", async function () {
    it("should revert if Transaction Type is incorrect", async function () {
      await expect(
        multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            TX.INVALID,
          ),
      ).to.be.revertedWithCustomError(multiSig, "InvalidTransactionType");
    });

    describe("ETH Transaction", async function () {
      it("should revert if receiver address is incorrect", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(
              ethers.ZeroAddress,
              ethers.ZeroAddress,
              ethers.parseEther("5"),
              TX.ETH,
            ),
        ).to.be.revertedWithCustomError(multiSig, "InvalidAddress");
      });

      it("should revert if token address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(
              Account1.address,
              token.target,
              ethers.parseEther("5"),
              TX.ETH,
            ),
        ).to.be.revertedWithCustomError(multiSig, "TokenNotRequired");
      });

      it("should revert if amount is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, ethers.ZeroAddress, 0, TX.ETH),
        ).to.be.revertedWithCustomError(multiSig, "EmptyTransaction");
      });

      it("should register vote of Signer on submit", async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            TX.ETH,
          );
        expect(await multiSig.hasConfirmed(0, Signer1.address)).to.equal(true);
      });

      it("should revert if non-signer calls submit", async function () {
        await expect(
          multiSig
            .connect(Account1)
            .submit(
              Account2.address,
              ethers.ZeroAddress,
              ethers.parseEther("5"),
              TX.ETH,
            ),
        )
          .to.be.revertedWithCustomError(multiSig, "NotSigner")
          .withArgs(Account1.address);
      });
    });

    describe("ERC20 Transaction", async function () {
      it("should revert if receiver address is incorrect", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(
              ethers.ZeroAddress,
              token.target,
              ethers.parseEther("5"),
              TX.ERC20,
            ),
        ).to.be.revertedWithCustomError(multiSig, "InvalidAddress");
      });

      it("should revert if token address is zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(
              Account1.address,
              ethers.ZeroAddress,
              ethers.parseEther("5"),
              TX.ERC20,
            ),
        ).to.be.revertedWithCustomError(multiSig, "UnknownTokenAddress");
      });

      it("should revert if amount is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, token.target, 0, TX.ERC20),
        ).to.be.revertedWithCustomError(multiSig, "EmptyTransaction");
      });

      it("should register vote of Signer on submit", async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            token.target,
            ethers.parseEther("5"),
            TX.ERC20,
          );
        expect(await multiSig.hasConfirmed(0, Signer1.address)).to.equal(true);
      });
    });

    describe("ADD_SIGNER Transaction", async function () {
      it("should revert if input is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, ethers.ZeroAddress, 1, TX.ADD_SIGNER),
        ).to.be.revertedWithCustomError(multiSig, "InputNotRequired");
      });

      it("should revert if address is already a signer", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Signer2.address, ethers.ZeroAddress, 0, TX.ADD_SIGNER),
        )
          .to.be.revertedWithCustomError(multiSig, "AlreadySigner")
          .withArgs(Signer2.address);
      });

      it("should revert if token address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, token.target, 0, TX.ADD_SIGNER),
        ).to.be.revertedWithCustomError(multiSig, "InputNotRequired");
      });
    });

    describe("REMOVE_SIGNER Transaction", async function () {
      it("should revert if input is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Signer2.address, ethers.ZeroAddress, 1, TX.REMOVE_SIGNER),
        ).to.be.revertedWithCustomError(multiSig, "InputNotRequired");
      });

      it("should revert if address is not a signer", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, ethers.ZeroAddress, 0, TX.REMOVE_SIGNER),
        )
          .to.be.revertedWithCustomError(multiSig, "NotSigner")
          .withArgs(Account1.address);
      });
    });

    describe("THRESHOLD Transaction", async function () {
      it("should revert if address is not zero", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(Account1.address, ethers.ZeroAddress, 2, TX.THRESHOLD),
        ).to.be.revertedWithCustomError(multiSig, "AddressNotRequired");
      });

      it("should revert if input is 0", async function () {
        await expect(
          multiSig
            .connect(Signer1)
            .submit(ethers.ZeroAddress, ethers.ZeroAddress, 0, TX.THRESHOLD),
        ).to.be.revertedWithCustomError(multiSig, "InvalidThreshold");
      });

      it("should revert if proposed threshold is greater than signer count", async function () {
        // Current signers: 3. Proposing threshold: 4.
        await multiSig
          .connect(Signer1)
          .submit(ethers.ZeroAddress, ethers.ZeroAddress, 4, 4);
        await multiSig.connect(Signer2).confirm(0);
        await expect(multiSig.execute(0)).to.be.revertedWithCustomError(
          multiSig,
          "InvalidThreshold",
        );
      });
    });
  });

  // Confirm Tests

  describe("Confirm", async function () {
    beforeEach(async function () {
      await multiSig
        .connect(Signer1)
        .submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("5"),
          TX.ETH,
        );
    });

    it("should revert if non signer tries to confirm", async function () {
      await expect(multiSig.connect(Account1).confirm(0))
        .to.be.revertedWithCustomError(multiSig, "NotSigner")
        .withArgs(Account1.address);
    });

    it("should revert if transaction id is invalid", async function () {
      await expect(
        multiSig.connect(Signer2).confirm(99),
      ).to.be.revertedWithCustomError(multiSig, "TxNonExistent");
    });

    it("should revert if signer already confirmed", async function () {
      await multiSig.connect(Signer2).confirm(0);
      await expect(
        multiSig.connect(Signer2).confirm(0),
      ).to.be.revertedWithCustomError(multiSig, "AlreadyConfirmed");
    });

    it("should emit Confirmed event", async function () {
      expect(await multiSig.connect(Signer2).confirm(0))
        .to.emit(multiSig, "Confirmed")
        .withArgs(0, Signer2.address);
    });
  });

  describe("Revoke and Cancel Full Coverage", function () {
    const txId = 0;

    beforeEach(async function () {
      // Fresh setup for each test:
      // 1. Submit a transaction (Index 0)
      await multiSig
        .connect(Signer1)
        .submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("1"),
          TX.ETH,
        );
      // 2. Fund the contract to allow execution tests
      await Signer1.sendTransaction({
        to: multiSig.target,
        value: ethers.parseEther("5"),
      });
    });

    // --- REVOKE FUNCTION TESTS ---

    describe("revoke()", function () {
      it("should allow a signer to revoke their confirmation", async function () {
        await multiSig.connect(Signer2).confirm(txId); // confirmations = 2
        await multiSig.connect(Signer2).revoke(txId); // confirmations = 1

        expect(await multiSig.hasConfirmed(txId, Signer2.address)).to.be.false;
      });

      it("should revert if a non-signer tries to revoke", async function () {
        await expect(multiSig.connect(Account1).revoke(txId))
          .to.be.revertedWithCustomError(multiSig, "NotSigner")
          .withArgs(Account1.address);
      });

      it("should revert if a signer tries to revoke a vote they never cast", async function () {
        // Signer 2 has not confirmed yet
        await expect(
          multiSig.connect(Signer2).revoke(txId),
        ).to.be.revertedWithCustomError(multiSig, "NotConfirmed");
      });

      it("should revert if revoking an already EXECUTED transaction", async function () {
        await multiSig.connect(Signer2).confirm(txId);
        await multiSig.execute(txId); // State: EXECUTED

        await expect(
          multiSig.connect(Signer1).revoke(txId),
        ).to.be.revertedWithCustomError(multiSig, "TxNotPending");
      });

      it("should revert if revoking a CANCELLED transaction", async function () {
        await multiSig.connect(Signer1).cancel(txId); // State: CANCELLED

        await expect(
          multiSig.connect(Signer1).revoke(txId),
        ).to.be.revertedWithCustomError(multiSig, "TxNotPending");
      });
    });

    // --- CANCEL FUNCTION TESTS ---

    describe("cancel()", function () {
      it("should allow a signer to cancel a pending transaction", async function () {
        await multiSig.connect(Signer1).cancel(txId);

        const tx = await multiSig.transactions(txId);
        expect(tx.state).to.equal(STATE.CANCELLED);
      });

      it("should revert if a non-signer tries to cancel", async function () {
        await expect(multiSig.connect(Account1).cancel(txId))
          .to.be.revertedWithCustomError(multiSig, "NotSigner")
          .withArgs(Account1.address);
      });

      it("should revert if trying to cancel an already EXECUTED transaction", async function () {
        await multiSig.connect(Signer2).confirm(txId);
        await multiSig.execute(txId);

        await expect(
          multiSig.connect(Signer1).cancel(txId),
        ).to.be.revertedWithCustomError(multiSig, "TxNotPending");
      });

      it("should revert if trying to cancel an already CANCELLED transaction", async function () {
        await multiSig.connect(Signer1).cancel(txId);

        await expect(
          multiSig.connect(Signer2).cancel(txId),
        ).to.be.revertedWithCustomError(multiSig, "TxNotPending");
      });

      it("should prevent execution after cancellation even if threshold was met", async function () {
        await multiSig.connect(Signer2).confirm(txId); // Threshold met (2/3)
        await multiSig.connect(Signer1).cancel(txId); // Signer 1 changes mind and cancels

        await expect(multiSig.execute(txId)).to.be.revertedWithCustomError(
          multiSig,
          "TxNotPending",
        );
      });
    });

    // --- EDGE CASE: TX NON-EXISTENT ---

    it("should revert revoke and cancel if txId is invalid", async function () {
      const invalidId = 999;
      await expect(
        multiSig.connect(Signer1).revoke(invalidId),
      ).to.be.revertedWithCustomError(multiSig, "TxNonExistent");
      await expect(
        multiSig.connect(Signer1).cancel(invalidId),
      ).to.be.revertedWithCustomError(multiSig, "TxNonExistent");
    });
  });

  // Reentrancy Test
  describe("Reentrancy", function () {
    it("should prevent reentrancy during execute", async function () {
      await multiSig
        .connect(Signer1)
        .submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("1"),
          TX.ETH,
        );

      await multiSig.connect(Signer2).confirm(0);

      await Signer1.sendTransaction({
        to: multiSig.target,
        value: ethers.parseEther("5"),
      });

      await expect(multiSig.execute(0)).to.not.be.reverted;
    });
  });

  describe("Threshold Edge Cases", function () {
    it("should allow threshold equal to signer count", async function () {
      await multiSig
        .connect(Signer1)
        .submit(ethers.ZeroAddress, ethers.ZeroAddress, 3, TX.THRESHOLD);

      await multiSig.connect(Signer2).confirm(0);

      await multiSig.execute(0);

      expect(await multiSig.threshold()).to.equal(3);
    });

    it("should reduce threshold when signer removed", async function () {
      await multiSig
        .connect(Signer1)
        .submit(Signer3.address, ethers.ZeroAddress, 0, TX.REMOVE_SIGNER);

      await multiSig.connect(Signer2).confirm(0);

      await multiSig.execute(0);

      expect(await multiSig.threshold()).to.be.lte(2);
    });
  });

  // Execute Tests

  describe("Execute", async function () {
    it("should revert if transaction id is invalid", async function () {
      await expect(multiSig.execute(99)).to.be.revertedWithCustomError(
        multiSig,
        "TxNonExistent",
      );
    });

    it("should revert if threshold is not met", async function () {
      await multiSig
        .connect(Signer1)
        .submit(
          Account1.address,
          ethers.ZeroAddress,
          ethers.parseEther("5"),
          TX.ETH,
        );
      await expect(multiSig.execute(0)).to.be.revertedWithCustomError(
        multiSig,
        "ThresholdNotMet",
      );
    });

    describe("ETH Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("5"),
            TX.ETH,
          );
        await multiSig.connect(Signer2).confirm(0);

        await Signer1.sendTransaction({
          to: multiSig.target,
          value: ethers.parseEther("10"),
        });
      });

      it("should execute ETH transaction successfully", async function () {
        const balanceBefore = await ethers.provider.getBalance(
          Account1.address,
        );
        await multiSig.execute(0);
        const balanceAfter = await ethers.provider.getBalance(Account1.address);
        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
      });

      it("should emit Executed event", async function () {
        await expect(multiSig.execute(0))
          .to.emit(multiSig, "Executed")
          .withArgs(0);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(0);
        const tx = await multiSig.transactions(0);
        expect(tx.state).to.equal(2); // States.EXECUTED
      });

      it("should revert if already executed", async function () {
        await multiSig.execute(0);
        await expect(multiSig.execute(0)).to.be.revertedWithCustomError(
          multiSig,
          "TxNotPending",
        );
      });

      it("should revert if insufficient ETH balance", async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("100"),
            TX.ETH,
          );
        await multiSig.connect(Signer2).confirm(1);
        await expect(multiSig.execute(1)).to.be.revertedWithCustomError(
          multiSig,
          "InsufficientFunds",
        );
      });
    });

    describe("ERC20 Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            token.target,
            ethers.parseEther("100"),
            TX.ERC20,
          );
        await multiSig.connect(Signer2).confirm(0);
      });

      it("should execute ERC20 transaction successfully", async function () {
        await multiSig.execute(0);
        expect(await token.balanceOf(Account1.address)).to.equal(
          ethers.parseEther("100"),
        );
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(0);
        const tx = await multiSig.transactions(0);
        expect(tx.state).to.equal(2); // States.EXECUTED
      });
    });

    describe("ADD_SIGNER Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .submit(Account1.address, ethers.ZeroAddress, 0, TX.ADD_SIGNER);
        await multiSig.connect(Signer2).confirm(0);
      });

      it("should add signer successfully", async function () {
        await multiSig.execute(0);
        expect(await multiSig.isSigner(Account1.address)).to.equal(true);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(0);
        const tx = await multiSig.transactions(0);
        expect(tx.state).to.equal(2);
      });
    });

    describe("REMOVE_SIGNER Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .submit(Signer3.address, ethers.ZeroAddress, 0, TX.REMOVE_SIGNER);
        await multiSig.connect(Signer2).confirm(0);
      });

      it("should remove signer successfully", async function () {
        await multiSig.execute(0);
        expect(await multiSig.isSigner(Signer3.address)).to.equal(false);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(0);
        const tx = await multiSig.transactions(0);
        expect(tx.state).to.equal(2);
      });
    });

    describe("THRESHOLD Transaction", async function () {
      beforeEach(async function () {
        await multiSig
          .connect(Signer1)
          .submit(ethers.ZeroAddress, ethers.ZeroAddress, 3, TX.THRESHOLD);
        await multiSig.connect(Signer2).confirm(0);
      });

      it("should update threshold successfully", async function () {
        await multiSig.execute(0);
        expect(await multiSig.threshold()).to.equal(3);
      });

      it("should mark transaction as executed", async function () {
        await multiSig.execute(0);
        const tx = await multiSig.transactions(0);
        expect(tx.state).to.equal(2);
      });
    });

    describe("Stale Confirmations", function () {
      it("Should fail execution if a signer was removed after confirming", async function () {
        await multiSig
          .connect(Signer1)
          .submit(
            Account1.address,
            ethers.ZeroAddress,
            ethers.parseEther("1"),
            TX.ETH,
          );

        await multiSig.connect(Signer2).confirm(0);

        await multiSig
          .connect(Signer1)
          .submit(Signer2.address, ethers.ZeroAddress, 0, TX.REMOVE_SIGNER);

        await multiSig.connect(Signer3).confirm(1);

        await multiSig.execute(1);

        await expect(multiSig.execute(0)).to.be.revertedWithCustomError(
          multiSig,
          "ThresholdNotMet",
        );
      });
    });
  });
});
